import { requireRole } from "@/lib/auth/require-role";
import QuickProductEntry from "@/components/admin/quick-product-entry";

export const metadata = { title: "Alta rápida móvil | UP AND DOWN" };
export default async function QuickProductPage() {
  await requireRole("admin", "/admin/productos/alta-rapida");
  return <QuickProductEntry />;
}
