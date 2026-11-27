"use client";

import { useEffect, useState } from "react";
import styles from "./category-images-admin.module.css";

export default function DefaultBackgroundCard() {
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState("");
  const [version, setVersion] = useState(0);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    if (!file) return;
    const objectUrl = URL.createObjectURL(file);
    // eslint-disable-next-line react-hooks/set-state-in-effect -- Synchronize and release the selected file preview.
    setPreview(objectUrl);
    return () => URL.revokeObjectURL(objectUrl);
  }, [file]);

  async function save(reset = false) {
    if (busy || (!reset && !file)) return;
    setBusy(true); setMessage(""); setFailed(false);
    try {
      const body = new FormData();
      if (file) body.set("image", file);
      const response = await fetch("/api/admin/default-background", {
        method: reset ? "DELETE" : "POST", body: reset ? undefined : body,
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "No fue posible guardar el fondo.");
      setFile(null); setPreview(""); setVersion(Date.now());
      setMessage(reset ? "Fondo oficial restaurado. Recarga la tienda para verlo." : "Fondo guardado. Recarga la tienda para verlo en las tarjetas sin foto.");
    } catch (error) {
      setFailed(true); setMessage(error instanceof Error ? error.message : "No fue posible guardar el fondo.");
    } finally { setBusy(false); }
  }

  return <article className={styles.card} aria-busy={busy}>
    <div className={styles.preview}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={preview || `/api/storefront/default-background?v=${version}`} alt="Fondo predeterminado de tarjetas sin foto" style={{ width: "100%", height: "100%", objectFit: "contain" }} />
      <span>Fondo predeterminado</span>
    </div>
    <div className={styles.body}>
      <div className={styles.cardTitle}><h2>Fondo predeterminado</h2><small>Configuración</small></div>
      <p>Para tarjetas sin fotografía. Cámbialo por temporada o evento. No aparece como categoría ni reemplaza las fotos cargadas.</p>
      <label className={styles.choose} aria-disabled={busy}>Cambiar fondo
        <input type="file" accept="image/jpeg,image/png,image/webp" disabled={busy} aria-label="Seleccionar fondo predeterminado" onChange={event => {
          const selected = event.target.files?.[0]; event.target.value = "";
          if (!selected) return;
          if (!["image/jpeg", "image/png", "image/webp"].includes(selected.type) || selected.size > 10 * 1024 * 1024) {
            setFile(null); setPreview(""); setFailed(true); setMessage("Usa JPG, PNG o WebP de hasta 10 MB."); return;
          }
          setFile(selected); setFailed(false); setMessage("");
        }} />
      </label>
      {file && <div className={styles.pending}><span>{file.name}</span><div className={styles.actions}>
        <button disabled={busy} onClick={() => save()}>Guardar fondo</button>
        <button disabled={busy} onClick={() => { setFile(null); setPreview(""); }}>Cancelar</button>
      </div></div>}
      <div className={styles.actions} style={{ marginTop: 12 }}><button disabled={busy} onClick={() => save(true)}>Restaurar fondo oficial</button></div>
      <p className={failed ? styles.error : styles.feedback} role={failed ? "alert" : "status"}>{busy ? "Guardando…" : message}</p>
    </div>
  </article>;
}
