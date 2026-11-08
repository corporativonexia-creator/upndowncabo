// Stable public identifiers: the UUID is authoritative; the readable prefix is decorative.
const UUID = "[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}";
const PRODUCT_KEY_PATTERN = new RegExp("(?:^|--)(p|v)-(" + UUID + ")$", "i");
const ID_ONLY = new RegExp("^" + UUID + "$", "i");

export type ProductIdentity = { id: string; name: string; variant_id?: string | null };
export type ProductLookup = { kind: "product" | "variant"; id: string };

export function productKeyFor(product: ProductIdentity) {
  const safeName = String(product.name || "producto")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 64)
    .replace(/-+$/g, "") || "producto";
  const rawId = product.variant_id || product.id;
  const id = rawId.replace(/^variant:/, "").toLowerCase();
  if (!ID_ONLY.test(id)) throw new Error("Invalid product identifier");
  return safeName + "--" + (product.variant_id ? "v" : "p") + "-" + id;
}

export function lookupFromProductKey(key: string): ProductLookup | null {
  if (key.length > 160) return null;
  const match = key.match(PRODUCT_KEY_PATTERN);
  if (match) return { kind: match[1].toLowerCase() === "v" ? "variant" : "product", id: match[2].toLowerCase() };
  if (ID_ONLY.test(key)) return { kind: "product", id: key.toLowerCase() };
  return null;
}

export function productPageUrl(key: string, preview: boolean, referralCode?: string | null) {
  const url = new URL((preview ? "/vista-previa" : "") + "/producto/" + encodeURIComponent(key), "https://upndowncabo.com");
  if (referralCode && /^[A-Z0-9_-]{1,48}$/i.test(referralCode)) url.searchParams.set("ref", referralCode.toUpperCase());
  return url.toString();
}

export type ShareableProduct = {
  id: string;
  parentId: string;
  variantId: string | null;
  key: string;
  name: string;
  brand: string | null;
  model: string | null;
  sku: string | null;
  shortDescription: string;

  description: string;
  condition: string;
  category: string;
  currency: string;
  price: number;
  comparePrice: number | null;
  stock: number;
  images: string[];
  hasVariants: boolean;
  specifications: Record<string, unknown>;
};
