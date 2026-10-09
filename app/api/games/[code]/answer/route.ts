import { loadGame, submitAnswer } from "@/lib/game";
import { fail, ok, readJson } from "@/lib/http";
import { db } from "@/lib/supabase-server";

type Ctx = { params: Promise<{ code: string }> };

/** Enregistre la réponse d'une équipe depuis son téléphone. Une réponse enregistrée ne peut plus être modifiée. */
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

  const result = await submitAnswer(game, team.id, questionId, choice);
  if ("error" in result) return fail(result.error, result.status);
  return ok({ ok: true, choice: result.choice }, 201);
}
