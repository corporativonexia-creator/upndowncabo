import { notFound } from "next/navigation";
import { requireRole } from "@/lib/auth/require-role";
import { findShareableProduct } from "@/lib/storefront/get-shareable-product";
import { productMetadata } from "@/lib/storefront/product-metadata";
import ProductDetail from "@/components/store/product-detail";

type Props = { params: Promise<{ productKey: string }> };

export async function generateMetadata({ params }: Props) {
  await requireRole("admin", "/vista-previa");
  return productMetadata(await findShareableProduct((await params).productKey), true);
}

export default async function PrivateProductPage({ params }: Props) {
  await requireRole("admin", "/vista-previa");
  const product = await findShareableProduct((await params).productKey);
  if (!product) notFound();
  return <ProductDetail product={product} preview />;
}
