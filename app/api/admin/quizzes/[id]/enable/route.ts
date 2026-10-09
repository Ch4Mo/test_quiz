import { adminGuard, fail, ok, readJson } from "@/lib/http";
import { db } from "@/lib/supabase-server";

type Ctx = { params: Promise<{ id: string }> };

/** Coche ou décoche toutes les questions du quiz : { enabled: boolean } */
export async function POST(req: Request, { params }: Ctx) {
  const denied = await adminGuard();
  if (denied) return denied;
  const { id } = await params;
  const { enabled } = await readJson(req);
  if (typeof enabled !== "boolean") return fail("Valeur invalide.");
  const { error } = await db().from("questions").update({ enabled }).eq("quiz_id", id);
  if (error) return fail(error.message, 500);
  return ok({ ok: true });
}
