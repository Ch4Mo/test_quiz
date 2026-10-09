import { adminGuard, fail, ok, readJson } from "@/lib/http";
import { db } from "@/lib/supabase-server";

export const dynamic = "force-dynamic";

export async function GET() {
  const denied = await adminGuard();
  if (denied) return denied;
  const [quizzes, games] = await Promise.all([
    db().from("quizzes").select("id, title, created_at, questions(count)").order("created_at", { ascending: false }),
    db().from("games").select("code, quiz_title, status, created_at").order("created_at", { ascending: false }).limit(10),
  ]);
  if (quizzes.error) return fail(quizzes.error.message, 500);
  if (games.error) return fail(games.error.message, 500);
  return ok({
    quizzes: quizzes.data.map((q) => ({
      id: q.id,
      title: q.title,
      created_at: q.created_at,
      questionCount: (q.questions as { count: number }[])[0]?.count ?? 0,
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
