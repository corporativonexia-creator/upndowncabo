export type PosProduct = {
  id: string; name: string; sku: string | null; barcode: string | null;
  brand: string | null; model: string | null; price: number | string | null;
  sale_price: number | string | null; currency: string; stock: number | string | null;
  cover_image_url: string | null; status: string; pos_visible?: boolean;
  variant_id?: string | null; parent_id?: string | null;
};

export type PosVariant = {
  id: string; product_id: string; sku: string; barcode: string | null;
  title: string; attributes: Record<string, unknown> | null;
  price: number | string | null; sale_price: number | string | null;
  stock: number; is_active: boolean;
};

export function variantLabel(variant: PosVariant): string {
  const attributes = Object.entries(variant.attributes || {})
    .filter(([key, value]) => !["image_url", "photo_url"].includes(key) &&
      ["string", "number"].includes(typeof value))
    .map(([, value]) => String(value).trim()).filter(Boolean);
  return [...new Set([variant.title?.trim(), ...attributes].filter(Boolean))]
    .join(" · ") || variant.sku;
}

export function buildPosCatalog(parents: PosProduct[], variants: PosVariant[]): PosProduct[] {
  const byParent = new Map<string, PosVariant[]>();
  for (const variant of variants) {
    const group = byParent.get(variant.product_id) || [];
    group.push(variant);
    byParent.set(variant.product_id, group);
  }
  return parents.filter(p => p.status === "active" && p.pos_visible !== false).flatMap(parent => {
    const children = byParent.get(parent.id);
    // A parent with only inactive variants is not a standalone stock item.
    if (!children?.length) return [parent];
    return children.filter(v => v.is_active).map(variant => {
      const photo = variant.attributes?.image_url || variant.attributes?.photo_url;
      return {
        ...parent, id: variant.id, parent_id: parent.id, variant_id: variant.id,
        name: `${parent.name} · ${variantLabel(variant)}`, sku: variant.sku,
        barcode: variant.barcode, price: variant.price ?? parent.price,
        sale_price: variant.sale_price ?? (variant.price != null ? null : parent.sale_price),
        stock: variant.stock,
        cover_image_url: typeof photo === "string" && /^https?:\/\//.test(photo)
          ? photo : parent.cover_image_url,
      };
    });
  });
}

export function barcodeMatches(products: PosProduct[], code: string): PosProduct[] {
  return products.filter(product => product.barcode?.trim() === code.trim());
}

export async function readAllPages<T>(readPage: (from: number, to: number) =>
  PromiseLike<{ data: T[] | null; error: unknown }>, pageSize = 500): Promise<T[]> {
  const rows: T[] = [];
  for (let from = 0; ; from += pageSize) {
    const { data, error } = await readPage(from, from + pageSize - 1);
    if (error) throw error;
    rows.push(...(data || []));
    if (!data || data.length < pageSize) return rows;
  }
}
