import "./admin-premium-white.css";
import { requireRole } from "@/lib/auth/require-role";
import AdminRouteShell from "@/components/admin/admin-route-shell";

export default async function AdminLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  // The persistent admin workspace must never mount before server authorization.
  await requireRole("admin", "/admin");
  return <AdminRouteShell>{children}</AdminRouteShell>;
}
