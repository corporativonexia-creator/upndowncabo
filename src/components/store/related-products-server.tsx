import { findRelatedProducts } from "@/lib/storefront/get-related-products";
import type { ShareableProduct } from "@/lib/storefront/product-share";
import RelatedProductsRail from "./related-products-rail";

/** Server-streamed, noncritical suggestions. Never blocks the product page itself. */
export default async function RelatedProductsServer({
  product, preview,
}: { product: ShareableProduct; preview: boolean }) {
  const related = await findRelatedProducts(product);
  if (!related.length) return null;
  return <RelatedProductsRail products={related} preview={preview} />;
}
