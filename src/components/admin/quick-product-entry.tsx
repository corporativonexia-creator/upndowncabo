"use client";

import { ChangeEvent, FormEvent, useCallback, useEffect, useMemo, useRef, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import styles from "./quick-product-entry.module.css";

type Category = { id: string; name: string; variant_schema: string[] };
type Match = { product_id: string; product_name: string; variant_id: string | null; variant_title: string; sku: string; barcode: string; stock: number; price: number; status: string };
type Photo = { id: string; file: File; url: string; uploaded?: string };
type Variant = { id: string; title: string; barcode: string; quantity: string; attributes: Record<string, string> };
type Capture = { request: string; name: string; category: string; price: number; barcode: string; quantity: number; photos: Photo[]; variants: Variant[] };
const labels: Record<string, string> = { talla: "Talla", color: "Color", genero: "Género", mano: "Mano", loft: "Loft", flex: "Flex", longitud: "Longitud" };
const money = (n: number) => new Intl.NumberFormat("es-MX", { style: "currency", currency: "MXN" }).format(n);
const freshVariant = (): Variant => ({ id: crypto.randomUUID(), title: "", barcode: "", quantity: "0", attributes: {} });
function friendly(error: unknown) {
  const m = error instanceof Error ? error.message : typeof error === "object" && error && "message" in error ? String(error.message) : String(error);
  const messages: Record<string, string> = { DUPLICATE_BARCODE: "Ese código ya existe. Búscalo para registrar una entrada de inventario.", ADMIN_REQUIRED: "Tu sesión necesita permisos de administrador. Vuelve a iniciar sesión.", INVALID_BARCODE: "Usa un código de 3 a 80 caracteres, sin espacios.", CATEGORY_REQUIRED: "Selecciona una categoría activa.", PRICE_REQUIRED: "Escribe un precio de venta mayor a cero.", INVALID_QUANTITY: "La cantidad debe ser un número entero positivo o cero.", VARIANT_TITLE_REQUIRED: "Escribe la talla, color o nombre de cada variante.", REASON_REQUIRED: "Agrega una referencia de al menos 3 caracteres." };
  return Object.entries(messages).find(([key]) => m.includes(key))?.[1] || m;
}

async function preparePhoto(file: File): Promise<File> {
  if (file.size > 20 * 1024 * 1024) throw new Error(`${file.name} supera 20 MB.`);
  let source: Blob = file;
  if (/\.(heic|heif)$/i.test(file.name) || /image\/hei[cf]/i.test(file.type)) {
    const { heicTo } = await import("heic-to/next");
    source = await heicTo({ blob: file, type: "image/jpeg", quality: 0.88 });
  } else if (!file.type.startsWith("image/") || file.type === "image/svg+xml") {
    throw new Error("Selecciona una foto JPG, PNG, WebP o HEIC.");
  }
  const url = URL.createObjectURL(source);
  try {
    const img = new window.Image();
    img.src = url;
    await img.decode();
    const scale = Math.min(1, 2200 / Math.max(img.naturalWidth, img.naturalHeight));
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.round(img.naturalWidth * scale));
    canvas.height = Math.max(1, Math.round(img.naturalHeight * scale));
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("No se pudo preparar la foto.");
    ctx.fillStyle = "white"; ctx.fillRect(0, 0, canvas.width, canvas.height); ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
    const blob = await new Promise<Blob | null>(resolve => canvas.toBlob(resolve, "image/jpeg", 0.88));
    if (!blob) throw new Error("No se pudo comprimir la foto.");
    return new File([blob], `${file.name.replace(/\.[^.]+$/, "")}.jpg`, { type: "image/jpeg" });
  } finally { URL.revokeObjectURL(url); }
}

function BarcodeCamera({ onCode, onClose }: { onCode: (code: string) => void; onClose: () => void }) {
  const video = useRef<HTMLVideoElement>(null);
  const [error, setError] = useState("");
  const closeRef = useRef(onClose); closeRef.current = onClose;
  const codeRef = useRef(onCode); codeRef.current = onCode;
  useEffect(() => {
    let cancelled = false;
    let stop: (() => void) | undefined;
    let stream: MediaStream | undefined;
    const keydown = (event: KeyboardEvent) => { if (event.key === "Escape") closeRef.current(); };
    document.addEventListener("keydown", keydown);
    (async () => {
      if (!navigator.mediaDevices?.getUserMedia) throw new Error("La cámara necesita HTTPS y permiso del navegador. Puedes escribir el código o usar un lector.");
      const { BrowserMultiFormatReader } = await import("@zxing/browser");
      if (cancelled) return;
      stream = await navigator.mediaDevices.getUserMedia({ audio: false, video: { facingMode: { ideal: "environment" }, width: { ideal: 1280 } } });
      if (cancelled) { stream.getTracks().forEach(t => t.stop()); return; }
      const reader = new BrowserMultiFormatReader();
      const controls = await reader.decodeFromStream(stream, video.current!, (result, _error, controls) => {
        if (result && !cancelled) { cancelled = true; controls.stop(); codeRef.current(result.getText()); }
      });
      stop = () => controls.stop();
      if (cancelled) stop();
    })().catch(e => { if (!cancelled) setError(`No se pudo abrir la cámara. Revisa sus permisos o escribe el código. ${friendly(e)}`); });
    return () => { cancelled = true; stop?.(); stream?.getTracks().forEach(t => t.stop()); document.removeEventListener("keydown", keydown); };
  }, []);
  return <div className={styles.overlay} role="dialog" aria-modal="true" aria-labelledby="scanner-title"><section className={styles.camera}><header><h2 id="scanner-title">Escanear código</h2><button type="button" autoFocus onClick={onClose} aria-label="Cerrar cámara">✕</button></header><video ref={video} muted playsInline autoPlay /><p role={error ? "alert" : undefined}>{error || "Centra el código en la cámara. Se capturará automáticamente."}</p><button type="button" onClick={onClose}>Escribir código manualmente</button></section></div>;
}

export default function QuickProductEntry() {
  const db = useMemo(() => createClient(), []);
  const [categories, setCategories] = useState<Category[]>([]);
  const [ready, setReady] = useState(false);
  const [name, setName] = useState(""); const [category, setCategory] = useState("");
  const [price, setPrice] = useState(""); const [barcode, setBarcode] = useState(""); const [quantity, setQuantity] = useState("0");
  const [photos, setPhotos] = useState<Photo[]>([]); const photosRef = useRef<Photo[]>([]);
  const [hasVariants, setHasVariants] = useState(false); const [variants, setVariants] = useState<Variant[]>([]);
  const [matches, setMatches] = useState<Match[]>([]); const [match, setMatch] = useState<Match | null>(null);
  const [receiving, setReceiving] = useState("1"); const [reason, setReason] = useState("Entrada desde alta rápida móvil");
  const [busy, setBusy] = useState(false); const [processing, setProcessing] = useState(false); const [checking, setChecking] = useState(false);
  const [error, setError] = useState(""); const [success, setSuccess] = useState(""); const [count, setCount] = useState(0);
  const [pending, setPending] = useState(false); const [scanner, setScanner] = useState<string | null>(null);
  const [drafts, setDrafts] = useState(0); const [active, setActive] = useState(0);
  const nameInput = useRef<HTMLInputElement>(null); const codeInput = useRef<HTMLInputElement>(null);
  const lookupVersion = useRef(0); const busyRef = useRef(false); const processingRef = useRef(false);
  const captureRef = useRef<Capture | null>(null);
  const receiveRef = useRef<{ request: string; variant: string; quantity: number; reason: string } | null>(null);
  const fields = categories.find(c => c.id === category)?.variant_schema || [];
  const locked = busy || processing || pending;

  const refreshCounts = useCallback(async () => {
    const results = await Promise.all([db.from("products").select("id", { count: "exact", head: true }).eq("status", "draft"), db.from("products").select("id", { count: "exact", head: true }).eq("status", "active")]);
    if (!results[0].error) setDrafts(results[0].count || 0);
    if (!results[1].error) setActive(results[1].count || 0);
  }, [db]);
  useEffect(() => {
    let alive = true;
    db.from("categories").select("id,name,variant_schema").eq("is_active", true).order("sort_order").then(({ data, error }) => {
      if (!alive) return;
      if (error) setError(friendly(error)); else { setCategories(data || []); setReady(true); }
    });
    void refreshCounts();
    return () => { alive = false; };
  }, [db, refreshCounts]);
  useEffect(() => { photosRef.current = photos; }, [photos]);
  useEffect(() => () => photosRef.current.forEach(p => URL.revokeObjectURL(p.url)), []);
  useEffect(() => {
    const handler = (e: BeforeUnloadEvent) => { if (name || photosRef.current.length || captureRef.current || receiveRef.current) { e.preventDefault(); e.returnValue = ""; } };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [name]);

  async function lookup(code: string) {
    const version = ++lookupVersion.current;
    setMatches([]); setMatch(null); setError("");
    if (!code.trim()) { setChecking(false); return []; }
    setChecking(true);
    try {
      const { data, error } = await db.rpc("admin_quick_barcode_lookup", { p_barcode: code.trim() });
      if (error) throw error;
      const rows = (data?.rows || []) as Match[];
      if (version === lookupVersion.current) { setMatches(rows); setMatch(rows.length === 1 ? rows[0] : null); }
      return rows;
    } catch (e) { if (version === lookupVersion.current) setError(friendly(e)); throw e; }
    finally { if (version === lookupVersion.current) setChecking(false); }
  }
  function changeCode(value: string) { ++lookupVersion.current; setBarcode(value); setMatch(null); setMatches([]); setChecking(false); }
  async function generateCode(target?: string) {
    if (busyRef.current || processingRef.current) return;
    busyRef.current = true; setBusy(true); setError("");
    try {
      const { data, error } = await db.rpc("next_internal_barcode"); if (error) throw error;
      if (target) setVariants(rows => rows.map(row => row.id === target ? { ...row, barcode: String(data) } : row));
      else changeCode(String(data));
    } catch (e) { setError(friendly(e)); }
    finally { busyRef.current = false; setBusy(false); }
  }
  async function addPhotos(event: ChangeEvent<HTMLInputElement>) {
    const files = [...(event.target.files || [])]; event.target.value = "";
    if (!files.length || busyRef.current || processingRef.current || pending) return;
    processingRef.current = true; setProcessing(true); setError("");
    const added: Photo[] = [];
    try {
      const available = 10 - photosRef.current.length;
      for (const file of files.slice(0, available)) {
        try { const normalized = await preparePhoto(file); added.push({ id: crypto.randomUUID(), file: normalized, url: URL.createObjectURL(normalized) }); }
        catch (e) { setError(friendly(e)); }
      }
      setPhotos(old => [...old, ...added]);
      if (files.length > available) setError("Se pueden agregar hasta 10 fotos por producto.");
    } finally { processingRef.current = false; setProcessing(false); }
  }
  function clearProduct() {
    photosRef.current.forEach(p => URL.revokeObjectURL(p.url)); setPhotos([]); photosRef.current = [];
    setName(""); setBarcode(""); setQuantity("0"); setVariants([]); setHasVariants(false);
    setMatches([]); setMatch(null); setPending(false); captureRef.current = null;
    // Keep category and price for consecutive captures from the same batch.
    requestAnimationFrame(() => nameInput.current?.focus());
  }
  async function saveProduct(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); if (busyRef.current || processingRef.current) return;
    busyRef.current = true; setBusy(true); setError(""); setSuccess("");
    try {
      if (!captureRef.current) {
        if (barcode.trim() && (await lookup(barcode)).length) return;
        if (!Number.isInteger(Number(quantity)) || Number(quantity) < 0) throw new Error("La cantidad debe ser un número entero positivo o cero.");
        if (hasVariants && !variants.length) throw new Error("Agrega al menos una variante.");
        if (variants.some(v => !Number.isInteger(Number(v.quantity)) || Number(v.quantity) < 0)) throw new Error("Revisa las cantidades de las variantes.");
        captureRef.current = { request: crypto.randomUUID(), name: name.trim(), category, price: Number(price), barcode: barcode.trim(), quantity: Number(quantity), photos: photos.map(p => ({ ...p })), variants: hasVariants ? variants.map(v => ({ ...v })) : [] };
        setPending(true);
      }
      const capture = captureRef.current;
      for (const photo of capture.photos) {
        if (photo.uploaded) continue;
        const path = `products/quick/${capture.request}/${photo.id}.jpg`;
        const { error } = await db.storage.from("product-media").upload(path, photo.file, { contentType: "image/jpeg", upsert: true });
        if (error) throw error;
        photo.uploaded = db.storage.from("product-media").getPublicUrl(path).data.publicUrl;
      }
      const { data, error } = await db.rpc("admin_quick_product_create", {
        p_request_id: capture.request, p_name: capture.name, p_category_id: capture.category, p_price: capture.price,
        p_barcode: capture.barcode || null, p_quantity: capture.quantity,
        p_images: capture.photos.map(p => p.uploaded!), p_variants: capture.variants.map(v => ({ title: v.title.trim(), barcode: v.barcode || null, quantity: Number(v.quantity), attributes: v.attributes }))
      });
      if (error) {
        // SQL errors roll back the whole transaction. Network failures retain the
        // exact request and uploaded files so the same operation can be retried.
        if (error.code && !error.code.startsWith("PGRST") && error.code !== "") { captureRef.current = null; setPending(false); }
        throw error;
      }
      setSuccess(`✓ ${data.name} registrado como borrador · SKU ${data.sku}${capture.variants.length ? ` · ${capture.variants.length} variantes` : ` · ${capture.quantity} piezas`} · código ${data.barcode}`);
      setCount(n => n + 1); clearProduct(); void refreshCounts();
    } catch (e) { setError(friendly(e)); }
    finally { busyRef.current = false; setBusy(false); }
  }
  async function receive(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); if (!match?.variant_id || busyRef.current) return;
    busyRef.current = true; setBusy(true); setError(""); setSuccess("");
    try {
      if (!receiveRef.current) receiveRef.current = { request: crypto.randomUUID(), variant: match.variant_id, quantity: Number(receiving), reason };
      setPending(true);
      const request = receiveRef.current;
      const { data, error } = await db.rpc("admin_quick_inventory_receive", { p_request_id: request.request, p_variant_id: request.variant, p_quantity: request.quantity, p_reason: request.reason });
      if (error) { if (error.code && !error.code.startsWith("PGRST")) { receiveRef.current = null; setPending(false); } throw error; }
      setSuccess(`✓ Entrada registrada: ${match.product_name} · ${match.variant_title} · ${data.stock_before} → ${data.stock_after} piezas.`);
      receiveRef.current = null; setPending(false); changeCode(""); setReceiving("1"); requestAnimationFrame(() => codeInput.current?.focus());
    } catch (e) { setError(friendly(e)); }
    finally { busyRef.current = false; setBusy(false); }
  }
  const updateVariant = (id: string, patch: Partial<Variant>) => setVariants(rows => rows.map(v => v.id === id ? { ...v, ...patch } : v));

  return <main className={styles.page}><div className={styles.wrap}>
    <header className={styles.header}><Link href="/admin" className={styles.brand}>UP AND DOWN</Link><Link href="/admin/inventario">Inventario ↗</Link></header>
    <section className={styles.hero}><div className={styles.eyebrow}>PRODUCTOS / CAPTURA MÓVIL</div><h1>Alta rápida</h1><p>Captura mercancía y continúa con el siguiente artículo.</p><div className={styles.stats}><span>{active} activos</span><span className={styles.badge}>{drafts} borradores por completar</span><span>{count} capturados en esta sesión</span></div></section>
    <div className={styles.notice}><b>Borrador por default</b><span>Disponible en Productos e Inventario. Completa la ficha desde el catálogo para publicarlo.</span></div>
    {success && <div className={styles.success} role="status">{success}</div>}
    {error && <div className={styles.error} role="alert">{error}</div>}
    {pending && !busy && <p className={styles.notice}>La captura quedó pendiente. Reintenta el mismo guardado para confirmar el resultado sin duplicarlo.</p>}
    <section className={styles.card}>
      <label className={styles.label} htmlFor="quick-barcode">Código de barras</label>
      <div className={styles.codeRow}><input id="quick-barcode" ref={codeInput} value={barcode} maxLength={80} disabled={locked} placeholder="Escanea, escribe o genera un código" autoComplete="off" onChange={e => changeCode(e.target.value)} onBlur={() => { if (!locked) void lookup(barcode).catch(() => {}); }} onKeyDown={e => { if (e.key === "Enter") { e.preventDefault(); void lookup(barcode).catch(() => {}); } }} /><button type="button" disabled={locked} onClick={() => void lookup(barcode).catch(() => {})}>Buscar</button></div>
      <div className={styles.tools}><button type="button" disabled={locked} onClick={() => setScanner("main")}>▣ Escanear con cámara</button><button type="button" disabled={locked} onClick={() => void generateCode()}>＋ Generar código</button></div><small>Si lo dejas vacío, generaremos un EAN-13 interno al guardar. También puedes usar un lector USB o Bluetooth.</small>
      {checking && <p role="status">Buscando código…</p>}
      {matches.length > 1 && <label className={styles.label}>Selecciona la variante<select disabled={locked} value={match?.variant_id || ""} onChange={e => setMatch(matches.find(m => m.variant_id === e.target.value) || null)}><option value="">Elegir variante…</option>{matches.map((m, i) => <option key={m.variant_id || i} value={m.variant_id || ""}>{m.product_name} · {m.variant_title} · {m.sku}</option>)}</select></label>}
      {match && <div className={styles.found}><div className={styles.eyebrow}>CÓDIGO YA REGISTRADO</div><h2>{match.product_name}</h2><p>{match.variant_title} · {match.sku} · {money(match.price)}</p><strong>Existencia actual: {match.stock}</strong>
        {match.variant_id ? <form onSubmit={receive}><fieldset disabled={locked}><label>Cantidad recibida<input type="number" min="1" step="1" required value={receiving} onChange={e => setReceiving(e.target.value)} /></label><label>Referencia<input required minLength={3} value={reason} onChange={e => setReason(e.target.value)} /></label><p>Nueva existencia estimada: <b>{Number(match.stock) + Number(receiving || 0)}</b></p></fieldset><button className={styles.primary} disabled={busy || processing} type="submit">{busy ? "Registrando…" : pending ? "Reintentar entrada" : "Registrar entrada de inventario"}</button></form> : <p>Este producto necesita una variante de inventario. Complétala desde <Link href="/admin">Productos</Link>.</p>}
      </div>}
    </section>
    {!matches.length && <form onSubmit={saveProduct} className={styles.card}>
      <fieldset disabled={locked}>
        <label>Nombre del producto<input ref={nameInput} value={name} onChange={e => setName(e.target.value)} required minLength={2} maxLength={180} placeholder="Ej. Polo Nike Dri-FIT" /></label>
        <div className={styles.grid}><label>Categoría<select value={category} onChange={e => setCategory(e.target.value)} required><option value="">Seleccionar…</option>{categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}</select></label><label>Precio de venta · MXN<input type="number" inputMode="decimal" value={price} onChange={e => setPrice(e.target.value)} min="0.01" max="99999999" step="0.01" required placeholder="0.00" /></label></div>
        <div className={styles.photoHead}><label>Fotos <small>{photos.length} / 10 · opcionales en borrador</small></label></div>
        <div className={styles.tools}><label className={styles.fileButton}>▣ Tomar foto<input type="file" accept="image/*,.heic,.heif" capture="environment" onChange={addPhotos} /></label><label className={styles.fileButton}>＋ Elegir de galería<input type="file" accept="image/*,.heic,.heif" multiple onChange={addPhotos} /></label></div>
        {processing && <p role="status">Preparando fotos…</p>}
        {!!photos.length && <div className={styles.photos}>{photos.map((photo, index) => <div key={photo.id}><Image src={photo.url} width={120} height={120} unoptimized alt={`Foto ${index + 1} de ${name || "producto"}`} /><button type="button" aria-label={`Quitar foto ${index + 1}`} onClick={() => { URL.revokeObjectURL(photo.url); setPhotos(old => old.filter(p => p.id !== photo.id)); }}>✕</button>{index === 0 && <span>Principal</span>}</div>)}</div>}
        <label className={styles.toggle}><input type="checkbox" checked={hasVariants} onChange={e => { setHasVariants(e.target.checked); if (e.target.checked && !variants.length) setVariants([freshVariant()]); }} />Tiene variantes (talla, color u otras)</label>
        {!hasVariants ? <label>Cantidad inicial<input type="number" inputMode="numeric" min="0" step="1" required value={quantity} onChange={e => setQuantity(e.target.value)} /><small>Se registra como el primer movimiento de inventario.</small></label> : <div className={styles.variants}><p>Cada variante tendrá su propio SKU, código y existencia.</p>{variants.map((v, index) => <section key={v.id}><header><b>Variante {index + 1}</b><button type="button" onClick={() => setVariants(rows => rows.filter(row => row.id !== v.id))} aria-label={`Quitar variante ${index + 1}`}>Quitar</button></header><label>Nombre de variante<input required maxLength={100} placeholder="Ej. M / Blanco" value={v.title} onChange={e => updateVariant(v.id, { title: e.target.value })} /></label>{!!fields.length && <div className={styles.grid}>{fields.map(field => <label key={field}>{labels[field] || field}<input value={v.attributes[field] || ""} onChange={e => updateVariant(v.id, { attributes: { ...v.attributes, [field]: e.target.value } })} /></label>)}</div>}<label>Código de la variante<input value={v.barcode} maxLength={80} placeholder="Vacío = generar automáticamente" onChange={e => updateVariant(v.id, { barcode: e.target.value })} /></label><div className={styles.tools}><button type="button" onClick={() => setScanner(v.id)}>Escanear</button><button type="button" onClick={() => void generateCode(v.id)}>Generar</button></div><label>Cantidad inicial<input type="number" min="0" step="1" required value={v.quantity} onChange={e => updateVariant(v.id, { quantity: e.target.value })} /></label></section>)}<button type="button" disabled={variants.length >= 50} onClick={() => setVariants(rows => [...rows, freshVariant()])}>＋ Agregar variante</button></div>}
      </fieldset>
      <div className={styles.saveBar}><span>Estado al guardar: <b>BORRADOR</b></span><button className={styles.primary} type="submit" disabled={busy || processing || checking || !ready}>{busy ? "Guardando…" : pending ? "Reintentar guardado" : "Guardar + siguiente producto"}</button><small>Conservamos categoría y precio para la siguiente captura.</small></div>
    </form>}
    <footer className={styles.footer}><Link href="/admin">← Volver al catálogo / Alta completa</Link></footer>
    {scanner && <BarcodeCamera onClose={() => setScanner(null)} onCode={code => { if (scanner === "main") { changeCode(code); void lookup(code).catch(() => {}); } else updateVariant(scanner, { barcode: code }); setScanner(null); }} />}
  </div></main>;
}
