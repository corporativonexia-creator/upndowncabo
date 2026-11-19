import { requireRole } from "@/lib/auth/require-role";
import InventoryAdmin from "@/components/admin/inventory-admin";
import InventoryLiveEnhancer from "@/components/admin/inventory-live-enhancer";

export default async function InventoryPage() {
  await requireRole("admin", "/admin/inventario");
  return (
    <>
      <InventoryAdmin />
      <InventoryLiveEnhancer />
    </>
  );
}
