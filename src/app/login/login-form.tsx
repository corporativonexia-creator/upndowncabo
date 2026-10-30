"use client";

import { FormEvent, useState } from "react";

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
      const response = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "same-origin",
        cache: "no-store",
        body: JSON.stringify({
          email: String(form.get("email") || "").trim(),
          password: String(form.get("password") || ""),
        }),
      });
      const result = await response.json();
      if (!response.ok || !result.ok) throw new Error(result.error || "No se pudo iniciar sesión.");
      const requested = nextPath.startsWith("/") && !nextPath.startsWith("//") && !nextPath.startsWith("/\\")
        ? nextPath : "/admin";
      const destination = result.role === "admin" ? (requested === "/vendedor" ? "/admin" : requested)
        : result.role === "seller" ? "/vendedor" : "/unauthorized";
      window.location.replace(destination);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error de conexión al iniciar sesión.");
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
