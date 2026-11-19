import { requireRole } from "@/lib/auth/require-role";
import { redirect } from "next/navigation";

// A3.5: preserve saved links but expose only the unified product-creation flow.
export default async function LegacyProductEntryRedirect() {
  await requireRole("admin", "/admin/productos/alta-rapida");
  redirect("/admin?producto=nuevo");
}
