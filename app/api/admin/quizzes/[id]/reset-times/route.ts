import { adminGuard, fail, ok } from "@/lib/http";
import { db } from "@/lib/supabase-server";

type Ctx = { params: Promise<{ id: string }> };

/** Retire le temps de réponse propre à chaque question : toutes utilisent le temps du quiz. */
export async function POST(_req: Request, { params }: Ctx) {
  const denied = await adminGuard();
  if (denied) return denied;
  const { id } = await params;
  const { error } = await db().from("questions").update({ time_limit: 0 }).eq("quiz_id", id);
  if (error) return fail(error.message, 500);
  return ok({ ok: true });
}
