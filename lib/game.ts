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

export function answersOpen(game: GameRow, question: Pick<QuestionRow, "time_limit">, now = Date.now()): boolean {
  if (game.status !== "question") return false;
  if (!question.time_limit || !game.question_started_at) return true;
  const deadline = new Date(game.question_started_at).getTime() + question.time_limit * 1000 + ANSWER_GRACE_MS;
  return now <= deadline;
}

export async function buildState(
  code: string,
  viewer: { teamId: string; token: string } | null,
): Promise<GameState | null> {
  const game = await loadGame(code);
  if (!game) return null;

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
  if (row && game.status !== "lobby") {
    question = {
      id: row.id,
      type: row.type,
      prompt: row.prompt,
      mediaUrl: row.media_url,
      mediaStart: Number(row.media_start) || 0,
      choices: row.choices.map((c) => ({ text: c.text, imageUrl: c.image_url })),
      points: row.points,
      timeLimit: row.time_limit,
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
      index: game.current_index,
      total: game.question_ids.length,
      questionStartedAt: game.question_started_at ? new Date(game.question_started_at).getTime() : null,
    },
    question,
    teams: teamStates,
    distribution,
    me,
    invalidTeam,
  };
}
