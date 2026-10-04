"use client";

import Image from "next/image";
import { useEffect, useState, type FormEvent } from "react";
import { createClient } from "@/lib/supabase/client";
import styles from "./services-admin.module.css";

type Service = {
  key: string; title_es: string; title_en: string; eyebrow_es: string; eyebrow_en: string;
  description_es: string; description_en: string; items_es: string[]; items_en: string[];
  cta_label_es: string; cta_label_en: string; cta_url_es: string; cta_url_en: string;
  note_es: string; note_en: string; image_url: string | null; is_active: boolean;
  sort_order: number; use_referral: boolean;
};
const imageExtensions: Record<string, string> = { "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp", "image/avif": "avif" };
const textFields = [
  ["title", "Título", false], ["eyebrow", "Subtítulo pequeño", false],
  ["description", "Descripción", true], ["items", "Lista de puntos (uno por renglón)", true],
  ["cta_label", "Nombre del CTA", false], ["cta_url", "Enlace del CTA", true], ["note", "Nota", true],
] as const;
function validLink(value: string) {
  if (!value) return true;
  if (/^#[A-Za-z]|^\/[^/\\]/.test(value)) return !/[\r\n\\]/.test(value);
  try { const url = new URL(value); return ["https:", "http:"].includes(url.protocol) && !url.username && !url.password; } catch { return false; }
}
function emptyService(order: number): Service {
  return { key: "", title_es: "", title_en: "", eyebrow_es: "", eyebrow_en: "", description_es: "", description_en: "", items_es: [], items_en: [], cta_label_es: "", cta_label_en: "", cta_url_es: "", cta_url_en: "", note_es: "", note_en: "", image_url: null, is_active: false, sort_order: order, use_referral: true };
}
function ServiceEditor({ service, onSaved, onCancel }: { service: Service; onSaved: (row: Service) => void; onCancel?: () => void }) {
  const protectedLesson = service.key === "classes";
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    if (!file) { setPreview(null); return; }
    const url = URL.createObjectURL(file); setPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);
  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); if (busy) return;
    const form = new FormData(event.currentTarget);
    const fields: Record<string, unknown> = {};
    if (!protectedLesson) {
      for (const [field] of textFields) for (const lang of ["es", "en"]) {
        const value = String(form.get(`${field}_${lang}`) || "").trim();
        fields[`${field}_${lang}`] = field === "items" ? value.split(/\r?\n/).map(text => text.trim()).filter(Boolean) : value;
      }
      if (!fields.title_es) { setFailed(true); setMessage("Escribe el título en español."); return; }
      for (const lang of ["es", "en"]) {
        const url = String(fields[`cta_url_${lang}`] || "");
        if (!validLink(url)) { setFailed(true); setMessage("El CTA debe usar un enlace http/https, una ruta del sitio o un ancla."); return; }
        if (Boolean(fields[`cta_label_${lang}`]) !== Boolean(url)) { setFailed(true); setMessage(`Completa tanto el nombre como el enlace del CTA en ${lang.toUpperCase()}, o deja ambos vacíos.`); return; }
      }
      const order = Number(form.get("sort_order"));
      if (!Number.isInteger(order) || order < 1 || order > 2147483647) { setFailed(true); setMessage("El índice debe ser un número entero mayor que cero."); return; }
      fields.sort_order = order; fields.is_active = form.get("is_active") === "on"; fields.use_referral = form.get("use_referral") === "on";
    } else if (!file) { setFailed(true); setMessage("Selecciona una foto para Clases de golf."); return; }
    setBusy(true); setFailed(false); setMessage("Guardando…");
    const db = createClient(); let uploadPath: string | null = null; let linked = false;
    try {
      if (file) {
        uploadPath = `services/${service.key || crypto.randomUUID()}/${crypto.randomUUID()}.${imageExtensions[file.type]}`;
        const { error } = await db.storage.from("site-content").upload(uploadPath, file, { contentType: file.type, cacheControl: "31536000", upsert: false });
        if (error) { uploadPath = null; throw error; }
        fields.image_url = db.storage.from("site-content").getPublicUrl(uploadPath).data.publicUrl;
      }
      const result = service.key
        ? await db.from("storefront_services").update(fields).eq("key", service.key).select("*").single()
        : await db.from("storefront_services").insert(fields).select("*").single();
      if (result.error || !result.data) throw result.error || new Error("No se pudo guardar el servicio.");
      linked = true; onSaved(result.data as Service); setFile(null); setMessage("Guardado. Los cambios aparecerán al recargar la tienda.");
    } catch (error) {
      if (uploadPath && !linked) await db.storage.from("site-content").remove([uploadPath]).catch(() => {});
      setFailed(true); setMessage(error instanceof Error ? error.message : "No se pudo guardar. Revisa tu sesión y vuelve a intentar.");
    } finally { setBusy(false); }
  }
  return (
    <form onSubmit={save} className={styles.editor} aria-busy={busy}>
      <fieldset disabled={busy} className={styles.fieldset}>
        <div className={styles.photo}>
          <div className={styles.preview}><Image src={preview || service.image_url || "/assets/category-placeholder.svg"} alt={`Foto de ${service.title_es || "nuevo servicio"}`} fill unoptimized sizes="240px" /></div>
          <label>Foto de la tarjeta<input type="file" accept="image/jpeg,image/png,image/webp,image/avif" onChange={event => {
            const selected = event.target.files?.[0]; event.target.value = ""; if (!selected) return;
            if (!imageExtensions[selected.type] || selected.size > 10 * 1024 * 1024) { setFailed(true); setMessage("Usa JPG, PNG, WebP o AVIF de hasta 10 MB."); return; }
            setFile(selected); setFailed(false); setMessage("Foto lista para guardar.");
          }} /></label><small>Recomendado: 1200 × 800 px. {file?.name}</small>
          {file ? <button type="button" onClick={() => { setFile(null); setMessage(""); }}>Descartar foto seleccionada</button> : null}
        </div>
        {protectedLesson ? <p className={styles.protected}>Clases de golf: solo puedes cambiar la foto. El contenido, el botón y su flujo de registro están protegidos.</p> : <>
          <div className={styles.settings}>
            <label>Índice de aparición<input name="sort_order" type="number" min="1" max="2147483647" step="1" required defaultValue={service.sort_order} /></label>
            <label><input name="is_active" type="checkbox" defaultChecked={service.is_active} /> Mostrar en la tienda</label>
            <label><input name="use_referral" type="checkbox" defaultChecked={service.use_referral} /> WhatsApp general: usar asesor de la referencia</label>
          </div>
          <p className={styles.hint}>El índice menor aparece primero. Los enlaces ya incluyen los mensajes actuales de WhatsApp. La opción de asesor aplica al contacto general; GHIN conserva su contacto especial. Si falta una traducción, la tienda muestra el contenido en español.</p>
          <div className={styles.languages}>{(["es", "en"] as const).map(lang => <section key={lang} aria-label={lang === "es" ? "Contenido en español" : "Contenido en inglés"}>
            <h3>{lang === "es" ? "Español" : "English"}</h3>
            {textFields.map(([field, label, multiline]) => {
              const name = `${field}_${lang}` as keyof Service; const raw = service[name]; const value = Array.isArray(raw) ? raw.join("\n") : String(raw || "");
              return <label key={field}>{label}{multiline ? <textarea name={name} rows={field === "items" ? 4 : 3} defaultValue={value} /> : <input name={name} defaultValue={value} required={field === "title" && lang === "es"} />}</label>;
            })}
          </section>)}</div>
        </>}
        <div className={styles.actions}><button type="submit">{busy ? "Guardando…" : "Guardar servicio"}</button>{onCancel ? <button type="button" onClick={onCancel}>Cancelar</button> : null}</div>
      </fieldset>
      <p className={failed ? styles.error : styles.feedback} role={failed ? "alert" : "status"}>{message}</p>
    </form>
  );
}
export default function ServicesAdmin() {
  const [rows, setRows] = useState<Service[]>([]); const [loading, setLoading] = useState(true);
  const [error, setError] = useState(""); const [reload, setReload] = useState(0); const [adding, setAdding] = useState(false);
  useEffect(() => {
    const controller = new AbortController(); setLoading(true); setError("");
    createClient().from("storefront_services").select("*").order("sort_order").order("key").abortSignal(controller.signal).then(({ data, error: queryError }) => {
      if (controller.signal.aborted) return;
      if (queryError) setError("No pudimos cargar los servicios. Revisa tu sesión y vuelve a intentar."); else setRows((data || []) as Service[]);
      setLoading(false);
    });
    return () => controller.abort();
  }, [reload]);
  function onSaved(row: Service) { setRows(current => [...current.filter(item => item.key !== row.key), row]); }
  const sorted = [...rows].sort((a, b) => a.sort_order - b.sort_order || a.key.localeCompare(b.key));
  return <section className={styles.section} aria-labelledby="services-admin-heading">
    <header className={styles.heading}><div><h2 id="services-admin-heading">Servicios</h2><p>Fotos, textos en ambos idiomas, enlaces y orden de aparición.</p></div><button type="button" disabled={loading || Boolean(error) || adding} onClick={() => setAdding(true)}>+ Agregar servicio</button></header>
    {loading ? <p role="status">Cargando servicios…</p> : error ? <div role="alert"><p>{error}</p><button onClick={() => setReload(value => value + 1)}>Volver a intentar</button></div> : <>
      {adding ? <ServiceEditor service={emptyService(Math.max(0, ...rows.map(row => row.sort_order)) + 1)} onSaved={row => { onSaved(row); setAdding(false); }} onCancel={() => setAdding(false)} /> : null}
      {sorted.map(row => <details className={styles.card} key={row.key}><summary><strong>{row.title_es}</strong><span>{row.key === "classes" ? "Solo foto · Contenido protegido" : `${row.is_active ? "Visible" : "Oculto"} · Índice ${row.sort_order}`}</span></summary><ServiceEditor service={row} onSaved={onSaved} /></details>)}
      {!rows.length ? <p>No hay servicios registrados.</p> : null}
    </>}
  </section>;
}
