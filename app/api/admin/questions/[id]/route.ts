import { adminGuard, fail, ok, readJson } from "@/lib/http";
import { db } from "@/lib/supabase-server";
import { parseQuestion } from "@/lib/validate";

type Ctx = { params: Promise<{ id: string }> };

export async function PATCH(req: Request, { params }: Ctx) {
  const denied = await adminGuard();
  if (denied) return denied;
  const { id } = await params;
  const parsed = parseQuestion(await readJson(req));
  if ("error" in parsed) return fail(parsed.error);
  const { data, error } = await db().from("questions").update(parsed.value).eq("id", id).select().single();
  if (error) return fail(error.message, 500);
  return ok(data);
}

export async function DELETE(_req: Request, { params }: Ctx) {
  const denied = await adminGuard();
  if (denied) return denied;
  const { id } = await params;
  const { error } = await db().from("questions").delete().eq("id", id);
  if (error) return fail(error.message, 500);
  return ok({ ok: true });
}
