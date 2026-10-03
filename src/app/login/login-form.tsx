"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export default function LoginForm({ nextPath }: { nextPath: string }) {
  const router = useRouter();
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);
  const [resetting, setResetting] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setMessage("");
    setLoading(true);

    const form = new FormData(event.currentTarget);
    const email = String(form.get("email") || "").trim();
    const password = String(form.get("password") || "");

    const supabase = createClient();
    const { error } = await supabase.auth.signInWithPassword({ email, password });

    if (error) {
      setError(error.message);
      setLoading(false);
      return;
    }

    router.replace(nextPath.startsWith("/") ? nextPath : "/");
    router.refresh();
  }

  async function resetPassword() {
    setError("");
    setMessage("");
    const input = document.querySelector<HTMLInputElement>('input[name="email"]');
    const email = input?.value.trim() || "";
    if (!email) {
      setError("Escribe tu correo para enviarte el enlace de recuperación.");
      input?.focus();
      return;
    }

    setResetting(true);
    const supabase = createClient();
    const redirectTo = `${window.location.origin}/restablecer-contrasena`;
    const { error } = await supabase.auth.resetPasswordForEmail(email, { redirectTo });
    setResetting(false);

    if (error) {
      setError(error.message);
      return;
    }
    setMessage("Te enviamos un enlace para cambiar tu contraseña. Revisa tu correo.");
  }

  return (
    <form onSubmit={submit} className="grid">
      <label>
        Correo
        <input name="email" type="email" autoComplete="email" required />
      </label>

      <label>
        Contraseña
        <input name="password" type="password" autoComplete="current-password" required />
      </label>

      <button type="button" onClick={resetPassword} disabled={resetting} style={{background:"none",border:0,padding:0,textAlign:"left",textDecoration:"underline",cursor:"pointer"}}>
        {resetting ? "Enviando enlace…" : "¿Olvidaste tu contraseña?"}
      </button>

      {error ? <p role="alert">{error}</p> : null}
      {message ? <p role="status">{message}</p> : null}

      <button disabled={loading} type="submit">
        {loading ? "Entrando…" : "Entrar"}
      </button>
    </form>
  );
}
