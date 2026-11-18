"use client";

import { ChangeEvent, FormEvent, useCallback, useEffect, useMemo, useRef, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import styles from "./quick-product-entry.module.css";

type Category = { id: string; name: string; variant_schema: string[] };
type Match = { product_id: string; product_name: string; variant_id: string | null; variant_title: string; sku: string; barcode: string; stock: number; price: number; status: string };
type Photo = { id: string; file: File; url: string; uploaded?: string };
type Variant = { id: string; title: string; barcode: string; quantity: string; attributes: Record<string, string>; photo?: Photo | null };
type AdvancedDraft = Partial<{
  brand: string; model: string; condition: "new" | "preowned" | "demo"; salePrice: string;
  shortDescription: string; description: string; shortDescriptionEn: string; descriptionEn: string;
  featured: boolean; newArrival: boolean;
  specHand: string; specLoft: string; specFlex: string; specShaft: string;
  specGrip: string; specConditionScore: string; specPlayerProfile: string; specNotes: string;
}>;
type Capture = { request: string; name: string; category: string; price: number; currency: "MXN" | "USD"; barcode: string; quantity: number; onlineVisible: boolean; posVisible: boolean; photos: Photo[]; variants: Variant[]; advanced: AdvancedDraft };
type RecentProduct = { id: string; name: string; sku: string; advanced: AdvancedDraft };
const labels: Record<string, string> = { talla: "Talla", color: "Color", genero: "Género", mano: "Mano", loft: "Loft", flex: "Flex", longitud: "Longitud" };
const money = (n: number) => new Intl.NumberFormat("es-MX", { style: "currency", currency: "MXN" }).format(n);
const freshVariant = (): Variant => ({ id: crypto.randomUUID(), title: "", barcode: "", quantity: "0", attributes: {} });
const apparelSizes = ["XS", "S", "M", "L", "XL", "XXL", "Unitalla", ...Array.from({ length: 51 }, (_, index) => String(index))];
const genderOptions = ["Niño", "Niña", "Hombre", "Mujer", "Unisex"] as const;
// Available choices only: selecting a category never creates a size range.
const shoeSizes = Array.from({ length: 21 }, (_, index) => String(22 + index * 0.5));
function categorySizeType(name: string): "apparel" | "shoes" | null {
  const normalized = name.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
  if (/zapato|calzado|tenis|footwear|shoe|sneaker/.test(normalized)) return "shoes";
  if (/ropa|vestimenta|camisa|playera|polo|pantalon|short|sudadera|chamarra|gorra|visera|sombrero|apparel|clothing/.test(normalized)) return "apparel";
  return null;
}

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
  const closeRef = useRef(onClose);
  useEffect(() => { closeRef.current = onClose; }, [onClose]);
  const codeRef = useRef(onCode);
  useEffect(() => { codeRef.current = onCode; }, [onCode]);
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

export default function QuickProductEntry({ embedded = false }: { embedded?: boolean }) {
  const db = useMemo(() => createClient(), []);
  const [categories, setCategories] = useState<Category[]>([]);
  const [ready, setReady] = useState(false);
  const [name, setName] = useState(""); const [category, setCategory] = useState("");
  const [price, setPrice] = useState(""); const [currency, setCurrency] = useState<"MXN" | "USD">("MXN"); const [salesChannel, setSalesChannel] = useState<"both" | "physical" | "online">("both"); const [barcode, setBarcode] = useState(""); const [quantity, setQuantity] = useState("0");
  const [photos, setPhotos] = useState<Photo[]>([]); const photosRef = useRef<Photo[]>([]);
  const [hasVariants, setHasVariants] = useState(false); const [variants, setVariants] = useState<Variant[]>([]);
  const [advanced, setAdvanced] = useState<AdvancedDraft>({});
  const [recentProduct, setRecentProduct] = useState<RecentProduct | null>(null);
  const [pendingDetails, setPendingDetails] = useState<RecentProduct[]>([]);
  const variantsRef = useRef<Variant[]>([]);
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
  const selectedCategory = categories.find(c => c.id === category);
  const fields = selectedCategory?.variant_schema || [];
  const sizeType = categorySizeType(selectedCategory?.name || "");
  const variantFields = sizeType && !fields.includes("talla") ? ["talla", ...fields] : fields;
  const locked = busy || processing || pending;
  const updateAdvanced = <K extends keyof AdvancedDraft>(field: K, value: AdvancedDraft[K]) => setAdvanced(current => ({ ...current, [field]: value }));
  const advancedCount = Object.values(advanced).filter(value => value !== "" && value !== undefined).length;
  const hasAdvancedDetails = (draft: AdvancedDraft) => Object.values(draft).some(value => value !== "" && value !== undefined);

  function openEditor(productId: string, draft?: AdvancedDraft) {
    // No write is performed here. The original editor loads the product and
    // applies only user-entered draft fields; saving remains an explicit step.
    window.dispatchEvent(new CustomEvent("updown:admin-product-edit-request", {
      detail: { productId, advanced: draft || {} },
    }));
  }

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
    // eslint-disable-next-line react-hooks/set-state-in-effect -- External counts update after network completion.
    void refreshCounts();
    return () => { alive = false; };
  }, [db, refreshCounts]);
  useEffect(() => { photosRef.current = photos; }, [photos]);
  useEffect(() => { variantsRef.current = variants; }, [variants]);
  useEffect(() => () => { photosRef.current.forEach(p => URL.revokeObjectURL(p.url)); variantsRef.current.forEach(v => { if(v.photo) URL.revokeObjectURL(v.photo.url); }); }, []);
  useEffect(() => {
    const handler = (e: BeforeUnloadEvent) => { if (name || photosRef.current.length || captureRef.current || receiveRef.current || pendingDetails.length) { e.preventDefault(); e.returnValue = ""; } };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [name, pendingDetails.length]);
  useEffect(() => {
    const onDetailsSaved = (event: Event) => {
      const productId = (event as CustomEvent<{ productId: string }>).detail?.productId;
      if (!productId) return;
      setPendingDetails(current => current.filter(item => item.id !== productId));
      setRecentProduct(current => current?.id === productId ? { ...current, advanced: {} } : current);
    };
    window.addEventListener("updown:admin-product-details-saved", onDetailsSaved);
    return () => window.removeEventListener("updown:admin-product-details-saved", onDetailsSaved);
  }, []);

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
  async function setVariantPhoto(id: string, event: ChangeEvent<HTMLInputElement>) {
    const selected = event.target.files?.[0];
    event.target.value = "";
    if (!selected || locked) return;
    processingRef.current = true; setProcessing(true); setError("");
    try {
      const file = await preparePhoto(selected);
      const photo: Photo = { id: crypto.randomUUID(), file, url: URL.createObjectURL(file) };
      setVariants(previous => previous.map(variant => {
        if (variant.id !== id) return variant;
        if (variant.photo) URL.revokeObjectURL(variant.photo.url);
        return { ...variant, photo };
      }));
    } catch (e) { setError(friendly(e)); }
    finally { processingRef.current = false; setProcessing(false); }
  }
  function removeVariantPhoto(id: string) {
    setVariants(previous => previous.map(variant => {
      if (variant.id !== id) return variant;
      if (variant.photo) URL.revokeObjectURL(variant.photo.url);
      return { ...variant, photo: null };
    }));
  }
  function clearProduct() {
    photosRef.current.forEach(p => URL.revokeObjectURL(p.url)); setPhotos([]); photosRef.current = [];
    variantsRef.current.forEach(v => { if (v.photo) URL.revokeObjectURL(v.photo.url); });
    variantsRef.current = [];
    setName(""); setBarcode(""); setQuantity("0"); setVariants([]); setHasVariants(false); setAdvanced({});
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
        if (advanced.salePrice !== undefined && advanced.salePrice !== "" && (
          !Number.isFinite(Number(advanced.salePrice)) || Number(advanced.salePrice) < 0 ||
          Number(advanced.salePrice) > Number(price)
        )) throw new Error("El precio de oferta debe estar entre cero y el precio normal.");
        captureRef.current = { request: crypto.randomUUID(), name: name.trim(), category, price: Number(price), currency, barcode: barcode.trim(), quantity: Number(quantity), onlineVisible: salesChannel !== "physical", posVisible: salesChannel !== "online", photos: photos.map(p => ({ ...p })), variants: hasVariants ? variants.map(v => ({ ...v, attributes: { ...v.attributes }, photo: v.photo ? { ...v.photo } : null })) : [], advanced: { ...advanced } };
        setPending(true);
      }
      const capture = captureRef.current;
      for (const photo of capture.photos) {
        if (photo.uploaded) continue;
        const path = `products/quick/${capture.request}/${photo.id}.jpg`;
        const { error } = await db.storage.from("product-media").upload(path, photo.file, { contentType: "image/jpeg", upsert: true });
        if (error) throw error;
        // eslint-disable-next-line react-hooks/immutability -- Private retry snapshot cloned from state; not a React state mutation.
        photo.uploaded = db.storage.from("product-media").getPublicUrl(path).data.publicUrl;
      }
      // Each variant photo lives in its own storage object and metadata.
      // Reuse uploaded URLs when retrying the same request to avoid duplicates.
      for (const variant of capture.variants) {
        if (!variant.photo) continue;
        if (!variant.photo.uploaded) {
          const path = `products/quick/${capture.request}/variants/${variant.id}.jpg`;
          const { error: uploadError } = await db.storage.from("product-media").upload(
            path, variant.photo.file, { contentType: "image/jpeg", upsert: true }
          );
          if (uploadError) throw uploadError;
          variant.photo.uploaded = db.storage.from("product-media").getPublicUrl(path).data.publicUrl;
        }
      }
      const { data, error } = await db.rpc("admin_quick_product_create", {
        p_request_id: capture.request, p_name: capture.name, p_category_id: capture.category, p_price: capture.price,
        p_barcode: capture.barcode || null, p_quantity: capture.quantity,
        p_images: capture.photos.map(p => p.uploaded!), p_variants: capture.variants.map(v => ({ title: v.title.trim(), barcode: v.barcode || null, quantity: Number(v.quantity), attributes: { ...v.attributes, ...(v.photo?.uploaded ? { image_url: v.photo.uploaded } : {}) } }))
      });
      if (error) {
        // SQL errors roll back the whole transaction. Network failures retain the
        // exact request and uploaded files so the same operation can be retried.
        if (error.code && !error.code.startsWith("PGRST") && error.code !== "") { captureRef.current = null; setPending(false); }
        throw error;
      }
      // Retry-safe: the create RPC returns the same product_id for repeated request IDs.
      // Keep the capture pending if the visibility update fails so it can be retried.
      const { error: visibilityError } = await db.from("products")
        .update({ currency: capture.currency, online_visible: capture.onlineVisible, pos_visible: capture.posVisible })
        .eq("id", data.product_id)
        .select("id").single();
      if (visibilityError) throw visibilityError;
      setSuccess(`✓ ${data.name} registrado como borrador · SKU ${data.sku}${capture.variants.length ? ` · ${capture.variants.length} variantes` : ` · ${capture.quantity} piezas`} · código ${data.barcode}`);
      const recent = { id: data.product_id, name: data.name, sku: data.sku, advanced: capture.advanced };
      setRecentProduct(recent);
      if (hasAdvancedDetails(capture.advanced)) {
        setPendingDetails(current => [...current.filter(item => item.id !== recent.id), recent]);
      }
      window.dispatchEvent(new Event("updown:admin-products-refresh"));
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
      window.dispatchEvent(new Event("updown:admin-products-refresh"));
      receiveRef.current = null; setPending(false); changeCode(""); setReceiving("1"); requestAnimationFrame(() => codeInput.current?.focus());
    } catch (e) { setError(friendly(e)); }
    finally { busyRef.current = false; setBusy(false); }
  }
  const updateVariant = (id: string, patch: Partial<Variant>) => setVariants(rows => rows.map(v => v.id === id ? { ...v, ...patch } : v));
  function startVariants() {
    if (locked) return;
    setHasVariants(true);
    setVariants(previous => previous.length ? previous : [freshVariant()]);
  }

  return <main className={`${styles.page}${embedded ? ` ${styles.embedded}` : ""}`}><div className={styles.wrap}>
    {!embedded && <header className={styles.header}><Link href="/admin" className={styles.brand}>UP AND DOWN</Link><Link href="/admin/inventario">Inventario ↗</Link></header>}
    <section className={styles.hero}><div className={styles.eyebrow}>PRODUCTOS / CAPTURA</div><h1>{embedded ? "Nueva ficha de producto" : "Alta rápida"}</h1><p>Escanea, registra fotografías, prepara variantes y continúa con el siguiente artículo.</p><div className={styles.stats}><span>{active} activos</span><span className={styles.badge}>{drafts} borradores por completar</span><span>{count} capturados en esta sesión</span></div></section>
    <div className={styles.notice}><b>Borrador por default</b><span>Disponible en Productos e Inventario. Completa la ficha desde el catálogo para publicarlo.</span></div>
    {success && <div className={styles.success} role="status"><p>{success}</p>{embedded && recentProduct && !hasAdvancedDetails(recentProduct.advanced) && <div className={styles.nextStep}><p><b>Paso 2 · Información completa</b></p><p>Puedes completar marca, descripciones, condición y especificaciones sin volver a buscar el producto.</p><button type="button" onClick={() => openEditor(recentProduct.id)}>Revisar y completar ficha de {recentProduct.name} →</button></div>}</div>}
    {embedded && pendingDetails.length > 0 && <section className={styles.pendingDetails} aria-label="Fichas con detalles avanzados pendientes"><strong>Detalles avanzados pendientes · {pendingDetails.length}</strong><p>Los borradores ya están creados, pero estos campos siguen únicamente en esta sesión. Abre cada ficha, revisa y confirma su actualización antes de salir.</p>{pendingDetails.map(item => <button key={item.id} type="button" onClick={() => openEditor(item.id, item.advanced)}>Revisar y completar ficha de {item.name} · {item.sku} →</button>)}</section>}
    {error && <div className={styles.error} role="alert">{error}</div>}
    {pending && !busy && <p className={styles.notice}>La captura quedó pendiente. Reintenta el mismo guardado para confirmar el resultado sin duplicarlo.</p>}
    <section className={styles.card}>
      <label className={styles.label} htmlFor="quick-barcode">Código de barras</label>
      <div className={styles.codeRow}><input id="quick-barcode" ref={codeInput} value={barcode} maxLength={80} disabled={locked} placeholder="Escanea, escribe o genera un código" autoComplete="off" onChange={e => changeCode(e.target.value)} onBlur={() => { if (!locked) void lookup(barcode).catch(() => {}); }} onKeyDown={e => { if (e.key === "Enter") { e.preventDefault(); void lookup(barcode).catch(() => {}); } }} /><button type="button" disabled={locked} onClick={() => void lookup(barcode).catch(() => {})}>Buscar</button></div>
      <div className={styles.tools}><button type="button" disabled={locked} onClick={() => setScanner("main")}>▣ Escanear con cámara</button><button type="button" disabled={locked} onClick={() => void generateCode()}>＋ Generar código</button></div><small>Si lo dejas vacío, generaremos un EAN-13 interno al guardar. También puedes usar un lector USB o Bluetooth.</small>
      {checking && <p role="status">Buscando código…</p>}
      {matches.length > 1 && <label className={styles.label}>Selecciona la variante<select disabled={locked} value={match?.variant_id || ""} onChange={e => setMatch(matches.find(m => m.variant_id === e.target.value) || null)}><option value="">Elegir variante…</option>{matches.map((m, i) => <option key={m.variant_id || i} value={m.variant_id || ""}>{m.product_name} · {m.variant_title} · {m.sku}</option>)}</select></label>}
      {match && <div className={styles.found}><div className={styles.eyebrow}>CÓDIGO YA REGISTRADO</div><h2>{match.product_name}</h2><p>{match.variant_title} · {match.sku} · {money(match.price)}</p><strong>Existencia actual: {match.stock}</strong>
        {embedded && <button type="button" disabled={locked} onClick={() => openEditor(match.product_id)}>Abrir ficha completa de este producto</button>}
        {match.variant_id ? <form onSubmit={receive}><fieldset disabled={locked}><label>Cantidad recibida<input type="number" min="1" step="1" required value={receiving} onChange={e => setReceiving(e.target.value)} /></label><label>Referencia<input required minLength={3} value={reason} onChange={e => setReason(e.target.value)} /></label><p>Nueva existencia estimada: <b>{Number(match.stock) + Number(receiving || 0)}</b></p></fieldset><button className={styles.primary} disabled={busy || processing} type="submit">{busy ? "Registrando…" : pending ? "Reintentar entrada" : "Registrar entrada de inventario"}</button></form> : <p>Este producto necesita una variante de inventario. Complétala desde <Link href="/admin">Productos</Link>.</p>}
      </div>}
    </section>
    {!matches.length && <form onSubmit={saveProduct} className={styles.card}>
      <fieldset disabled={locked}>
        <label>Nombre del producto<input ref={nameInput} value={name} onChange={e => setName(e.target.value)} required minLength={2} maxLength={180} placeholder="Ej. Polo Nike Dri-FIT" /></label>
        <div className={styles.grid}><label>Categoría<select value={category} onChange={e => setCategory(e.target.value)} required><option value="">Seleccionar…</option>{categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}</select></label><label>Precio de venta · {currency}<input type="number" inputMode="decimal" value={price} onChange={e => setPrice(e.target.value)} min="0.01" max="99999999" step="0.01" required placeholder="0.00" /></label></div>
        <label>Moneda del precio<select value={currency} onChange={e => setCurrency(e.target.value as "MXN" | "USD")}><option value="MXN">MXN · Pesos mexicanos</option><option value="USD">USD · Dólares estadounidenses</option></select></label>
        <label>Canal de venta<select value={salesChannel} onChange={e => setSalesChannel(e.target.value as "both" | "physical" | "online")}><option value="both">Tienda física y online</option><option value="physical">Solo tienda física (POS)</option><option value="online">Solo tienda online</option></select></label>
        {embedded && <details className={styles.advanced}>
          <summary>Información avanzada <span>{advancedCount ? `${advancedCount} campos preparados` : "Opcional · marca, descripción, golf y promociones"}</span></summary>
          <p>Estos datos se preparan aquí y se revisan en el editor existente después de crear el borrador. <b>No se guardarán hasta que confirmes el paso 2.</b></p>
          <div className={styles.grid}>
            <label>Marca<input value={advanced.brand || ""} maxLength={140} onChange={e => updateAdvanced("brand", e.target.value)} /></label>
            <label>Modelo<input value={advanced.model || ""} maxLength={140} onChange={e => updateAdvanced("model", e.target.value)} /></label>
            <label>Condición<select value={advanced.condition || ""} onChange={e => updateAdvanced("condition", e.target.value as AdvancedDraft["condition"])}><option value="">Conservar condición inicial (nuevo)</option><option value="new">Nuevo</option><option value="preowned">Seminuevo</option><option value="demo">Demo</option></select></label>
            <label>Precio de oferta · {currency}<input type="number" min="0" max={price || "99999999"} step="0.01" value={advanced.salePrice || ""} onChange={e => updateAdvanced("salePrice", e.target.value)} placeholder="Sin oferta" /></label>
          </div>
          <label>Descripción corta · Español<textarea value={advanced.shortDescription || ""} onChange={e => updateAdvanced("shortDescription", e.target.value)} /></label>
          <label>Descripción completa · Español<textarea value={advanced.description || ""} onChange={e => updateAdvanced("description", e.target.value)} /></label>
          <label>Descripción corta · Inglés<textarea lang="en" value={advanced.shortDescriptionEn || ""} onChange={e => updateAdvanced("shortDescriptionEn", e.target.value)} /></label>
          <label>Descripción completa · Inglés<textarea lang="en" value={advanced.descriptionEn || ""} onChange={e => updateAdvanced("descriptionEn", e.target.value)} /></label>
          <div className={styles.grid}>
            <label className={styles.toggle}><input type="checkbox" checked={advanced.featured || false} onChange={e => updateAdvanced("featured", e.target.checked)} />Producto destacado</label>
            <label className={styles.toggle}><input type="checkbox" checked={advanced.newArrival !== false} onChange={e => updateAdvanced("newArrival", e.target.checked)} />Mostrar en Novedades al publicar</label>
          </div>
          <details className={styles.advancedSpecs}><summary>Características de golf y observaciones</summary>
            <div className={styles.grid}>
              <label>Mano<select value={advanced.specHand || ""} onChange={e => updateAdvanced("specHand", e.target.value)}><option value="">No especificada</option><option value="Right">Diestro (RH)</option><option value="Left">Zurdo (LH)</option></select></label>
              <label>Loft<input value={advanced.specLoft || ""} onChange={e => updateAdvanced("specLoft", e.target.value)} /></label>
              <label>Flex<select value={advanced.specFlex || ""} onChange={e => updateAdvanced("specFlex", e.target.value)}><option value="">No especificado</option>{["Ladies", "Senior", "Wedge", "Regular", "Stiff", "X-Stiff", "Xstiff", "Junior"].map(option => <option key={option} value={option}>{option}</option>)}</select></label>
              <label>Shaft / varilla<input value={advanced.specShaft || ""} onChange={e => updateAdvanced("specShaft", e.target.value)} /></label>
              <label>Grip<input value={advanced.specGrip || ""} onChange={e => updateAdvanced("specGrip", e.target.value)} /></label>
              <label>Condición / calificación<input value={advanced.specConditionScore || ""} onChange={e => updateAdvanced("specConditionScore", e.target.value)} /></label>
              <label>Ideal para<input value={advanced.specPlayerProfile || ""} onChange={e => updateAdvanced("specPlayerProfile", e.target.value)} /></label>
            </div>
            <label>Observaciones del equipo<textarea value={advanced.specNotes || ""} onChange={e => updateAdvanced("specNotes", e.target.value)} /></label>
            <small>Los campos técnicos de palos se aplicarán solo si la categoría corresponde; el editor actual conserva esta validación.</small>
          </details>
        </details>}
        <div className={styles.photoHead}><label>Fotografías del producto padre <small>{photos.length} / 10 · opcionales</small></label></div>
        <div className={styles.tools}><label className={styles.fileButton}>▣ Tomar foto<input type="file" accept="image/*,.heic,.heif" capture="environment" onChange={addPhotos} /></label><label className={styles.fileButton}>＋ Elegir de galería<input type="file" accept="image/*,.heic,.heif" multiple onChange={addPhotos} /></label></div>
        {processing && <p role="status">Preparando fotos…</p>}
        {!!photos.length && <div className={styles.photos}>{photos.map((photo, index) => <div key={photo.id}><Image src={photo.url} width={120} height={120} unoptimized alt={`Foto ${index + 1} de ${name || "producto"}`} /><button type="button" aria-label={`Quitar foto ${index + 1}`} onClick={() => { URL.revokeObjectURL(photo.url); setPhotos(old => old.filter(p => p.id !== photo.id)); }}>✕</button>{index === 0 && <span>Principal</span>}</div>)}</div>}
        {sizeType && <div className={styles.notice}><b>{sizeType === "apparel" ? "Ropa: tallas XS, S, M, L, XL, XXL, Unitalla y numéricas del 0 al 50" : "Calzado: tallas numéricas MX (22 a 32, medios números)"}</b>{!hasVariants && <button type="button" disabled={locked} onClick={startVariants}>＋ Agregar variante</button>}<small>Elige la talla de cada variante. Solo se crearán las que agregues, una por una, con SKU, código de barras y existencias independientes.</small></div>}
        <label className={styles.toggle}><input type="checkbox" checked={hasVariants} onChange={e => { setHasVariants(e.target.checked); if (e.target.checked && !variants.length) setVariants([freshVariant()]); }} />Tiene variantes (talla, color u otras)</label>
        {!hasVariants ? <label>Cantidad inicial<input type="number" inputMode="numeric" min="0" step="1" required value={quantity} onChange={e => setQuantity(e.target.value)} /><small>Se registra como el primer movimiento de inventario.</small></label> : <div className={styles.variants}><p>Cada variante tendrá su propio SKU, código y existencia.</p>{variants.map((v, index) => <section key={v.id}><header><b>Variante {index + 1}</b><button type="button" onClick={() => setVariants(rows => { const selected=rows.find(row=>row.id===v.id); if(selected?.photo) URL.revokeObjectURL(selected.photo.url); return rows.filter(row => row.id !== v.id); })} aria-label={`Quitar variante ${index + 1}`}>Quitar</button></header><label>Nombre de variante<input required maxLength={100} placeholder="Ej. M / Blanco" value={v.title} onChange={e => updateVariant(v.id, { title: e.target.value })} /></label>{!!variantFields.length && <div className={styles.grid}>{variantFields.map(field => <label key={field}>{labels[field] || field}{field === "talla" && sizeType ? <select value={v.attributes[field] || ""} onChange={e => { const talla = e.target.value; updateVariant(v.id, { title: talla || v.title, attributes: { ...v.attributes, talla } }); }}><option value="">Seleccionar talla</option>{(sizeType === "apparel" ? [...apparelSizes] : shoeSizes).map(size => <option key={size} value={size}>{size}</option>)}</select> : field === "genero" ? <select value={v.attributes[field] || ""} onChange={e => updateVariant(v.id, { attributes: { ...v.attributes, [field]: e.target.value } })}><option value="">Seleccionar género</option>{genderOptions.map(option => <option key={option} value={option}>{option}</option>)}</select> : <input value={v.attributes[field] || ""} onChange={e => updateVariant(v.id, { attributes: { ...v.attributes, [field]: e.target.value } })} />}</label>)}</div>}<label>Código de la variante<input value={v.barcode} maxLength={80} placeholder="Vacío = generar automáticamente" onChange={e => updateVariant(v.id, { barcode: e.target.value })} /></label><div className={styles.variantPhoto}>
            <span>Fotografía de esta variante <small>Opcional · máximo 1 · independiente del producto padre</small></span>
            <div className={styles.tools}>
              <label className={styles.fileButton}>▣ Tomar foto<input type="file" accept="image/*,.heic,.heif" capture="environment" disabled={locked} onChange={e => void setVariantPhoto(v.id,e)} /></label>
              <label className={styles.fileButton}>＋ Galería<input type="file" accept="image/*,.heic,.heif" disabled={locked} onChange={e => void setVariantPhoto(v.id,e)} /></label>
            </div>
            {v.photo && <div className={styles.variantPhotoPreview}>
              <Image src={v.photo.url} width={100} height={100} unoptimized alt={`Foto de la variante ${v.title || index + 1}`} />
              <button type="button" disabled={locked} onClick={() => removeVariantPhoto(v.id)}>Quitar foto</button>
            </div>}
          </div><div className={styles.tools}><button type="button" onClick={() => setScanner(v.id)}>Escanear</button><button type="button" onClick={() => void generateCode(v.id)}>Generar</button></div><label>Cantidad inicial<input type="number" min="0" step="1" required value={v.quantity} onChange={e => updateVariant(v.id, { quantity: e.target.value })} /></label></section>)}<button type="button" disabled={variants.length >= 50} onClick={() => setVariants(rows => [...rows, freshVariant()])}>＋ Agregar variante</button></div>}
      </fieldset>
      <div className={styles.saveBar}><span>Estado al guardar: <b>BORRADOR</b></span><button className={styles.primary} type="submit" disabled={busy || processing || checking || !ready}>{busy ? "Guardando…" : pending ? "Reintentar guardado" : "Guardar + siguiente producto"}</button><small>Conservamos categoría y precio para la siguiente captura.</small></div>
    </form>}
    {!embedded && <footer className={styles.footer}><Link href="/admin">← Volver al catálogo / Alta completa</Link></footer>}
    {scanner && <BarcodeCamera onClose={() => setScanner(null)} onCode={code => { if (scanner === "main") { changeCode(code); void lookup(code).catch(() => {}); } else updateVariant(scanner, { barcode: code }); setScanner(null); }} />}
  </div></main>;
}
