"use client";

import { FormEvent, useState } from "react";
import { createClient } from "@/lib/supabase/client";

export default function LoginForm({ nextPath }: { nextPath: string }) {
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (loading) return;
    setError("");
    setLoading(true);

    try {
      const form = new FormData(event.currentTarget);
      const email = String(form.get("email") || "").trim();
      const password = String(form.get("password") || "");
      const supabase = createClient();
      const { data, error: signInError } = await supabase.auth.signInWithPassword({ email, password });
      if (signInError) throw signInError;
      if (!data.session) throw new Error("No se pudo establecer la sesión. Intenta nuevamente.");

      // Verify that the browser client can read the newly persisted session
      // before making a full document request to the protected server route.
      const { data: persisted, error: sessionError } = await supabase.auth.getSession();
      if (sessionError) throw sessionError;
      if (!persisted.session) throw new Error("La sesión no se guardó en este navegador. Revisa las cookies.");

      // Full navigation ensures the server receives the latest auth cookies.
      // Avoid a prefetched/previously cached unauthenticated RSC response.
      const destination = nextPath.startsWith("/") && !nextPath.startsWith("//") && !nextPath.startsWith("/\\")
        ? nextPath : "/admin";
      window.location.assign(destination);
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo iniciar sesión.");
      setLoading(false);
    }
  }

  return (
    <form onSubmit={submit} className="grid">
      <label>Correo<input name="email" type="email" autoComplete="email" required /></label>
      <label>Contraseña<input name="password" type="password" autoComplete="current-password" required /></label>
      {error ? <p role="alert">{error}</p> : null}
      <button disabled={loading} type="submit">{loading ? "Entrando…" : "Entrar"}</button>
    </form>
  );
}
