import crypto from "crypto";
import { TEST_TEAM_NAME, loadGame, nextPhase, submitAnswer, updateGame } from "@/lib/game";
import { adminGuard, fail, ok, readJson } from "@/lib/http";
import { db } from "@/lib/supabase-server";
import type { GameRow } from "@/lib/types";

type Ctx = { params: Promise<{ code: string }> };

/**
 * Pilotage de la partie depuis l'écran de jeu. Une fois lancée, elle défile seule ;
 * l'admin peut la mettre en pause, passer à l'étape suivante ou l'arrêter.
 * { action: "start" | "pause" | "resume" | "skip" | "finish" | "kick", teamId? }
 */
export async function POST(req: Request, { params }: Ctx) {
  const denied = await adminGuard();
  if (denied) return denied;
  const { code } = await params;
  const game = await loadGame(code);
  if (!game) return fail("Partie introuvable.", 404);
  const body = await readJson(req);
  const { action, teamId } = body;

  let patch: Partial<GameRow> | null = null;
  const running = game.status === "intro" || game.status === "question" || game.status === "reveal";

  switch (action) {
    case "start": {
      if (game.status !== "lobby") return fail("La partie a déjà commencé.", 409);
      if (!game.quiz_id) return fail("Le quiz de cette partie a été supprimé.", 409);
      const { data: questions, error } = await db()
        .from("questions")
        .select("id")
        .eq("quiz_id", game.quiz_id)
        .eq("enabled", true)
        .order("position")
        .order("created_at");
      if (error) return fail(error.message, 500);
      if (!questions.length) return fail("Aucune question cochée dans ce quiz.", 409);
      // Partie de test : une équipe « Test » joue pour l'admin, qui répond en cliquant sur l'écran
      if (game.is_test) {
        const { data: existing } = await db().from("teams").select("id").eq("game_id", game.id).eq("name", TEST_TEAM_NAME).maybeSingle();
        if (!existing) {
          await db().from("teams").insert({ game_id: game.id, name: TEST_TEAM_NAME, token: crypto.randomBytes(24).toString("hex") });
        }
      }
      // Écran des règles, puis la première question arrive toute seule
      patch = {
        status: "intro",
        question_ids: questions.map((q) => q.id),
        current_index: -1,
        phase_ends_at: new Date(Date.now() + game.intro_time * 1000).toISOString(),
        paused_remaining_ms: null,
      };
      break;
    }
    case "pause":
      if (!running || !game.phase_ends_at) return fail("Rien à mettre en pause.", 409);
      patch = {
        phase_ends_at: null,
        paused_remaining_ms: Math.max(0, new Date(game.phase_ends_at).getTime() - Date.now()),
      };
      break;
    case "resume":
      if (!running || game.paused_remaining_ms === null) return fail("La partie n'est pas en pause.", 409);
      patch = {
        phase_ends_at: new Date(Date.now() + game.paused_remaining_ms).toISOString(),
        paused_remaining_ms: null,
      };
      break;
    case "skip":
      patch = await nextPhase(game);
      if (!patch) return fail("Aucune étape à passer.", 409);
      break;
    case "test-answer": {
      // Clic sur une réponse de l'écran de jeu, uniquement en partie de test
      if (!game.is_test) return fail("Réservé aux parties de test.", 403);
      const { data: team } = await db().from("teams").select("id").eq("game_id", game.id).eq("name", TEST_TEAM_NAME).maybeSingle();
      if (!team) return fail("Équipe de test introuvable.", 409);
      const result = await submitAnswer(game, team.id, body.questionId, body.choice);
      if ("error" in result) return fail(result.error, result.status);
      return ok({ ok: true, choice: result.choice });
    }
    case "finish":
      patch = { status: "finished", phase_ends_at: null, paused_remaining_ms: null };
      break;
    case "kick": {
      if (typeof teamId !== "string") return fail("Équipe manquante.");
      const { error } = await db().from("teams").delete().eq("id", teamId).eq("game_id", game.id);
      if (error) return fail(error.message, 500);
      await db().from("games").update({ version: Date.now() }).eq("id", game.id);
      return ok({ ok: true });
    }
    default:
      return fail("Action inconnue.");
  }

  if (!(await updateGame(game, patch))) return fail("La partie a changé entre-temps.", 409);
  return ok({ ok: true });
}

/** Supprime la partie de l'historique (équipes et réponses comprises). */
export async function DELETE(_req: Request, { params }: Ctx) {
  const denied = await adminGuard();
  if (denied) return denied;
  const { code } = await params;
  const { error } = await db().from("games").delete().eq("code", code.trim().toUpperCase());
  if (error) return fail(error.message, 500);
  return ok({ ok: true });
}
