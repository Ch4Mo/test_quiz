import { adminGuard, fail, ok, readJson, UNIQUE_VIOLATION } from "@/lib/http";
import { randomCode } from "@/lib/game";
import { db } from "@/lib/supabase-server";

/** Crée une nouvelle partie (salle d'attente) pour un quiz. */
export async function POST(req: Request) {
  const denied = await adminGuard();
  if (denied) return denied;
  const { quizId } = await readJson(req);
  const { data: quiz } = await db().from("quizzes").select("id, title").eq("id", String(quizId)).maybeSingle();
  if (!quiz) return fail("Quiz introuvable.", 404);

  for (let attempt = 0; attempt < 5; attempt++) {
    const { data, error } = await db()
      .from("games")
      .insert({ code: randomCode(), quiz_id: quiz.id, quiz_title: quiz.title, version: Date.now() })
      .select("code")
      .single();
    if (!error) return ok(data, 201);
    if (error.code !== UNIQUE_VIOLATION) return fail(error.message, 500);
  }
  return fail("Impossible de générer un code de partie, réessayez.", 500);
}
