"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import "./premium-storefront.css";

type Category = { id: string; name: string; slug: string };
type Product = {
  id: string; name: string; slug: string | null; sku: string | null; brand: string | null;
  model: string | null; price: number | null; sale_price: number | null;
  currency: string | null; stock: number | null; cover_image_url: string | null;
  short_description: string | null; description: string | null;
  item_condition: string | null; category_id: string | null;
  featured: boolean | null;
  product_images?: { id: string; image_url: string; alt_text: string | null; sort_order: number | null; is_primary: boolean | null }[] | null;
};
type StoreProps = { categories: Category[]; products: Product[] };
const money = (value: number, currency: string | null) => new Intl.NumberFormat("es-MX", { style: "currency", currency: currency === "USD" ? "USD" : "MXN", maximumFractionDigits: 0 }).format(value);
const imageOf = (p: Product) => p.cover_image_url || p.product_images?.find((i) => i.is_primary)?.image_url || p.product_images?.[0]?.image_url || "";
const productUrl = (p: Product) => `/premium-preview/producto/${encodeURIComponent(p.slug || p.id)}`;
function Photo({ src, alt, className = "" }: { src: string; alt: string; className?: string }) {
  return src ? <img className={className} src={src} alt={alt} loading="lazy" /> : <div className={`premium-placeholder ${className}`} aria-label="Imagen no disponible"><span>UP AND DOWN</span></div>;
}
function Header() {
  return <header className="premium-header"><Link href="/premium-preview" className="premium-brand" aria-label="UP AND DOWN, inicio"><span className="premium-brand-symbol">U<span>↗</span>D</span><span>UP AND DOWN<small>CABO GOLF SHOP</small></span></Link><nav aria-label="Navegación"><Link href="/premium-preview">Colección</Link><a href="/vista-previa">Vista actual</a></nav><span className="premium-header-note">EXPERIENCIA DE PRUEBA</span></header>;
}
function Footer() { return <footer className="premium-footer"><span>UP AND DOWN · LOS CABOS</span><span>Vista privada de diseño · No se realizan compras aquí</span></footer>; }
function ProductCard({ p }: { p: Product }) {
  const current = p.sale_price != null && p.sale_price > 0 && (p.price == null || p.sale_price < p.price) ? p.sale_price : p.price ?? 0;
  return <Link href={productUrl(p)} className="premium-card">
    <div className="premium-card-photo"><Photo src={imageOf(p)} alt={p.name} />{p.stock != null && p.stock <= 0 && <span className="premium-tag">Agotado</span>}</div>
    <div className="premium-card-meta"><span className="premium-eyebrow">{p.brand || "UP AND DOWN"}</span><h3>{p.name}</h3><p>{money(current,p.currency)}</p></div>
  </Link>;
}
export function PremiumStorefront({ categories, products }: StoreProps) {
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("all");
  const [order, setOrder] = useState("featured");
  const items = useMemo(() => {
    const q = search.trim().toLocaleLowerCase("es");
    const result = products.filter(p => (category === "all" || p.category_id === category) && (!q || [p.name,p.brand,p.model,p.sku].some(v => (v || "").toLocaleLowerCase("es").includes(q))));
    if (order === "low") result.sort((a,b) => (a.sale_price || a.price || 0) - (b.sale_price || b.price || 0));
    if (order === "high") result.sort((a,b) => (b.sale_price || b.price || 0) - (a.sale_price || a.price || 0));
    if (order === "name") result.sort((a,b) => a.name.localeCompare(b.name,"es"));
    return result;
  },[products,search,category,order]);
  return <div className="premium-root"><Header/><main>
    <section className="premium-hero"><div className="premium-hero-copy"><span className="premium-kicker">SELECCIÓN DE GOLF · LOS CABOS</span><h1>El juego comienza <em>con estilo.</em></h1><p>Equipo, ropa y accesorios de golf seleccionados para disfrutar cada ronda.</p><a href="#coleccion" className="premium-cta">Explorar colección <span aria-hidden>↗</span></a></div><div className="premium-hero-visual"><span>THE GAME.<br/>ELEVATED.</span><div className="premium-golf-ball" aria-hidden="true"/></div></section>
    <section id="coleccion" className="premium-collection"><div className="premium-section-heading"><div><span className="premium-kicker">DESCUBRE TU PRÓXIMA PIEZA</span><h2>La colección</h2></div><p>Encuentra exactamente lo que buscas, sin complicaciones.</p></div>
    <div className="premium-toolbar"><label className="premium-search"><span aria-hidden>⌕</span><input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Buscar por artículo, marca o código" aria-label="Buscar productos"/></label><label className="premium-select"><span>Categoría</span><select value={category} onChange={e=>setCategory(e.target.value)}><option value="all">Todas</option>{categories.map(c=><option key={c.id} value={c.id}>{c.name}</option>)}</select></label><label className="premium-select"><span>Ordenar</span><select value={order} onChange={e=>setOrder(e.target.value)}><option value="featured">Destacados</option><option value="low">Menor precio</option><option value="high">Mayor precio</option><option value="name">Nombre A–Z</option></select></label></div>
    <p className="premium-count">{items.length} {items.length===1?"artículo":"artículos"}</p><div className="premium-grid">{items.map(p=><ProductCard key={p.id} p={p}/>)}</div>{items.length===0&&<div className="premium-empty"><h3>Sin resultados</h3><p>Prueba otra palabra o categoría.</p><button onClick={()=>{setSearch("");setCategory("all")}}>Limpiar filtros</button></div>}</section>
  </main><Footer/></div>;
}
export function PremiumProductDetail({ product: p }: { product: Product }) {
  const images = Array.from(new Set([imageOf(p),...(p.product_images || []).slice().sort((a,b)=>(a.sort_order || 0)-(b.sort_order || 0)).map(i=>i.image_url)].filter(Boolean)));
  const [selected,setSelected] = useState(0);
  const amount = p.sale_price != null && p.sale_price > 0 && (p.price == null || p.sale_price < p.price) ? p.sale_price : p.price ?? 0;
  return <div className="premium-root"><Header/><main className="premium-detail"><Link href="/premium-preview#coleccion" className="premium-back">← Volver a la colección</Link><div className="premium-detail-grid"><div className="premium-gallery"><div className="premium-main-photo"><Photo src={images[selected] || ""} alt={p.name}/></div>{images.length>1&&<div className="premium-thumbs">{images.map((url,i)=><button key={url} type="button" aria-label={`Ver imagen ${i+1}`} aria-pressed={i===selected} onClick={()=>setSelected(i)}><Photo src={url} alt={`${p.name}, imagen ${i+1}`}/></button>)}</div>}</div><div className="premium-product-copy"><span className="premium-kicker">{p.brand || "UP AND DOWN"}</span><h1>{p.name}</h1>{p.model&&<p className="premium-model">{p.model}</p>}<p className="premium-price">{money(amount,p.currency)}</p>{p.price!=null&&amount<p.price&&<p className="premium-old-price">Antes {money(p.price,p.currency)}</p>}<div className="premium-availability"><span className={p.stock != null && p.stock <= 0?"premium-out":"premium-in"}></span>{p.stock != null && p.stock <= 0 ? "Sin existencias" : p.stock != null ? "Disponible en inventario" : "Consulta disponibilidad"}</div>{p.short_description&&<p className="premium-description">{p.short_description}</p>}<div className="premium-product-cta"><button disabled title="Disponible en una próxima etapa, después de validar integración con el carrito" className="premium-cta premium-disabled">Compra en línea: próximamente</button><p>Esta es una vista privada de diseño. El carrito y las variantes se conectarán al flujo existente tras validar existencias y precios.</p></div><div className="premium-product-facts"><div><span>CÓDIGO</span><strong>{p.sku || "—"}</strong></div>{p.item_condition&&<div><span>CONDICIÓN</span><strong>{p.item_condition}</strong></div>}</div></div></div>{p.description&&<section className="premium-detail-description"><h2>Detalles del producto</h2><p>{p.description}</p></section>}</main><Footer/></div>;
}
