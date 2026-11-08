import type { Metadata } from "next";
import { productPageUrl, type ShareableProduct } from "./product-share";

export function productMetadata(product: ShareableProduct | null, preview: boolean): Metadata {
  if (!product) return { title: "Producto no disponible · UP AND DOWN", robots: { index: false, follow: false } };
  const title = product.name + " | UP AND DOWN Cabo";
  const description = ("Descubre " + product.name + ". Consulta fotografías, características, precio y disponibilidad en UP AND DOWN Cabo.").slice(0, 190);
  const url = productPageUrl(product.key, preview);
  // Use the real product photo when present; otherwise create a branded Open Graph card.
  // Both destinations remain behind the launch gate until the shop opens publicly.
  const image = product.images[0] || productPageUrl(product.key, false) + "/social-card";
  return {
    metadataBase: new URL("https://upndowncabo.com"),
    title,
    description,
    alternates: { canonical: productPageUrl(product.key, false) },
    robots: { index: !preview, follow: !preview },
    openGraph: {
      type: "website",
      siteName: "UP AND DOWN Cabo",
      locale: "es_MX",
      title,
      description,
      url,
      ...(image ? { images: [{ url: image, alt: product.name }] } : {}),
    },
    twitter: {
      card: image ? "summary_large_image" : "summary",
      title,
      description,
      ...(image ? { images: [image] } : {}),
    },
  };
}
