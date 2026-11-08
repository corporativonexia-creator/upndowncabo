"use client";

import { useEffect, useState } from "react";
import { createClient } from "@supabase/supabase-js";
import { productPageUrl, type ShareableProduct } from "@/lib/storefront/product-share";
import type { RelatedProduct } from "@/lib/storefront/get-related-products";
import { VS_GOLF_LOGO, VS_GOLF_INSTAGRAM } from "./vs-golf";
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

export default function ProductDetail({ product, preview, related = [] }: { product: ShareableProduct; preview: boolean; related?: RelatedProduct[] }) {
  const [active, setActive] = useState(0);
  const [affiliate, setAffiliate] = useState<Affiliate | null>(null);
  const [copied, setCopied] = useState(false);
  const [added, setAdded] = useState(false);
  const [zoomed, setZoomed] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [cartMessage, setCartMessage] = useState("");
  const [variants, setVariants] = useState<Array<{id:string;title:string;stock:number}>>([]);
  const [searchOpen, setSearchOpen] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [cartUnits, setCartUnits] = useState(0);
  const [returnCatalogUrl, setReturnCatalogUrl] = useState<string | null>(null);

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

  useEffect(() => {
    if (!product.hasVariants || product.variantId) return;
    const endpoint = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
    if (!endpoint || !key) return;
    let cancelled = false;
    const client = createClient(endpoint, key);
    client.from("product_variants").select("id,title,sku,stock,is_active")
      .eq("product_id",product.parentId).eq("is_active",true).order("sku")
      .then(({data,error}) => {
        if(cancelled||error)return;
        setVariants((data||[]).map(v=>({id:String(v.id),title:String(v.title||v.sku||"Variante"),stock:Number(v.stock)||0})));
      });
    return ()=>{cancelled=true;};
  }, [product.hasVariants,product.variantId,product.parentId]);

  useEffect(() => {
    try {
      const stored = sessionStorage.getItem("upDownPreviewCatalogReturnUrl");
      if (preview && stored && /^\/vista-previa(?:[?#]|$)/.test(stored) && !stored.includes("/producto/")) {
        setReturnCatalogUrl(stored);
      }
    } catch { /* private browsing may block storage */ }
    const syncCart=()=>{
      try {
        const stored=JSON.parse(localStorage.getItem("upDownCart") || "[]");
        const count=Array.isArray(stored)?stored.reduce((sum:number,item:{quantity?:number})=>sum+Math.max(0,Number(item.quantity)||0),0):0;
        setCartUnits(count);
      } catch { setCartUnits(0); }
    };
    syncCart();
    window.addEventListener("storage",syncCart);
    window.addEventListener("updown:cart-update",syncCart);
    return ()=>{
      window.removeEventListener("storage",syncCart);
      window.removeEventListener("updown:cart-update",syncCart);
    };
  }, [preview]);

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
    if (product.hasVariants && !product.variantId) {
      setCartMessage("Elige una variante específica antes de agregar este producto al carrito.");
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
        id: product.id, variant_id: product.variantId, parent_id: product.parentId,
        name: product.name, slug: product.key, sku: product.sku, image: product.images[0] || "",
        price: product.price, currency: product.currency, stock: product.stock, quantity: 1, summary: product.category
      });
      localStorage.setItem("upDownCart", JSON.stringify(cart));
      window.dispatchEvent(new Event("updown:cart-update"));
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
  const cartActionName = product.hasVariants && !product.variantId ? "Selecciona una variante" : "Agregar al carrito";
  const shopUrl = (preview ? "/vista-previa" : "/") + (affiliate?.code ? "?ref=" + encodeURIComponent(affiliate.code) : "");
  function internalLink(path: string) {
    const url=new URL(path, "https://upndowncabo.com");
    if(affiliate?.code)url.searchParams.set("ref",affiliate.code);
    return url.pathname+url.search+url.hash;
  }
  const catalogHref=internalLink(returnCatalogUrl || (preview?"/vista-previa":"/"));
  const navHref=(section: string) => internalLink((preview?"/vista-previa":"/")+"#"+section);
  const cartHref=internalLink((preview?"/vista-previa":"/")+"?cart=1#udsCatalog");
  const navigationItems=[
    {name:"TIENDA",target:"udsCatalog"},
    {name:"CATEGORÍAS",target:"udsCategories"},
    {name:"SERVICIOS",target:"udsServices"},
    {name:"CLASES",target:"udsGolfClasses"},
    {name:"CAMPOS DE GOLF",target:"udsCourses"},
    {name:"NOTICIAS",target:"udsJournal"},
  ];
  const closeOnNav=()=>{setMobileMenuOpen(false);setSearchOpen(false);};
  function submitProductSearch(event: React.FormEvent<HTMLFormElement>){
    event.preventDefault();
    const value=searchTerm.trim();
    if(!value)return;
    const url=new URL(preview?"/vista-previa":"/","https://upndowncabo.com");
    url.searchParams.set("q",value.slice(0,140));
    if(affiliate?.code)url.searchParams.set("ref",affiliate.code);
    url.hash="udsCatalog";
    window.location.assign(url.pathname+url.search+url.hash);
  }
  const galleryCount = Math.max(1, product.images.length);
  const galleryImage = product.images[active] || "/assets/updown-product-placeholder.svg";
  const movePhoto = (delta: number) => setActive(current => (current + delta + galleryCount) % galleryCount);

  return <main className="ud-product-page">
    <header className="ud-product-header">
      <div className="ud-product-navrow">
      <a href={catalogHref} className="ud-product-brand" aria-label="Volver a UP AND DOWN">
        <span className="ud-product-symbol" aria-hidden="true"><svg viewBox="0 0 841.89 292.21" aria-hidden="true" focusable="false">
            <path d="M487.69,0c2.11,0,4.84.51,7.24.67,19.23,1.24,37.18,3.93,54.09,14.38l19.95,12.32c7.23,4.47,14.2,8.69,21.96,12.09,10.35,4.66,21.08,6.28,32.42,6.4l23.96.23-19.01,16.47c-3.62,3.13-7.52,5.51-11.66,7.98-17.32,10.34-35.07,8.55-54.04,3.73s-38.9-5.76-58.5-2.1c-7.43,1.39-14.49,2.98-21.75,5.63v131.14s54.16,17.53,54.16,17.53l68.64,21.12c13.32,3.67,26.34,6.32,39.98,8.62,57.26,9.69,111.58,7.83,166.77-10.79,2.46-.83,4.53,2.25,4.66,3.89.2,2.48-1.01,4.22-3.46,5.14-56.31,21.08-117.16,27.27-176.73,17.8-26.3-4.18-52.32-10.57-77.62-18.8l-91.08-29.62c-12.62-4.11-25.15-7.06-38.06-10.03-35.81-8.22-72.32-10.61-109.03-7.48-32.44,2.77-64.62,8.14-96.1,16.49l-128.11,34c-16.24,4.31-32.54,7.18-49.17,8.54l-14.51,1.18c-2.24.18-3.66-2.82-3.67-4.56s1.04-4.35,3.29-4.61c20.48-2.39,40.47-5.84,60.49-10.92,9.16-2.33,17.81-4.43,26.85-7.27l92.58-29.06c10.18-3.2,20.07-5.54,30.44-8.07,21.58-5.27,43.17-9.15,65.32-11.77,32.47-3.84,64.88-3.58,97.21.82,9.86,1.34,19.13,2.61,28.74,4.94l36.28,8.8.07-22.1.09-91.09-.14-91.6h17.45Z" fill="currentColor" />
          </svg></span>
        <span>UP AND DOWN<small>CABO · GOLF SHOP</small></span>
      </a>
        <nav className="ud-product-topnav" aria-label="Navegación principal">
          {navigationItems.slice(0,3).map(item=><a key={item.target} href={navHref(item.target)} onClick={closeOnNav}>{item.name}</a>)}
          <a className="ud-product-service-icon" href="https://wa.me/526241299870?text=Hola%20Carlos%2C%20quiero%20informaci%C3%B3n%20de%20GHIN" aria-label="USGA GHIN" target="_blank" rel="noopener noreferrer">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/assets/usga-ghin.png" alt="USGA GHIN"/>
          </a>
          <a className="ud-product-service-icon" href={VS_GOLF_INSTAGRAM} aria-label="VS GOLF en Instagram" target="_blank" rel="noopener noreferrer">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={VS_GOLF_LOGO} alt="VS GOLF"/>
          </a>
          {navigationItems.slice(3).map(item=><a key={item.target} href={navHref(item.target)} onClick={closeOnNav}>{item.name}</a>)}
        </nav>
        <div className="ud-product-navtools">
          <button type="button" className="ud-product-icon-btn" aria-label={searchOpen?"Cerrar búsqueda":"Buscar productos"} aria-expanded={searchOpen} onClick={()=>{setMobileMenuOpen(false);setSearchOpen(v=>!v);}}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true"><circle cx="11" cy="11" r="6.5"/><path d="m16 16 4 4"/></svg>
          </button>
          <a className="ud-product-icon-btn ud-product-cart-link" href={cartHref} aria-label={"Abrir carrito, "+cartUnits+" artículos"}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true"><path d="M3 4h2l2.1 10.2a2 2 0 0 0 2 1.6h7.8a2 2 0 0 0 2-1.6L20 8H6.2"/><circle cx="10" cy="20" r="1.2"/><circle cx="18" cy="20" r="1.2"/></svg>
            {cartUnits>0&&<span>{cartUnits}</span>}
          </a>
          <button type="button" className="ud-product-icon-btn ud-product-menu-toggle" aria-label="Abrir menú" aria-expanded={mobileMenuOpen} onClick={()=>{setSearchOpen(false);setMobileMenuOpen(v=>!v);}}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true"><path d="M4 6h16M4 12h16M4 18h16"/></svg>
          </button>
        </div>
      </div>
      {searchOpen&&<form className="ud-product-searchbar" role="search" onSubmit={submitProductSearch}>
        <label htmlFor="ud-product-search-input">Busca otra pieza o equipo de golf</label>
        <div className="ud-product-search-field">
          <input id="ud-product-search-input" autoFocus type="search" value={searchTerm} placeholder="Buscar marca, modelo, categoría..." onChange={e=>setSearchTerm(e.target.value)} maxLength={140}/>
          <button type="submit" disabled={!searchTerm.trim()}>Buscar</button>
        </div>
      </form>}
      {mobileMenuOpen&&<nav className="ud-product-mobile-menu" aria-label="Menú de producto">
        {navigationItems.map(item=><a key={item.target} href={navHref(item.target)} onClick={closeOnNav}>{item.name}</a>)}
        <a href="https://wa.me/526241299870?text=Hola%20Carlos%2C%20quiero%20informaci%C3%B3n%20de%20GHIN" target="_blank" rel="noopener noreferrer">USGA GHIN</a>
        <a href={VS_GOLF_INSTAGRAM} target="_blank" rel="noopener noreferrer">VS GOLF</a>
      </nav>}
    </header>
    <div className="ud-product-container">
      <nav className="ud-product-breadcrumb" aria-label="Ubicación">
        <a href={catalogHref}>Tienda</a><span aria-hidden="true">/</span>
        <span>{product.category || "Golf"}</span><span aria-hidden="true">/</span>
        <span aria-current="page">{product.name}</span>
      </nav>
      <article className="ud-product-sheet">
        <section className="ud-product-gallery" aria-label="Fotografías del producto">
          <div className="ud-product-main-image">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={galleryImage} alt={product.name + " · imagen " + (active + 1)} onError={e=>{if(!e.currentTarget.src.endsWith("/assets/updown-product-placeholder.svg"))e.currentTarget.src="/assets/updown-product-placeholder.svg";}} />
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
          {product.hasVariants && !product.variantId && <div className="ud-product-variant-picker">
            <h2 className="ud-product-section-label">Elige tu variante</h2>
            <div className="ud-product-variant-options">
              {variants.map(v => <a key={v.id} href={productPageUrl(
                (product.name.normalize("NFD").replace(/[\\u0300-\\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").slice(0,50) || "producto") + "--v-" + v.id,
                preview, affiliate?.code
              )}>{v.title} · {v.stock > 0 ? v.stock + " pza." : "Agotado"}</a>)}
            </div>
          </div>}
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
            <button className="ud-product-cart" type="button" onClick={addToCart} disabled={product.stock <= 0 || (product.hasVariants && !product.variantId)} title={cartActionName} aria-label={cartActionName}>
              <svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M3 4h2l2.1 10.2a2 2 0 0 0 2 1.6h7.8a2 2 0 0 0 2-1.6L20 8H6.2" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/><circle cx="10" cy="20" r="1.2" fill="currentColor"/><circle cx="18" cy="20" r="1.2" fill="currentColor"/></svg>
            </button>
          </div>
          {cartMessage && <p className="ud-product-feedback" role="status">{cartMessage}</p>}
          {added && <a className="ud-product-to-cart" href={catalogHref}>Seguir explorando productos</a>}
        </section>
      </article>
      {related.length>0&&<section className="ud-related" aria-label="Artículos relacionados">
        <div className="ud-related-heading">
          <div><span>DESCUBRE MÁS EQUIPO</span><h2>Productos que también podrían interesarte</h2></div>
          <div className="ud-related-controls">
            <button type="button" aria-label="Ver productos anteriores" onClick={()=>document.getElementById("ud-related-strip")?.scrollBy({left:-390,behavior:"smooth"})}>‹</button>
            <button type="button" aria-label="Ver más productos" onClick={()=>document.getElementById("ud-related-strip")?.scrollBy({left:390,behavior:"smooth"})}>›</button>
          </div>
        </div>
        <div id="ud-related-strip" className="ud-related-strip" role="list">
          {related.map(item=><a role="listitem" key={item.id} className="ud-related-card" href={productPageUrl(item.key,preview,affiliate?.code)}>
            <div className="ud-related-image">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img loading="lazy" alt={item.image?item.name:""} src={item.image||"/assets/updown-product-placeholder.svg"} onError={e=>{const img=e.currentTarget;if(!img.src.endsWith("/assets/updown-product-placeholder.svg")){img.src="/assets/updown-product-placeholder.svg";img.alt="";}}}/>
              {item.stock<=0&&<span className="ud-related-sold">Agotado</span>}
            </div>
            <div className="ud-related-caption">
              <small>{item.relation}</small><strong>{item.name}</strong>
              <span>{amount(item.price,item.currency)}</span>
            </div>
          </a>)}
        </div>
      </section>}
    </div>
    {zoomed && <div className="ud-product-zoom" role="dialog" aria-modal="true" aria-label="Fotografía ampliada" onClick={() => setZoomed(false)}>
      <button type="button" onClick={() => setZoomed(false)} aria-label="Cerrar imagen">×</button>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={galleryImage} alt={product.name} onClick={event => event.stopPropagation()} />
    </div>}
  </main>;
}
