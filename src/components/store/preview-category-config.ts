/**
 * Preview-only commercial taxonomy. Does not mutate Supabase or operational POS categories.
 * Every source slug from the existing inventory is accounted for once.
 */
export type PreviewCategoryGroup = {
  slug: string;
  name_es: string;
  name_en: string;
  sources: string[];
};

export const PREVIEW_CATEGORY_GROUPS: PreviewCategoryGroup[] = [
  { slug: "sets-completos", name_es: "Sets completos", name_en: "Complete Sets", sources: ["equipos-completos", "sets-completos"] },
  { slug: "drivers", name_es: "Drivers", name_en: "Drivers", sources: ["drivers"] },
  { slug: "maderas", name_es: "Maderas", name_en: "Fairway Woods", sources: ["maderas"] },
  { slug: "hibridos", name_es: "Híbridos", name_en: "Hybrids", sources: ["hibridos"] },
  { slug: "fierros", name_es: "Fierros", name_en: "Irons", sources: ["hierros", "fierros"] },
  { slug: "wedges", name_es: "Wedges", name_en: "Wedges", sources: ["wedges"] },
  { slug: "putters", name_es: "Putters", name_en: "Putters", sources: ["putters"] },
  { slug: "accesorios", name_es: "Accesorios", name_en: "Accessories", sources: ["accesorios", "guantes", "electronicos"] },
  { slug: "pelotas", name_es: "Pelotas", name_en: "Golf Balls", sources: ["pelotas"] },
  { slug: "ropa", name_es: "Ropa", name_en: "Apparel", sources: ["ropa", "zapatos"] },
  { slug: "bolsas-carritos", name_es: "Bolsas y carritos de golf", name_en: "Golf Bags & Carts", sources: ["bolsas", "carritos", "bolsas-carritos"] },
];
