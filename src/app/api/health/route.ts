import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET() {
  const supabase = await createClient();

  const { count, error } = await supabase
    .from("products")
    .select("id", { count: "exact", head: true })
    .eq("status", "active");

  if (error) {
    return NextResponse.json(
      { ok: false, supabase: false, error: error.message },
      { status: 500 },
    );
  }

  return NextResponse.json({
    ok: true,
    supabase: true,
    active_products: count ?? 0,
  });
}
