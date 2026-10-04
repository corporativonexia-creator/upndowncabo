"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import ServicesAdmin from "./services-admin";
import AdminSectionNav from "./admin-section-nav";
import styles from "./category-images-admin.module.css";

type Category = { id: string; name: string; slug: string; image_url: string | null; is_active: boolean };
const labels: Record<string, string> = { drivers: "Drivers", maderas: "Fairway Woods", hibridos: "Hybrids", hierros: "Irons", wedges: "Wedges", putters: "Putters", bolsas: "Golf Bags", carritos: "Golf Carts", zapatos: "Golf Shoes", guantes: "Gloves", pelotas: "Golf Balls", accesorios: "Accessories", ropa: "Apparel", "equipos-completos": "Complete Sets" };
const mimeExtensions: Record<string, string> = { "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp", "image/avif": "avif" };
const MAX_FILE_BYTES = 10 * 1024 * 1024;

function CategoryImageCard({ category, onSaved }: { category: Category; onSaved: (id: string, url: string) => void }) {
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [feedback, setFeedback] = useState("");
  const [failed, setFailed] = useState(false);
  const name = labels[category.slug] || category.name;

  useEffect(() => {
    if (!file) { setPreview(null); return; }
    const url = URL.createObjectURL(file);
    setPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);

  function chooseFile(selected?: File) {
    if (!selected) return;
    setFailed(false);
    if (!mimeExtensions[selected.type]) { setFile(null); setFeedback("Usa una imagen JPG, PNG, WebP o AVIF."); setFailed(true); return; }
    if (selected.size > MAX_FILE_BYTES) { setFile(null); setFeedback("La imagen debe pesar como máximo 10 MB."); setFailed(true); return; }
    setFile(selected);
    setFeedback("Imagen lista para guardar.");
  }

  async function save() {
    if (!file || busy) return;
    setBusy(true); setFailed(false); setFeedback("Subiendo imagen…");
    const db = createClient();
    const path = `categories/${category.id}/${crypto.randomUUID()}.${mimeExtensions[file.type]}`;
    let uploaded = false;
    let linked = false;
    try {
      const { error: uploadError } = await db.storage.from("site-content").upload(path, file, { contentType: file.type, cacheControl: "31536000", upsert: false });
      if (uploadError) throw uploadError;
      uploaded = true;
      const url = db.storage.from("site-content").getPublicUrl(path).data.publicUrl;
      const { data, error: updateError } = await db.from("categories").update({ image_url: url }).eq("id", category.id).select("image_url").single();
      if (updateError || !data?.image_url) throw updateError || new Error("No fue posible guardar la imagen de esta categoría.");
      linked = true;
      onSaved(category.id, data.image_url);
      setFile(null);
      setFeedback("Guardada. La nueva imagen aparecerá al recargar la tienda.");
    } catch (error) {
      if (uploaded && !linked) await db.storage.from("site-content").remove([path]).catch(() => {});
      setFailed(true);
      setFeedback(error instanceof Error ? error.message : "No fue posible guardar. Revisa tu conexión y vuelve a intentar.");
    } finally { setBusy(false); }
  }

  return (
    <article className={styles.card} aria-busy={busy}>
      <div className={styles.preview}>
        <Image src={preview || category.image_url || "/assets/category-placeholder.svg"} alt={`Imagen de ${name}`} fill unoptimized sizes="(max-width:600px) 100vw, (max-width:1000px) 50vw, 25vw" />
        <span>{name}</span>
      </div>
      <div className={styles.body}>
        <div className={styles.cardTitle}><h2>{name}</h2>{!category.is_active ? <small>Inactiva</small> : null}</div>
        <p>{category.image_url ? "Imagen fija de la tienda" : "Todavía no tiene imagen"}</p>
        <label className={styles.choose} aria-disabled={busy}>
          {category.image_url ? "Cambiar imagen" : "Seleccionar imagen"}
          <input type="file" accept="image/jpeg,image/png,image/webp,image/avif" disabled={busy} onChange={event => { chooseFile(event.target.files?.[0]); event.target.value = ""; }} aria-label={`Seleccionar imagen de ${name}`} />
        </label>
        {file ? <div className={styles.pending}><span>{file.name}</span><div className={styles.actions}><button type="button" disabled={busy} onClick={save}>{busy ? "Guardando…" : "Guardar imagen"}</button><button type="button" disabled={busy} onClick={() => { setFile(null); setFeedback(""); setFailed(false); }}>Cancelar</button></div></div> : null}
        <p className={failed ? styles.error : styles.feedback} role={failed ? "alert" : "status"}>{feedback}</p>
      </div>
    </article>
  );
}

export default function CategoryImagesAdmin() {
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [reload, setReload] = useState(0);

  useEffect(() => {
    const controller = new AbortController();
    setLoading(true); setError("");
    createClient().from("categories").select("id,name,slug,image_url,is_active").order("sort_order").abortSignal(controller.signal).then(({ data, error: queryError }) => {
      if (controller.signal.aborted) return;
      if (queryError) setError("No pudimos cargar las categorías. Vuelve a intentar o revisa tu sesión.");
      else setCategories(data || []);
      setLoading(false);
    });
    return () => controller.abort();
  }, [reload]);

  function onSaved(id: string, url: string) { setCategories(current => current.map(category => category.id === id ? { ...category, image_url: url } : category)); }

  return (
    <main className={styles.page}>
      <AdminSectionNav active="Categorías y servicios" />
      <header className={styles.heading}><div><h1>Categorías y servicios</h1><p>Administra las fotos de categorías y las tarjetas de servicios.</p><small>JPG, PNG, WebP o AVIF · Máximo 10 MB · Recomendado: 1200 × 1200 px, con el producto centrado.</small></div><Link href="/vista-previa" target="_blank" rel="noopener noreferrer">Ver tienda ↗</Link></header>
      <h2>Imágenes de categorías</h2><p>Una imagen fija por categoría. Puedes reemplazarla cuando lo necesites.</p>
      {loading ? <p role="status">Cargando categorías…</p> : error ? <div role="alert"><p>{error}</p><button type="button" onClick={() => setReload(value => value + 1)}>Volver a intentar</button></div> : <div className={styles.grid}>{categories.map(category => <CategoryImageCard key={category.id} category={category} onSaved={onSaved} />)}</div>}
      {!loading && !error && categories.length === 0 ? <p>No hay categorías registradas.</p> : null}
      <ServicesAdmin />
    </main>
  );
}
