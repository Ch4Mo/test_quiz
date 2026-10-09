import { ANSWER_GRACE_MS, answersOpen, bumpGame, currentQuestionId, loadGame, updateGame } from "@/lib/game";
import { fail, ok, readJson, UNIQUE_VIOLATION } from "@/lib/http";
import { db } from "@/lib/supabase-server";
import type { QuestionRow } from "@/lib/types";

type Ctx = { params: Promise<{ code: string }> };

/** Enregistre la réponse d'une équipe. Une réponse enregistrée ne peut plus être modifiée. */
export async function POST(req: Request, { params }: Ctx) {
  const { code } = await params;
  const { teamId, token, questionId, choice } = await readJson(req);
  const game = await loadGame(code);
  if (!game) return fail("Partie introuvable.", 404);

  const { data: team } = await db()
    .from("teams")
    .select("id")
    .eq("id", String(teamId))
    .eq("game_id", game.id)
    .eq("token", String(token))
    .maybeSingle();
  if (!team) return fail("Équipe inconnue.", 401);

  if (game.status !== "question" || currentQuestionId(game) !== questionId) {
    return fail("Les réponses sont closes pour cette question.", 409);
  }
  const { data: question } = await db().from("questions").select("*").eq("id", questionId).maybeSingle();
  if (!question) return fail("Question introuvable.", 404);
  const q = question as QuestionRow;
  if (!answersOpen(game)) return fail("Temps écoulé !", 409);

  const index = Number(choice);
  if (!Number.isInteger(index) || index < 0 || index >= q.choices.length) return fail("Réponse invalide.");

  const isCorrect = index === q.correct_index;
  const { error } = await db().from("answers").insert({
    game_id: game.id,
    team_id: team.id,
    question_id: q.id,
    choice_index: index,
    is_correct: isCorrect,
    points: isCorrect ? q.points : 0,
  });
  if (error) {
    if (error.code === UNIQUE_VIOLATION) return fail("Votre équipe a déjà répondu à cette question.", 409);
    return fail(error.message, 500);
  }

  // Toutes les équipes ont répondu : inutile d'attendre la fin du chrono, la réponse s'affiche tout de suite
  const [teams, answered] = await Promise.all([
    db().from("teams").select("id").eq("game_id", game.id),
    db().from("answers").select("team_id").eq("game_id", game.id).eq("question_id", q.id),
  ]);
  const everyone = (teams.data?.length ?? 0) > 0 && (answered.data?.length ?? 0) >= (teams.data?.length ?? 0);
  if (everyone && game.phase_ends_at) {
    await updateGame(game, { phase_ends_at: new Date(Date.now() - ANSWER_GRACE_MS).toISOString() });
  } else {
    await bumpGame(game.id);
  }
  return ok({ ok: true, choice: index }, 201);
}
