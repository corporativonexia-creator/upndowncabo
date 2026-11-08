"use client";

import { useEffect, useState } from "react";
import { createClient } from "@supabase/supabase-js";
import { productPageUrl, type ShareableProduct } from "@/lib/storefront/product-share";
import "./product-detail.css";

type Affiliate = { code: string; seller_name: string; seller_phone?: string | null; expires_at: number; seller_id?: string };
const AFFILIATE_KEY = "upDownAffiliateReferral";
const DAYS_30 = 30 * 24 * 60 * 60 * 1000;

function existingAffiliate(): Affiliate | null {
  try {
    const saved = JSON.parse(localStorage.getItem(AFFILIATE_KEY) || "null") as Affiliate | null;
    return saved && saved.code && Number(saved.expires_at) > Date.now() ? saved : null;
  } catch { return null; }
}

function normalizedCode(value: string | null) {
  return (value || "").trim().toUpperCase().replace(/[^A-Z0-9_-]/g, "").slice(0, 48);
}

function amount(value: number, currency: string) {
  try { return new Intl.NumberFormat("es-MX", { style: "currency", currency: currency || "MXN" }).format(value); }
  catch { return new Intl.NumberFormat("es-MX", { style: "currency", currency: "MXN" }).format(value); }
}

function shareText(name: string, url: string) {
  return "🏌️ *" + name + "*\n\nDescubre sus características, precio y disponibilidad en *UP AND DOWN Cabo*.\n\n👉 Más información y fotos: " + url;
}

export default function ProductDetail({ product, preview }: { product: ShareableProduct; preview: boolean }) {
  const [active, setActive] = useState(0);
  const [affiliate, setAffiliate] = useState<Affiliate | null>(null);
  const [copied, setCopied] = useState(false);
  const [added, setAdded] = useState(false);
  const [zoomed, setZoomed] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [cartMessage, setCartMessage] = useState("");

  useEffect(() => {
    const saved = existingAffiliate();
    setAffiliate(saved);
    const code = normalizedCode(new URLSearchParams(window.location.search).get("ref"));
    if (!code || code === saved?.code) return;
    const endpoint = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
    if (!endpoint || !key) return;
    let cancelled = false;
    const client = createClient(endpoint, key);
    client.rpc("resolve_affiliate_ref", { p_code: code }).then(({ data, error }) => {
      if (cancelled || error) return;
      const row = Array.isArray(data) ? data[0] : null;
      if (!row?.code || !row?.seller_name) return;
      const linked: Affiliate = {
        seller_id: row.seller_id,
        code: normalizedCode(String(row.code)),
        seller_name: String(row.seller_name),
        seller_phone: String(row.seller_phone || row.phone || ""),
        expires_at: Date.now() + DAYS_30,
      };
      try { localStorage.setItem(AFFILIATE_KEY, JSON.stringify({ ...linked, captured_at: Date.now() })); } catch {}
      setAffiliate(linked);
    });
    return () => { cancelled = true; };
  }, []);

  const link = productPageUrl(product.key, preview, affiliate?.code || null);
  const whatsappMessage = shareText(product.name, link);
  const contactNumber = String(affiliate?.seller_phone || "526243554700").replace(/\D/g, "").replace(/^([0-9]{10})$/, "52$1");
  const contactText = "Hola" + (affiliate?.seller_name ? " " + affiliate.seller_name : " UP AND DOWN") +
    " 👋\nQuiero información sobre *" + product.name + "*." +
    (product.sku ? "\nSKU: " + product.sku : "") +
    "\nPrecio publicado: " + amount(product.price, product.currency) +
    "\n" + link;
  const contactLink = "https://wa.me/" + contactNumber + "?text=" + encodeURIComponent(contactText);
  // Match the existing modal: trade requests go to UP AND DOWN, not the seller's direct number.
  const tradeText = "Hola UP AND DOWN 👋\n" +
    (affiliate?.code ? "Estoy comprando con la referencia de " + affiliate.seller_name + " (" + affiliate.code + ").\n" : "") +
    "Estoy viendo este equipo: *" + product.name + "*." +
    (product.sku ? "\nSKU: " + product.sku : "") +
    "\nTengo equipo de golf que podría dar a cuenta. ¿Me explican cómo funciona la valoración en tienda?\n" + link;
  const tradeLink = "https://wa.me/526243554700?text=" + encodeURIComponent(tradeText);

  async function copyLink() {
    try {
      await navigator.clipboard.writeText(link);
      setCopied(true);
    } catch {
      // The browser may disable clipboard outside secure contexts.
      setCopied(false);
      window.prompt("Copia el enlace de este producto:", link);
    }
  }

  function openWhatsAppShare() {
    window.open("https://wa.me/?text=" + encodeURIComponent(whatsappMessage), "_blank", "noopener,noreferrer");
  }

  async function nativeShare() {
    if (navigator.share) {
      try { await navigator.share({ title: product.name + " | UP AND DOWN Cabo", text: "Descubre sus características, precio y disponibilidad en UP AND DOWN Cabo.", url: link }); return; }
      catch (error) { if ((error as Error)?.name === "AbortError") return; }
    }
    await copyLink();
  }

  function addToCart() {
    if (product.stock <= 0) { setCartMessage("Este artículo está agotado."); return; }
    if (product.variantId || product.hasVariants) {
      // Product variants currently use advisor validation in the canonical storefront.
      window.open(contactLink, "_blank", "noopener,noreferrer");
      setCartMessage("Consulta esta variante con un asesor antes de comprar.");
      return;
    }
    try {
      const raw = JSON.parse(localStorage.getItem("upDownCart") || "[]") as Array<Record<string, unknown>>;
      const cart = Array.isArray(raw) ? raw : [];
      const match = cart.find(item => item.id === product.id);
      const next = Number(match?.quantity || 0) + 1;
      if (next > product.stock) { setAdded(false); setCartMessage("Ya alcanzaste las existencias disponibles."); return; }
      if (match) match.quantity = next;
      else cart.push({
        id: product.id, name: product.name, slug: product.key, image: product.images[0] || "",
        price: product.price, currency: product.currency, stock: product.stock, quantity: 1, summary: product.category
      });
      localStorage.setItem("upDownCart", JSON.stringify(cart));
      setAdded(true);
      setCartMessage("✓ " + product.name + " · " + next + (next === 1 ? " pieza" : " piezas") + " en tu carrito.");
    } catch { setAdded(false); setCartMessage("No fue posible actualizar el carrito."); }
  }


  const conditionLabel = product.condition === "new" ? "Nuevo" : product.condition === "preowned" ? "Seminuevo" : product.condition === "demo" ? "Demostración" : "Producto";
  const stockLabel = product.stock <= 0 ? "Agotado" : product.stock === 1 ? "Última pieza" : product.stock <= 3 ? "Pocas unidades" : "Disponible";
  const conditionNote = product.condition === "preowned"
    ? "Seminuevo. Solicita fotos actuales y detalle de desgaste antes de comprar."
    : product.condition === "demo" ? "Unidad demostración. Consulta los detalles estéticos."
    : "Consulta la condición y detalles actuales de este producto.";
  const specs = product.specifications;
  const normalize = (value: string) => value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
  const valueFrom = (aliases: string[]) => {
    for (const [key, value] of Object.entries(specs)) {
      const normalized = normalize(key);
      if (aliases.some(item => normalized === normalize(item))) {
        if (Array.isArray(value)) return value.filter(v => typeof v === "string" || typeof v === "number").join(" / ");
        if (value != null && ["string", "number"].includes(typeof value)) return String(value).trim();
      }
    }
    return "";
  };
  const configure: Array<{ label: string; value: string }> = [];
  const pushSpec = (label: string, value: string | null | undefined) => { if (value && value.trim()) configure.push({ label, value: value.trim() }); };
  pushSpec("Marca", product.brand);
  pushSpec("Modelo", product.model);
  pushSpec("Mano", valueFrom(["hand", "mano", "dexterity", "orientacion"]).replace(/^right$|^rh$/i, "Diestro").replace(/^left$|^lh$/i, "Zurdo"));
  pushSpec("Ángulo de la cara", valueFrom(["loft", "grados", "degree"]));
  pushSpec("Flexibilidad", valueFrom(["flex", "shaft flex", "flexibilidad"]));
  pushSpec("Varilla", valueFrom(["shaft", "varilla", "eje"]));
  pushSpec("Empuñadura", valueFrom(["grip", "empunadura"]));
  const usedSpecs = new Set(["brand", "marca", "model", "modelo", "hand", "mano", "dexterity", "orientacion", "loft", "grados", "degree", "flex", "shaft flex", "flexibilidad", "shaft", "varilla", "eje", "grip", "empunadura"]);
  const specLabels: Record<string, string> = {
    "condition score": "Estado del equipo", "condition rating": "Estado del equipo", "size": "Talla",
    "length": "Longitud", "color": "Color", "pieces": "Piezas", "year": "Año", "weight": "Peso"
  };
  for (const [key, value] of Object.entries(specs)) {
    const normalized = normalize(key);
    if (usedSpecs.has(normalized) || /image|photo|url|barcode|description|short description|title|summary|body|player profile|recomendado para/i.test(normalized)) continue;
    if (value == null || !["string", "number", "boolean"].includes(typeof value)) continue;
    const readable = String(value).trim();
    if (readable) configure.push({ label: specLabels[normalized] || key.replace(/_/g, " ").replace(/^./, s => s.toUpperCase()), value: readable });
  }
  const shortDescription = product.shortDescription || product.description || "Consulta con nuestro equipo sobre este producto.";
  const hasLongDescription = Boolean(product.shortDescription && product.description && product.shortDescription !== product.description);
  const cartActionName = product.variantId || product.hasVariants ? "Consultar esta variante para comprar" : "Agregar al carrito";
  const shopUrl = (preview ? "/vista-previa" : "/") + (affiliate?.code ? "?ref=" + encodeURIComponent(affiliate.code) : "");
  const galleryCount = Math.max(1, product.images.length);
  const galleryImage = product.images[active] || "/assets/category-placeholder.svg";
  const movePhoto = (delta: number) => setActive(current => (current + delta + galleryCount) % galleryCount);

  return <main className="ud-product-page">
    <header className="ud-product-header">
      <a href={shopUrl} className="ud-product-brand" aria-label="Volver a UP AND DOWN">
        <span className="ud-product-symbol" aria-hidden="true"><svg viewBox="0 0 841.89 292.21" aria-hidden="true" focusable="false">
            <path d="M487.69,0c2.11,0,4.84.51,7.24.67,19.23,1.24,37.18,3.93,54.09,14.38l19.95,12.32c7.23,4.47,14.2,8.69,21.96,12.09,10.35,4.66,21.08,6.28,32.42,6.4l23.96.23-19.01,16.47c-3.62,3.13-7.52,5.51-11.66,7.98-17.32,10.34-35.07,8.55-54.04,3.73s-38.9-5.76-58.5-2.1c-7.43,1.39-14.49,2.98-21.75,5.63v131.14s54.16,17.53,54.16,17.53l68.64,21.12c13.32,3.67,26.34,6.32,39.98,8.62,57.26,9.69,111.58,7.83,166.77-10.79,2.46-.83,4.53,2.25,4.66,3.89.2,2.48-1.01,4.22-3.46,5.14-56.31,21.08-117.16,27.27-176.73,17.8-26.3-4.18-52.32-10.57-77.62-18.8l-91.08-29.62c-12.62-4.11-25.15-7.06-38.06-10.03-35.81-8.22-72.32-10.61-109.03-7.48-32.44,2.77-64.62,8.14-96.1,16.49l-128.11,34c-16.24,4.31-32.54,7.18-49.17,8.54l-14.51,1.18c-2.24.18-3.66-2.82-3.67-4.56s1.04-4.35,3.29-4.61c20.48-2.39,40.47-5.84,60.49-10.92,9.16-2.33,17.81-4.43,26.85-7.27l92.58-29.06c10.18-3.2,20.07-5.54,30.44-8.07,21.58-5.27,43.17-9.15,65.32-11.77,32.47-3.84,64.88-3.58,97.21.82,9.86,1.34,19.13,2.61,28.74,4.94l36.28,8.8.07-22.1.09-91.09-.14-91.6h17.45Z" fill="currentColor" />
          </svg></span>
        <span>UP AND DOWN<small>CABO · GOLF SHOP</small></span>
      </a>
      <a href={shopUrl} className="ud-product-back">← Volver a la tienda</a>
    </header>
    <div className="ud-product-container">
      <nav className="ud-product-breadcrumb" aria-label="Ubicación">
        <a href={shopUrl}>Tienda</a><span aria-hidden="true">/</span>
        <span>{product.category || "Golf"}</span><span aria-hidden="true">/</span>
        <span aria-current="page">{product.name}</span>
      </nav>
      <article className="ud-product-sheet">
        <section className="ud-product-gallery" aria-label="Fotografías del producto">
          <div className="ud-product-main-image">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={galleryImage} alt={product.name + " · imagen " + (active + 1)} />
            {galleryCount > 1 && <>
              <button className="ud-photo-control is-prev" type="button" onClick={() => movePhoto(-1)} aria-label="Fotografía anterior">‹</button>
              <button className="ud-photo-control is-next" type="button" onClick={() => movePhoto(1)} aria-label="Fotografía siguiente">›</button>
            </>}
            <button className="ud-photo-expand" type="button" onClick={() => setZoomed(true)} aria-label="Ampliar fotografía">⛶</button>
            <span className="ud-photo-count">{active + 1}/{galleryCount}</span>
          </div>
        </section>
        <section className="ud-product-copy">
          <div className="ud-product-eyebrow"><span>{product.category || product.brand || "Golf"} · {conditionLabel}</span><span className={product.stock <= 0 ? "ud-status-badge is-sold" : "ud-status-badge"}>{stockLabel}</span></div>
          <h1>{product.name}</h1>
          <div className="ud-product-price">
            <strong>{amount(product.price, product.currency)}</strong>
            {product.comparePrice != null && <del>{amount(product.comparePrice, product.currency)}</del>}
          </div>
          <p className="ud-product-shipping">Envío no incluido</p>
          <div className="ud-product-description">
            <p>{expanded ? product.description : shortDescription}</p>
            {hasLongDescription && <button type="button" onClick={() => setExpanded(value => !value)}>{expanded ? "Ver menos" : "Ver más"}</button>}
          </div>
          <h2 className="ud-product-section-label">Configuración</h2>
          <dl className="ud-product-spec-grid">{(configure.length ? configure : [{ label: "Producto", value: product.name }]).map((entry, index) =>
            <div className="ud-product-spec" key={entry.label + index}><dt>{entry.label}</dt><dd>{entry.value}</dd></div>)}
          </dl>
          <h2 className="ud-product-section-label">Condición y disponibilidad</h2>
          <div className="ud-product-condition">
            <div className="ud-product-condition-row"><strong>{conditionLabel}</strong><span className={product.stock > 0 ? "ud-status-badge" : "ud-status-badge is-sold"}>{stockLabel}</span></div>
            <p>{conditionNote}</p>
          </div>
          <div className="ud-product-advisor">
            <small>Asesor de golf</small>
            <strong>{affiliate?.seller_name || "UP AND DOWN · Los Cabos"}</strong>
          </div>
          <div className="ud-product-sharing" aria-label="Compartir este producto">
            <p className="ud-product-share-title">Compartir este artículo</p>
            <div className="ud-product-share-actions">
              <button type="button" onClick={nativeShare}>Compartir producto</button>
              <button type="button" onClick={openWhatsAppShare}>WhatsApp</button>
              <button type="button" onClick={copyLink}>{copied ? "✓ Enlace copiado" : "Copiar enlace"}</button>
            </div>
          </div>
          <div className="ud-product-actions">
            <a className="ud-product-trade" href={tradeLink} target="_blank" rel="noopener noreferrer">Intercambiar</a>
            <a className="ud-product-question" href={contactLink} target="_blank" rel="noopener noreferrer">Preguntar</a>
            <button className="ud-product-cart" type="button" onClick={addToCart} disabled={product.stock <= 0} title={cartActionName} aria-label={cartActionName}>
              <svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M3 4h2l2.1 10.2a2 2 0 0 0 2 1.6h7.8a2 2 0 0 0 2-1.6L20 8H6.2" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/><circle cx="10" cy="20" r="1.2" fill="currentColor"/><circle cx="18" cy="20" r="1.2" fill="currentColor"/></svg>
            </button>
          </div>
          {cartMessage && <p className="ud-product-feedback" role="status">{cartMessage}</p>}
          {added && <a className="ud-product-to-cart" href={shopUrl + "#udsCatalog"}>Seguir explorando productos</a>}
        </section>
      </article>
    </div>
    {zoomed && <div className="ud-product-zoom" role="dialog" aria-modal="true" aria-label="Fotografía ampliada" onClick={() => setZoomed(false)}>
      <button type="button" onClick={() => setZoomed(false)} aria-label="Cerrar imagen">×</button>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={galleryImage} alt={product.name} onClick={event => event.stopPropagation()} />
    </div>}
  </main>;
}
