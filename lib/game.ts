import "server-only";
import { db } from "./supabase-server";
import type { GameRow, GameState, PublicQuestion, QuestionRow, TeamState } from "./types";

/** Délai de grâce (ms) après la fin du chrono, pour absorber la latence réseau. */
export const ANSWER_GRACE_MS = 1500;

const CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

export function randomCode(length = 4): string {
  let code = "";
  for (let i = 0; i < length; i++) code += CODE_ALPHABET[Math.floor(Math.random() * CODE_ALPHABET.length)];
  return code;
}

export function normalizeCode(code: string): string {
  return code.trim().toUpperCase();
}

export async function loadGame(code: string): Promise<GameRow | null> {
  const { data, error } = await db().from("games").select("*").eq("code", normalizeCode(code)).maybeSingle();
  if (error) throw error;
  return data as GameRow | null;
}

/** Signale un changement aux écrans abonnés (Supabase Realtime écoute la table games). */
export async function bumpGame(gameId: string): Promise<void> {
  await db().from("games").update({ version: Date.now() }).eq("id", gameId);
}

export function currentQuestionId(game: GameRow): string | null {
  return game.current_index >= 0 ? game.question_ids[game.current_index] ?? null : null;
}

/** Temps de réponse d'une question : le sien s'il est défini, sinon celui du quiz. */
export function answerSeconds(game: Pick<GameRow, "answer_time">, question: Pick<QuestionRow, "time_limit">): number {
  return question.time_limit > 0 ? question.time_limit : game.answer_time;
}

export function answersOpen(game: GameRow, now = Date.now()): boolean {
  if (game.status !== "question") return false;
  if (!game.phase_ends_at) return true; // partie en pause
  return now <= new Date(game.phase_ends_at).getTime() + ANSWER_GRACE_MS;
}

const inSeconds = (seconds: number) => new Date(Date.now() + seconds * 1000).toISOString();

async function startQuestion(game: GameRow, index: number): Promise<Partial<GameRow>> {
  const { data } = await db().from("questions").select("time_limit").eq("id", game.question_ids[index]).maybeSingle();
  return {
    status: "question",
    current_index: index,
    question_started_at: new Date().toISOString(),
    phase_ends_at: inSeconds(answerSeconds(game, { time_limit: data?.time_limit ?? 0 })),
    paused_remaining_ms: null,
  };
}

/** Étape suivante du déroulé : règles → question → réponse (pause) → question suivante … → résultats. */
export async function nextPhase(game: GameRow): Promise<Partial<GameRow> | null> {
  switch (game.status) {
    case "intro":
      return startQuestion(game, 0);
    case "question":
      return { status: "reveal", phase_ends_at: inSeconds(game.pause_time), paused_remaining_ms: null };
    case "reveal":
      return game.current_index + 1 < game.question_ids.length
        ? startQuestion(game, game.current_index + 1)
        : { status: "finished", phase_ends_at: null, paused_remaining_ms: null };
    default:
      return null;
  }
}

/**
 * Applique un changement à la partie seulement si elle est toujours à la même étape :
 * deux écrans qui déclenchent la même transition en même temps ne font pas sauter de question.
 */
export async function updateGame(game: GameRow, patch: Partial<GameRow>): Promise<boolean> {
  const { data, error } = await db()
    .from("games")
    .update({ ...patch, version: Date.now() })
    .eq("id", game.id)
    .eq("status", game.status)
    .eq("current_index", game.current_index)
    .select("id")
    .maybeSingle();
  if (error) throw error;
  return !!data;
}

/**
 * Fait avancer la partie si l'étape en cours est terminée. Il n'y a pas de minuterie côté serveur
 * (Vercel n'en permet pas) : chaque écran qui consulte l'état au moment voulu déclenche la transition.
 */
async function advanceIfDue(game: GameRow): Promise<GameRow> {
  if (!game.phase_ends_at) return game;
  const grace = game.status === "question" ? ANSWER_GRACE_MS : 0;
  if (Date.now() < new Date(game.phase_ends_at).getTime() + grace) return game;
  const patch = await nextPhase(game);
  if (!patch) return game;
  await updateGame(game, patch);
  return (await loadGame(game.code)) ?? game;
}

export async function buildState(
  code: string,
  viewer: { teamId: string; token: string } | null,
): Promise<GameState | null> {
  const loaded = await loadGame(code);
  if (!loaded) return null;
  const game = await advanceIfDue(loaded);

  const questionId = currentQuestionId(game);
  const [teamsRes, answersRes, questionRes] = await Promise.all([
    db().from("teams").select("id, name, token, created_at").eq("game_id", game.id).order("created_at"),
    db().from("answers").select("team_id, question_id, choice_index, is_correct, points").eq("game_id", game.id),
    questionId ? db().from("questions").select("*").eq("id", questionId).maybeSingle() : Promise.resolve({ data: null, error: null }),
  ]);
  if (teamsRes.error) throw teamsRes.error;
  if (answersRes.error) throw answersRes.error;
  if (questionRes.error) throw questionRes.error;

  const teams = teamsRes.data ?? [];
  const answers = answersRes.data ?? [];
  const row = questionRes.data as QuestionRow | null;

  const scores = new Map<string, number>();
  for (const t of teams) scores.set(t.id, 0);
  // Les points de la question en cours ne comptent qu'après la révélation, sinon le score trahirait la bonne réponse.
  const hidden = game.status === "question" ? questionId : null;
  for (const a of answers) {
    if (a.is_correct && a.question_id !== hidden && scores.has(a.team_id)) {
      scores.set(a.team_id, scores.get(a.team_id)! + a.points);
    }
  }
  // Classement avec ex æquo : 10, 8, 8, 5 -> 1er, 2e, 2e, 4e
  const sortedScores = [...scores.values()].sort((a, b) => b - a);
  const rankOf = (score: number) => sortedScores.indexOf(score) + 1;

  const currentAnswers = new Map<string, number>();
  for (const a of answers) if (a.question_id === questionId) currentAnswers.set(a.team_id, a.choice_index);

  const revealed = game.status !== "question";
  let question: PublicQuestion | null = null;
  let distribution: number[] | null = null;
  if (row && (game.status === "question" || game.status === "reveal")) {
    question = {
      id: row.id,
      type: row.type,
      prompt: row.prompt,
      mediaUrl: row.media_url,
      mediaStart: Number(row.media_start) || 0,
      choices: row.choices.map((c) => ({ text: c.text, imageUrl: c.image_url })),
      points: row.points,
      timeLimit: answerSeconds(game, row),
      correctIndex: revealed ? row.correct_index : null,
    };
    if (revealed) {
      distribution = row.choices.map(() => 0);
      for (const choice of currentAnswers.values()) if (choice in distribution) distribution[choice]++;
    }
  }

  const teamStates: TeamState[] = teams.map((t) => ({
    id: t.id,
    name: t.name,
    score: scores.get(t.id) ?? 0,
    rank: rankOf(scores.get(t.id) ?? 0),
    answered: currentAnswers.has(t.id),
  }));

  let me: GameState["me"] = null;
  let invalidTeam = false;
  if (viewer) {
    const team = teams.find((t) => t.id === viewer.teamId && t.token === viewer.token);
    if (!team) {
      invalidTeam = true;
    } else {
      const answer = currentAnswers.get(team.id) ?? null;
      me = {
        id: team.id,
        name: team.name,
        score: scores.get(team.id) ?? 0,
        rank: rankOf(scores.get(team.id) ?? 0),
        answer,
        correct: revealed && row && answer !== null ? answer === row.correct_index : null,
      };
    }
  }

  return {
    serverNow: Date.now(),
    game: {
      code: game.code,
      status: game.status,
      quizTitle: game.quiz_title,
      isTest: !!game.is_test,
      index: game.current_index,
      total: game.question_ids.length,
      questionStartedAt: game.question_started_at ? new Date(game.question_started_at).getTime() : null,
      phaseEndsAt: game.phase_ends_at ? new Date(game.phase_ends_at).getTime() : null,
      pausedRemainingMs: game.paused_remaining_ms,
      answerTime: game.answer_time,
      pauseTime: game.pause_time,
      introTime: game.intro_time,
    },
    question,
    teams: teamStates,
    distribution,
    me,
    invalidTeam,
  };
}
