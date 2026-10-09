import { HostScreen } from "@/components/HostScreen";
import { requireAdminPage } from "@/lib/auth";
import { normalizeCode } from "@/lib/game";

export default async function HostPage({ params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  await requireAdminPage(`/host/${code}`);
  return <HostScreen code={normalizeCode(code)} />;
}
