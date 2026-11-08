import { notFound } from "next/navigation";
import { findShareableProduct } from "@/lib/storefront/get-shareable-product";
import { findRelatedProducts } from "@/lib/storefront/get-related-products";
import { productMetadata } from "@/lib/storefront/product-metadata";
import ProductDetail from "@/components/store/product-detail";
import { productPageUrl } from "@/lib/storefront/product-share";

type Props = { params: Promise<{ productKey: string }> };

export async function generateMetadata({ params }: Props) {
  return productMetadata(await findShareableProduct((await params).productKey), false);
}

export default async function ProductPage({ params }: Props) {
  // /producto remains behind the existing UNDER_CONSTRUCTION proxy gate until launch.
  const product = await findShareableProduct((await params).productKey);
  if (!product) notFound();
  const related = await findRelatedProducts(product);
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "Product",
    name: product.name,
    description: product.description || product.name,
    sku: product.sku || undefined,
    image: product.images,
    url: productPageUrl(product.key, false),
    brand: product.brand ? { "@type": "Brand", name: product.brand } : undefined,
    offers: {
      "@type": "Offer",
      price: product.price,
      priceCurrency: product.currency,
      availability: product.stock > 0 ? "https://schema.org/InStock" : "https://schema.org/OutOfStock",
      itemCondition: product.condition === "new"
        ? "https://schema.org/NewCondition"
        : "https://schema.org/UsedCondition",
      url: productPageUrl(product.key, false),
    },
  };
  return <>
    <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd).replace(/</g, "\\u003c") }} />
    <ProductDetail product={product} related={related} preview={false} />
  </>;
}
