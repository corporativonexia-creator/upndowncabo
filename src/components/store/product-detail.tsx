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
  const availability = product.stock > 0 ? "Disponible · " + product.stock + " pza." + (product.stock === 1 ? "" : "s") : "Agotado";

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
    if (product.stock <= 0 || product.variantId || product.hasVariants) return;
    try {
      const raw = JSON.parse(localStorage.getItem("upDownCart") || "[]") as Array<Record<string, unknown>>;
      const cart = Array.isArray(raw) ? raw : [];
      const match = cart.find(item => item.id === product.id);
      const next = Number(match?.quantity || 0) + 1;
      if (next > product.stock) { setAdded(false); return; }
      if (match) match.quantity = next;
      else cart.push({
        id: product.id, name: product.name, slug: product.key, image: product.images[0] || "",
        price: product.price, currency: product.currency, stock: product.stock, quantity: 1, summary: product.category
      });
      localStorage.setItem("upDownCart", JSON.stringify(cart));
      setAdded(true);
    } catch { setAdded(false); }
  }

  return <main className="ud-product-page">
    <header className="ud-product-header">
      <a href={preview ? "/vista-previa" : "/"} className="ud-product-brand" aria-label="Regresar a UP AND DOWN">
        <span className="ud-product-symbol" aria-hidden="true"><svg viewBox="0 0 841.89 292.21" aria-hidden="true" focusable="false">
            <path d="M487.69,0c2.11,0,4.84.51,7.24.67,19.23,1.24,37.18,3.93,54.09,14.38l19.95,12.32c7.23,4.47,14.2,8.69,21.96,12.09,10.35,4.66,21.08,6.28,32.42,6.4l23.96.23-19.01,16.47c-3.62,3.13-7.52,5.51-11.66,7.98-17.32,10.34-35.07,8.55-54.04,3.73s-38.9-5.76-58.5-2.1c-7.43,1.39-14.49,2.98-21.75,5.63v131.14s54.16,17.53,54.16,17.53l68.64,21.12c13.32,3.67,26.34,6.32,39.98,8.62,57.26,9.69,111.58,7.83,166.77-10.79,2.46-.83,4.53,2.25,4.66,3.89.2,2.48-1.01,4.22-3.46,5.14-56.31,21.08-117.16,27.27-176.73,17.8-26.3-4.18-52.32-10.57-77.62-18.8l-91.08-29.62c-12.62-4.11-25.15-7.06-38.06-10.03-35.81-8.22-72.32-10.61-109.03-7.48-32.44,2.77-64.62,8.14-96.1,16.49l-128.11,34c-16.24,4.31-32.54,7.18-49.17,8.54l-14.51,1.18c-2.24.18-3.66-2.82-3.67-4.56s1.04-4.35,3.29-4.61c20.48-2.39,40.47-5.84,60.49-10.92,9.16-2.33,17.81-4.43,26.85-7.27l92.58-29.06c10.18-3.2,20.07-5.54,30.44-8.07,21.58-5.27,43.17-9.15,65.32-11.77,32.47-3.84,64.88-3.58,97.21.82,9.86,1.34,19.13,2.61,28.74,4.94l36.28,8.8.07-22.1.09-91.09-.14-91.6h17.45Z" fill="currentColor" />
          </svg></span>
        <span>UP AND DOWN<small>CABO · GOLF SHOP</small></span>
      </a>
      <a href={(preview ? "/vista-previa" : "/") + (affiliate?.code ? "?ref=" + encodeURIComponent(affiliate.code) : "")} className="ud-product-back">← Volver a la tienda</a>
    </header>
    <div className="ud-product-container">
      <nav className="ud-product-breadcrumb" aria-label="Ubicación">
        <a href={preview ? "/vista-previa" : "/"}>Tienda</a><span aria-hidden="true">/</span>
        <span>{product.category || "Golf"}</span><span aria-hidden="true">/</span>
        <span aria-current="page">{product.name}</span>
      </nav>
      <div className="ud-product-layout">
        <section className="ud-product-gallery" aria-label="Fotografías del producto">
          <div className="ud-product-main-image">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={product.images[active] || "/assets/category-placeholder.svg"} alt={product.name + " · fotografía " + (active + 1)} />
          </div>
          {product.images.length > 1 && <div className="ud-product-thumbnails" aria-label="Seleccionar fotografía">
            {product.images.map((src, index) => <button key={src} type="button" className={active === index ? "is-active" : ""} onClick={() => setActive(index)} aria-label={"Ver imagen " + (index + 1)} aria-pressed={active === index}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={src} alt="" loading="lazy" />
            </button>)}
          </div>}
          {!product.images.length && <p className="ud-product-placeholder-note">Fotografía pendiente de actualización.</p>}
        </section>
        <section className="ud-product-copy">
          <p className="ud-product-eyebrow">{product.brand || product.category || "UP AND DOWN"} · {product.condition === "new" ? "Nuevo" : product.condition === "preowned" ? "Seminuevo" : product.condition === "demo" ? "Demostración" : "Equipo de golf"}</p>
          <h1>{product.name}</h1>
          <div className="ud-product-price">
            <strong>{amount(product.price, product.currency)}</strong>
            {product.comparePrice != null && <del>{amount(product.comparePrice, product.currency)}</del>}
          </div>
          <p className={product.stock > 0 ? "ud-product-stock is-available" : "ud-product-stock is-sold"}>{availability}</p>
          {product.sku && <p className="ud-product-sku">Código: {product.sku}</p>}
          {product.description && <p className="ud-product-description">{product.description}</p>}
          {affiliate?.seller_name && <p className="ud-product-advisor">Asesor asignado: <strong>{affiliate.seller_name}</strong></p>}
          <div className="ud-product-actions">
            {product.stock > 0 && !product.variantId && !product.hasVariants && <button className="ud-product-primary" type="button" onClick={addToCart}>{added ? "✓ Agregado al carrito" : "Agregar al carrito"}</button>}
            <a className="ud-product-primary" href={contactLink} target="_blank" rel="noopener noreferrer">{product.variantId || product.hasVariants ? "Consultar esta configuración" : "Preguntar por este producto"}</a>
          </div>
          <div className="ud-product-sharing" aria-label="Compartir este producto">
            <h2>¿Conoces a alguien que lo necesita?</h2>
            <p>Comparte este artículo y descubre más en UP AND DOWN Cabo.</p>
            <div className="ud-product-share-actions">
              <button type="button" onClick={nativeShare}>Compartir producto</button>
              <button type="button" onClick={openWhatsAppShare}>WhatsApp</button>
              <button type="button" onClick={copyLink}>{copied ? "✓ Enlace copiado" : "Copiar enlace"}</button>
            </div>
          </div>
          {Object.keys(product.specifications).length > 0 && <details className="ud-product-specs">
            <summary>Características y especificaciones</summary>
            <dl>{Object.entries(product.specifications).filter(([key, value]) => !/image|photo|url|barcode|codigo/i.test(key) && ["string","number","boolean"].includes(typeof value) && String(value).trim()).slice(0, 20).map(([key, value]) =>
              <div key={key}><dt>{key.replace(/_/g, " ")}</dt><dd>{String(value)}</dd></div>)}</dl>
          </details>}
        </section>
      </div>
    </div>
  </main>;
}
