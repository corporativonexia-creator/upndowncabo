import { requireRole } from "@/lib/auth/require-role";

export default async function AdminPage() {
  await requireRole("admin", "/admin");
  // The shared layout owns the legacy DOM so route changes do not restart it.
  return null;
}
