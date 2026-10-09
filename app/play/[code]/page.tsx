import { PlayerScreen } from "@/components/PlayerScreen";

export default async function PlayPage({ params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  return <PlayerScreen code={code.trim().toUpperCase()} />;
}
