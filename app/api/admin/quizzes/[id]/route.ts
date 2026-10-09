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
  const { title } = await readJson(req);
  if (typeof title !== "string" || !title.trim()) return fail("Le titre est obligatoire.");
  const { data, error } = await db().from("quizzes").update({ title: title.trim().slice(0, 120) }).eq("id", id).select().single();
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
