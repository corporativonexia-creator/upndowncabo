import type { Metadata } from "next";
import { requireRole } from "@/lib/auth/require-role";
import { getPublicCatalog } from "@/lib/catalog/get-catalog";
import { PremiumStorefront } from "@/components/store/premium/premium-storefront";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "UP AND DOWN | Premium preview", robots: { index: false, follow: false } };

export default async function PremiumPreviewPage() {
  await requireRole("admin", "/premium-preview");
  const catalog = await getPublicCatalog();
  return <PremiumStorefront categories={catalog.categories} products={catalog.products} />;
}
