import { requireRole } from "@/lib/auth/require-role";
import AdminParity from "@/components/admin/admin-parity";

export default async function AdminPage() {
  await requireRole("admin", "/admin");
  return <AdminParity />;
}
