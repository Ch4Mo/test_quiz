import { loadGame } from "@/lib/game";
import { adminGuard, fail, ok, readJson } from "@/lib/http";
import { db } from "@/lib/supabase-server";
import type { GameRow, GameStatus } from "@/lib/types";

type Ctx = { params: Promise<{ code: string }> };

/**
 * Pilotage de la partie depuis l'écran de jeu.
 * { action: "start" | "reveal" | "leaderboard" | "next" | "finish" | "kick", teamId? }
 */
export async function POST(req: Request, { params }: Ctx) {
  const denied = await adminGuard();
  if (denied) return denied;
  const { code } = await params;
  const game = await loadGame(code);
  if (!game) return fail("Partie introuvable.", 404);
  const { action, teamId } = await readJson(req);

  const now = new Date().toISOString();
  let patch: Partial<GameRow> | null = null;

  switch (action) {
    case "start": {
      if (game.status !== "lobby") return fail("La partie a déjà commencé.", 409);
      if (!game.quiz_id) return fail("Le quiz de cette partie a été supprimé.", 409);
      const { data: questions, error } = await db()
        .from("questions")
        .select("id")
        .eq("quiz_id", game.quiz_id)
        .order("position")
        .order("created_at");
      if (error) return fail(error.message, 500);
      if (!questions.length) return fail("Ce quiz ne contient aucune question.", 409);
      patch = { status: "question", question_ids: questions.map((q) => q.id), current_index: 0, question_started_at: now };
      break;
    }
    case "reveal":
      if (game.status !== "question") return fail("Aucune question en cours.", 409);
      patch = { status: "reveal" };
      break;
    case "leaderboard":
      if (game.status !== "reveal") return fail("Révélez d'abord la réponse.", 409);
      patch = { status: "leaderboard" };
      break;
    case "next":
      if (game.status !== "reveal" && game.status !== "leaderboard") return fail("Révélez d'abord la réponse.", 409);
      patch =
        game.current_index + 1 < game.question_ids.length
          ? { status: "question", current_index: game.current_index + 1, question_started_at: now }
          : { status: "finished" };
      break;
    case "finish":
      patch = { status: "finished" };
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

  // Mise à jour conditionnelle : un double-clic ne fait pas sauter de question.
  const { data, error } = await db()
    .from("games")
    .update({ ...patch, version: Date.now() })
    .eq("id", game.id)
    .eq("status", game.status as GameStatus)
    .eq("current_index", game.current_index)
    .select("status")
    .maybeSingle();
  if (error) return fail(error.message, 500);
  if (!data) return fail("La partie a changé entre-temps.", 409);
  return ok({ ok: true });
}
