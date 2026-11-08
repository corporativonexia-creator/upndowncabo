import { notFound } from "next/navigation";
import { requireRole } from "@/lib/auth/require-role";
import { findShareableProduct } from "@/lib/storefront/get-shareable-product";
import RelatedProductsServer from "@/components/store/related-products-server";
import { Suspense, cache } from "react";
import { productMetadata } from "@/lib/storefront/product-metadata";
import ProductDetail from "@/components/store/product-detail";

// This memoizes authorization only during this React request, never across users.
const ensurePreviewAdmin = cache(() => requireRole("admin", "/vista-previa"));

type Props = { params: Promise<{ productKey: string }> };

export async function generateMetadata({ params }: Props) {
  await ensurePreviewAdmin();
  return productMetadata(await findShareableProduct((await params).productKey), true);
}

export default async function PrivateProductPage({ params }: Props) {
  await ensurePreviewAdmin();
  const product = await findShareableProduct((await params).productKey);
  if (!product) notFound();
  return <>
    <ProductDetail product={product} preview />
    <Suspense fallback={<div className="ud-related-loading" role="status">Explorando artículos similares…</div>}>
      <RelatedProductsServer product={product} preview />
    </Suspense>
  </>;
}
