import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { requireRole } from "@/lib/auth/require-role";
import { getPublicCatalog } from "@/lib/catalog/get-catalog";
import { PremiumProductDetail } from "@/components/store/premium/premium-storefront";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Detalle de producto | UP AND DOWN", robots: { index: false, follow: false } };

export default async function PremiumProductPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  await requireRole("admin", "/premium-preview/producto/" + encodeURIComponent(slug));
  const { products } = await getPublicCatalog();
  const product = products.find((item) => item.slug === slug || item.id === slug);
  if (!product) notFound();
  return <PremiumProductDetail product={product} />;
}
