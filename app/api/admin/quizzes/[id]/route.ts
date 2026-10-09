import { adminGuard, fail, ok, readJson } from "@/lib/http";
import { db } from "@/lib/supabase-server";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

export async function GET(_req: Request, { params }: Ctx) {
  const denied = await adminGuard();
  if (denied) return denied;
  const { id } = await params;
  const [quiz, questions] = await Promise.all([
    db().from("quizzes").select("*").eq("id", id).maybeSingle(),
    db().from("questions").select("*").eq("quiz_id", id).order("position").order("created_at"),
  ]);
  if (quiz.error) return fail(quiz.error.message, 500);
  if (!quiz.data) return fail("Quiz introuvable.", 404);
  if (questions.error) return fail(questions.error.message, 500);
  return ok({ quiz: quiz.data, questions: questions.data });
}

export async function PATCH(req: Request, { params }: Ctx) {
  const denied = await adminGuard();
  if (denied) return denied;
  const { id } = await params;
  const body = await readJson(req);
  const patch: Record<string, unknown> = {};
  if (body.title !== undefined) {
    if (typeof body.title !== "string" || !body.title.trim()) return fail("Le titre est obligatoire.");
    patch.title = body.title.trim().slice(0, 120);
  }
  // Réglages du défilement automatique, en secondes
  const limits = { answer_time: [5, 600], pause_time: [3, 120], intro_time: [3, 300] } as const;
  for (const [key, [min, max]] of Object.entries(limits)) {
    if (body[key] === undefined) continue;
    const n = Math.round(Number(body[key]));
    if (!Number.isFinite(n) || n < min || n > max) return fail(`Valeur invalide : entre ${min} et ${max} secondes.`);
    patch[key] = n;
  }
  const { data, error } = await db().from("quizzes").update(patch).eq("id", id).select().single();
  if (error) return fail(error.message, 500);
  return ok(data);
}

export async function DELETE(_req: Request, { params }: Ctx) {
  const denied = await adminGuard();
  if (denied) return denied;
  const { id } = await params;
  const { error } = await db().from("quizzes").delete().eq("id", id);
  if (error) return fail(error.message, 500);
  return ok({ ok: true });
}
