import { AdminHome } from "@/components/AdminHome";
import { requireAdminPage } from "@/lib/auth";

export default async function AdminPage() {
  await requireAdminPage("/admin");
  return <AdminHome />;
}
