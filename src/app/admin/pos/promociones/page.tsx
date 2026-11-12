import { requireRole } from "@/lib/auth/require-role";
import Pos22CampaignsAdmin from "@/components/admin/pos22-campaigns-admin";

export default async function PosCampaignsPage() {
  await requireRole("admin", "/admin/pos/promociones");
  return <Pos22CampaignsAdmin />;
}
