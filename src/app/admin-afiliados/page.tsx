import { requireRole } from "@/lib/auth/require-role";
import { redirect } from "next/navigation";

export default async function AffiliatesAdminPage() {
  await requireRole("admin", "/admin-afiliados");

  // El panel oficial de vendedores ya vive dentro del Admin V2.
  // El runtime /updown-admin-v2.js respeta ?section=vendedores.
  redirect("/admin?section=vendedores");
}
