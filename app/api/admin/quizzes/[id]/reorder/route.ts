import { adminGuard, fail, ok, readJson } from "@/lib/http";
import { db } from "@/lib/supabase-server";

type Ctx = { params: Promise<{ id: string }> };

/** Enregistre un nouvel ordre de questions : { ids: [...] } */
export async function POST(req: Request, { params }: Ctx) {
  const denied = await adminGuard();
  if (denied) return denied;
  const { id } = await params;
  const { ids } = await readJson(req);
  if (!Array.isArray(ids) || ids.some((x) => typeof x !== "string")) return fail("Liste invalide.");
  const results = await Promise.all(
    (ids as string[]).map((qid, position) => db().from("questions").update({ position }).eq("id", qid).eq("quiz_id", id)),
  );
  const failed = results.find((r) => r.error);
  if (failed?.error) return fail(failed.error.message, 500);
  return ok({ ok: true });
}
