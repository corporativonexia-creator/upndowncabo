import { requireRole } from "@/lib/auth/require-role";
import InventoryAdmin from "@/components/admin/inventory-admin";

export default async function InventoryPage() {
  await requireRole("admin", "/admin/inventario");
  return <InventoryAdmin />;
}
