import { requireRole } from "@/lib/auth/require-role";
import InventoryAdmin from "@/components/admin/inventory-admin";
import InventoryLabelEnhancer from "@/components/admin/inventory-label-enhancer";
import AdminSectionNav from "@/components/admin/admin-section-nav";

export default async function InventoryPage() {
  await requireRole("admin", "/admin/inventario");
  return (
    <>
      <div style={{ background: "#f7f5f1", padding: "22px 34px 0" }}>
        <AdminSectionNav active="Inventario" />
      </div>
      <InventoryAdmin />
      <InventoryLabelEnhancer />
    </>
  );
}
