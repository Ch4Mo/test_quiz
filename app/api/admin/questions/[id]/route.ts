import { adminGuard, fail, ok, readJson } from "@/lib/http";
import { db } from "@/lib/supabase-server";
import { parseQuestion } from "@/lib/validate";

type Ctx = { params: Promise<{ id: string }> };

export async function PATCH(req: Request, { params }: Ctx) {
  const denied = await adminGuard();
  if (denied) return denied;
  const { id } = await params;
  const body = await readJson(req);
  // Simple case à cocher : question jouée ou non
  if (typeof body.enabled === "boolean" && body.type === undefined) {
    const { data, error } = await db().from("questions").update({ enabled: body.enabled }).eq("id", id).select().single();
    if (error) return fail(error.message, 500);
    return ok(data);
  }
  const parsed = parseQuestion(body);
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
