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
        <span className="ud-product-symbol" aria-hidden="true">⌁</span>
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
