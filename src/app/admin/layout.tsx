import "./admin-premium-white.css";
import AdminRouteShell from "@/components/admin/admin-route-shell";

export default function AdminLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <AdminRouteShell>{children}</AdminRouteShell>;
}
