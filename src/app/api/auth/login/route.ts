import { createServerClient } from "@supabase/ssr";
import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  let response: NextResponse = NextResponse.json({ ok: false }, { headers: { "Cache-Control": "no-store" } });
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      cookies: {
        getAll() { return request.cookies.getAll(); },
        setAll(cookiesToSet) {
          for (const { name, value, options } of cookiesToSet) {
            request.cookies.set(name, value);
            response.cookies.set(name, value, { ...options, path: "/" });
          }
        },
      },
    },
  );

  try {
    const body = await request.json();
    const email = typeof body.email === "string" ? body.email.trim() : "";
    const password = typeof body.password === "string" ? body.password : "";
    if (!email || !password) {
      return NextResponse.json({ error: "Ingresa correo y contraseña." }, { status: 400 });
    }

    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error || !data.user) {
      return NextResponse.json({ error: error?.message || "No fue posible autenticar." }, { status: 401 });
    }
    const { data: profile, error: profileError } = await supabase.from("profiles")
      .select("role,is_active").eq("id", data.user.id).single();
    if (profileError || !profile || !profile.is_active) {
      await supabase.auth.signOut();
      response = NextResponse.json({ error: "Tu cuenta no tiene acceso activo. Contacta al administrador." }, { status: 403 });
      return response;
    }

    // The auth cookies are explicitly attached to the same response returned to the browser.
    // Returning a new NextResponse here would discard the Set-Cookie headers.
    const sessionCookies = response.cookies.getAll();
    if (!sessionCookies.length) {
      return NextResponse.json({ error: "La sesión se autenticó, pero no se pudieron emitir cookies. Intenta nuevamente." }, { status: 500 });
    }
    const success = NextResponse.json({ ok: true, role: profile.role }, { headers: { "Cache-Control": "no-store" } });
    for (const cookie of sessionCookies) {
      success.cookies.set(cookie);
    }
    return success;
  } catch {
    return NextResponse.json({ error: "No se pudo completar el inicio de sesión. Intenta de nuevo." }, { status: 500 });
  }
}
