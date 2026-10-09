import { QuizEditor } from "@/components/QuizEditor";
import { requireAdminPage } from "@/lib/auth";

export default async function QuizPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  await requireAdminPage(`/admin/quiz/${id}`);
  return <QuizEditor quizId={id} />;
}
