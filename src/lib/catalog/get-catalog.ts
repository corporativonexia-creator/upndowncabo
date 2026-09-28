import { createClient } from "@/lib/supabase/server";

export async function getPublicCatalog() {
  const supabase = await createClient();

  const [categoriesResult, productsResult] = await Promise.all([
    supabase
      .from("categories")
      .select("id,name,slug,sort_order")
      .eq("is_active", true)
      .order("sort_order", { ascending: true }),

    supabase
      .from("products")
      .select(`
        id,
        category_id,
        sku,
        name,
        slug,
        brand,
        model,
        item_condition,
        short_description,
        description,
        specifications,
        currency,
        price,
        sale_price,
        stock,
        cover_image_url,
        featured,
        status,
        created_at,
        categories(name,slug),
        product_images(id,image_url,alt_text,sort_order,is_primary)
      `)
      .eq("status", "active")
      .order("featured", { ascending: false })
      .order("created_at", { ascending: false }),
  ]);

  if (categoriesResult.error) {
    throw new Error(`Categories: ${categoriesResult.error.message}`);
  }

  if (productsResult.error) {
    throw new Error(`Products: ${productsResult.error.message}`);
  }

  return {
    categories: categoriesResult.data ?? [],
    products: productsResult.data ?? [],
  };
}
