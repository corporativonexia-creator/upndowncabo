import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export type UpDownRole = "admin" | "seller";

export async function requireRole(
  role: UpDownRole,
  returnTo: string,
) {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect(`/login?next=${encodeURIComponent(returnTo)}`);
  }

  const { data: profile, error } = await supabase
    .from("profiles")
    .select("id,full_name,role,is_active")
    .eq("id", user.id)
    .single();

  if (
    error ||
    !profile ||
    profile.is_active !== true ||
    profile.role !== role
  ) {
    redirect("/unauthorized");
  }

  return { user, profile, supabase };
}
