import { createClient } from "@/lib/supabase/server";
import { lookupFromProductKey, productKeyFor, type ShareableProduct } from "./product-share";

function httpImage(raw: unknown): string | null {
  if (typeof raw !== "string" || !raw.trim()) return null;
  try {
    const url = new URL(raw);
    return url.protocol === "https:" ? url.toString() : null;
  } catch { return null; }
}
function text(raw: unknown): string {
  return typeof raw === "string" ? raw.trim() : "";
}
function finiteNum(raw: unknown): number {
  const n = Number(raw ?? 0);
  return Number.isFinite(n) ? n : 0;
}
function fields(raw: unknown): Record<string, unknown> {
  return raw && typeof raw === "object" && !Array.isArray(raw) ? raw as Record<string, unknown> : {};
}

export async function findShareableProduct(key: string): Promise<ShareableProduct | null> {
  const lookup = lookupFromProductKey(key);
  if (!lookup) return null;
  const db = await createClient();
  let variant: Record<string, unknown> | null = null;
  if (lookup.kind === "variant") {
    const result = await db.from("product_variants")
      .select("id,product_id,title,sku,barcode,price,sale_price,stock,attributes,is_active")
      .eq("id", lookup.id).eq("is_active", true).maybeSingle();
    if (result.error || !result.data) return null;
    variant = result.data as Record<string, unknown>;
  }
  const parentId = variant ? text(variant.product_id) : lookup.id;
  if (!parentId) return null;
  const result = await db.from("products")
    .select("id,name,slug,sku,brand,short_description,description,item_condition,currency,price,sale_price,stock,cover_image_url,specifications,status,online_visible,categories(name,slug,image_url),product_images(image_url,is_primary,sort_order)")
    .eq("id", parentId).eq("status", "active").eq("online_visible", true).maybeSingle();
  if (result.error || !result.data) return null;
  const parent = result.data as Record<string, unknown>;
  const category = fields(parent.categories);
  const attrs = fields(variant?.attributes);
  const photos = (Array.isArray(parent.product_images) ? parent.product_images : [])
    .map(row => fields(row))
    .sort((a, b) => Number(Boolean(b.is_primary)) - Number(Boolean(a.is_primary)) || finiteNum(a.sort_order) - finiteNum(b.sort_order));
  const images = [
    httpImage(attrs.image_url), httpImage(attrs.photo_url),
    ...photos.map(row => httpImage(row.image_url)),
    httpImage(parent.cover_image_url),
  ].filter((url): url is string => Boolean(url));
  const name = text(parent.name);
  const variation = variant ? text(variant.title || variant.sku) : "";
  const isGeneric = /^(principal|única|unica)$/i.test(variation);
  const displayName = variant && variation && !isGeneric ? name + " · " + variation : name;
  const price = variant ? finiteNum(variant.price ?? parent.price) : finiteNum(parent.price);
  const sale = variant ? (variant.sale_price ?? (variant.price == null ? parent.sale_price : null)) : parent.sale_price;
  const saleNumber = sale == null ? null : finiteNum(sale);
  const hasSale = saleNumber != null && saleNumber < price;
  const active = await db.from("product_variants").select("id", { count: "exact", head: true })
    .eq("product_id", parentId).eq("is_active", true);
  const hasVariants = !active.error && (active.count || 0) > 0;
  const keyStable = productKeyFor({ id: parentId, variant_id: variant ? text(variant.id) : null, name: displayName });
  return {
    id: variant ? "variant:" + text(variant.id) : parentId,
    parentId,
    variantId: variant ? text(variant.id) : null,
    key: keyStable,
    name: displayName,
    brand: text(parent.brand) || null,
    sku: (variant ? text(variant.sku) : "") || text(parent.sku) || null,
    description: text(parent.description) || text(parent.short_description),
    condition: text(parent.item_condition),
    category: text(category.name),
    currency: text(parent.currency) || "MXN",
    price: hasSale ? saleNumber! : price,
    comparePrice: hasSale ? price : null,
    stock: Math.max(0, variant ? finiteNum(variant.stock) : finiteNum(parent.stock)),
    images: [...new Set(images)].slice(0, 10),
    hasVariants,
    specifications: { ...fields(parent.specifications), ...attrs },
  };
}
