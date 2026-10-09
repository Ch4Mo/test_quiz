import { adminGuard, fail, ok, readJson } from "@/lib/http";
import { db } from "@/lib/supabase-server";

export const dynamic = "force-dynamic";

export async function GET() {
  const denied = await adminGuard();
  if (denied) return denied;
  const [quizzes, games, enabled] = await Promise.all([
    db().from("quizzes").select("id, title, created_at, questions(count)").order("created_at", { ascending: false }),
    db().from("games").select("code, quiz_title, status, created_at").order("created_at", { ascending: false }).limit(10),
    db().from("questions").select("quiz_id").eq("enabled", true),
  ]);
  const enabledCount = new Map<string, number>();
  for (const q of enabled.data ?? []) enabledCount.set(q.quiz_id, (enabledCount.get(q.quiz_id) ?? 0) + 1);
  if (quizzes.error) return fail(quizzes.error.message, 500);
  if (games.error) return fail(games.error.message, 500);
  return ok({
    quizzes: quizzes.data.map((q) => ({
      id: q.id,
      title: q.title,
      created_at: q.created_at,
      questionCount: (q.questions as { count: number }[])[0]?.count ?? 0,
      enabledCount: enabledCount.get(q.id) ?? 0,
    })),
    games: games.data,
  });
}

export async function POST(req: Request) {
  const denied = await adminGuard();
  if (denied) return denied;
  const { title } = await readJson(req);
  const clean = typeof title === "string" && title.trim() ? title.trim().slice(0, 120) : "Nouveau quiz";
  const { data, error } = await db().from("quizzes").insert({ title: clean }).select().single();
  if (error) return fail(error.message, 500);
  return ok(data, 201);
}
