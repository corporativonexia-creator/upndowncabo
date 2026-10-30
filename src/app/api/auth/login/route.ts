import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const email = typeof body.email === "string" ? body.email.trim() : "";
    const password = typeof body.password === "string" ? body.password : "";
    if (!email || !password) {
      return NextResponse.json({ error: "Ingresa correo y contraseña." }, { status: 400 });
    }
    const supabase = await createClient();
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error || !data.user) {
      return NextResponse.json({ error: error?.message || "No fue posible autenticar." }, { status: 401 });
    }
    const { data: profile, error: profileError } = await supabase.from("profiles")
      .select("role,is_active").eq("id", data.user.id).single();
    if (profileError || !profile || !profile.is_active) {
      await supabase.auth.signOut();
      return NextResponse.json({ error: "Tu cuenta no tiene acceso activo. Contacta al administrador." }, { status: 403 });
    }
    return NextResponse.json({ ok: true, role: profile.role }, { headers: { "Cache-Control": "no-store" } });
  } catch {
    return NextResponse.json({ error: "No se pudo completar el inicio de sesión. Intenta de nuevo." }, { status: 500 });
  }
}
