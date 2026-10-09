import { buildState } from "@/lib/game";
import { fail, ok } from "@/lib/http";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ code: string }> };

export async function GET(req: Request, { params }: Ctx) {
  const { code } = await params;
  const url = new URL(req.url);
  const teamId = url.searchParams.get("team");
  const token = url.searchParams.get("token");
  const state = await buildState(code, teamId && token ? { teamId, token } : null);
  if (!state) return fail("Partie introuvable.", 404);
  return ok(state);
}
