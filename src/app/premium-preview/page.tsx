import type { Metadata } from "next";
import { requireRole } from "@/lib/auth/require-role";
import { getPublicCatalog } from "@/lib/catalog/get-catalog";
import { PremiumStorefront } from "@/components/store/premium/premium-storefront";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "UP AND DOWN | Premium preview", robots: { index: false, follow: false } };

export default async function PremiumPreviewPage({searchParams}: {searchParams: Promise<{categoria?: string}>}) {
  await requireRole("admin", "/premium-preview");
  const [catalog, params] = await Promise.all([getPublicCatalog(), searchParams]);
  return <PremiumStorefront categories={catalog.categories} products={catalog.products} initialCategory={params.categoria || ""} />;
}
