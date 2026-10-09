import crypto from "crypto";
import { bumpGame, loadGame } from "@/lib/game";
import { fail, ok, readJson, UNIQUE_VIOLATION } from "@/lib/http";
import { db } from "@/lib/supabase-server";

type Ctx = { params: Promise<{ code: string }> };

export async function POST(req: Request, { params }: Ctx) {
  const { code } = await params;
  const game = await loadGame(code);
  if (!game) return fail("Partie introuvable. Vérifiez le QR code.", 404);
  if (game.status !== "lobby") return fail("La partie a déjà commencé, impossible de rejoindre.", 409);

  const { name } = await readJson(req);
  const clean = typeof name === "string" ? name.trim().replace(/\s+/g, " ") : "";
  if (!clean) return fail("Indiquez le nom de votre équipe.");
  if (clean.length > 30) return fail("Le nom ne doit pas dépasser 30 caractères.");

  const token = crypto.randomBytes(24).toString("hex");
  const { data, error } = await db().from("teams").insert({ game_id: game.id, name: clean, token }).select("id").single();
  if (error) {
    if (error.code === UNIQUE_VIOLATION) return fail("Ce nom est déjà pris par une autre équipe.", 409);
    return fail(error.message, 500);
  }
  await bumpGame(game.id);
  return ok({ teamId: data.id, token, name: clean }, 201);
}
