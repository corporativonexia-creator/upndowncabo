import { createClient } from "@supabase/supabase-js";

export const dynamic = "force-dynamic";

// This fixed storage object is a display setting, never a catalog category.
export async function GET() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  try {
    if (url && key) {
      const db = createClient(url, key, { auth: { persistSession: false } });
      const { data } = await db.storage.from("site-content").download("storefront/default-background");
      if (data) return new Response(await data.arrayBuffer(), {
        headers: { "Content-Type": data.type, "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff" },
      });
    }
  } catch {
    // A storage outage must not leave photo-less cards blank.
  }
  // Preserve the exact official artwork when no seasonal override is set.
  return new Response(null, { status: 307, headers: {
    Location: "/assets/updown-product-placeholder.svg", "Cache-Control": "no-store",
  } });
}
