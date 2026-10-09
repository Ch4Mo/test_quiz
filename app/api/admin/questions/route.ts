import { adminGuard, fail, ok, readJson } from "@/lib/http";
import { db } from "@/lib/supabase-server";
import { parseQuestion } from "@/lib/validate";

export async function POST(req: Request) {
  const denied = await adminGuard();
  if (denied) return denied;
  const body = await readJson(req);
  if (typeof body.quiz_id !== "string") return fail("Quiz manquant.");
  const parsed = parseQuestion(body);
  if ("error" in parsed) return fail(parsed.error);

  const { data: last } = await db()
    .from("questions")
    .select("position")
    .eq("quiz_id", body.quiz_id)
    .order("position", { ascending: false })
    .limit(1)
    .maybeSingle();
  const { data, error } = await db()
    .from("questions")
    .insert({ ...parsed.value, quiz_id: body.quiz_id, position: (last?.position ?? -1) + 1 })
    .select()
    .single();
  if (error) return fail(error.message, 500);
  return ok(data, 201);
}
