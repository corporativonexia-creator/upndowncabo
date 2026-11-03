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
  featured: boolean | null; created_at?: string | null;
  product_images?: { id: string; image_url: string; alt_text: string | null; sort_order: number | null; is_primary: boolean | null }[] | null;
};
type StoreProps = { categories: Category[]; products: Product[] };
const money = (value: number, currency: string | null) => new Intl.NumberFormat("es-MX", { style: "currency", currency: currency === "USD" ? "USD" : "MXN", maximumFractionDigits: 0 }).format(value);
const imageOf = (p: Product) => p.cover_image_url || p.product_images?.find((i) => i.is_primary)?.image_url || p.product_images?.[0]?.image_url || "";
const productUrl = (p: Product) => `/premium-preview/producto/${encodeURIComponent(p.slug || p.id)}`;
function Photo({ src, alt, className = "" }: { src: string; alt: string; className?: string }) {
  return src ? <img className={className} src={src} alt={alt} loading="lazy" /> : <div className={`premium-placeholder ${className}`} aria-label="Imagen no disponible"><span>UP AND DOWN</span></div>;
}

const productPrice = (p: Product) => (p.sale_price != null && p.sale_price > 0 && (p.price == null || p.sale_price < p.price)) ? p.sale_price : p.price ?? 0;
const categoryUrl = (id: string) => "/premium-preview?categoria=" + encodeURIComponent(id) + "#catalogo";
const calendarOrder = (a: Product, b: Product) => (b.created_at || "").localeCompare(a.created_at || "");

function Header({ categories }: { categories: Category[] }) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [categoryOpen, setCategoryOpen] = useState(false);
  return <header className="premium-site-head">
    <div className="premium-announcement"><span>UP AND DOWN · CABO GOLF SHOP</span><span>UNA SELECCIÓN PARA CADA RONDA</span></div>
    <div className="premium-nav-wrap">
      <Link href="/premium-preview" className="premium-official-brand" aria-label="UP AND DOWN, inicio"><img src="/assets/updown-logo-official.svg" alt="UP AND DOWN" /><span>CABO GOLF SHOP</span></Link>
      <nav className="premium-main-nav" aria-label="Navegación principal">
        <Link href="/premium-preview">Inicio</Link>
        <Link href="/premium-preview#novedades">Novedades</Link>
        <div className="premium-categories-nav">
          <button type="button" aria-haspopup="true" aria-expanded={categoryOpen} onClick={() => setCategoryOpen(v => !v)}>Categorías <span aria-hidden="true">⌄</span></button>
          {categoryOpen && <div className="premium-category-dropdown"><span className="premium-kicker">EXPLORA POR CATEGORÍA</span><div className="premium-category-dropdown-grid">{categories.map(c => <Link key={c.id} href={categoryUrl(c.id)} onClick={() => setCategoryOpen(false)}>{c.name}<span aria-hidden="true">↗</span></Link>)}</div></div>}
        </div>
        <Link href="/premium-preview#catalogo">Tienda</Link>
      </nav>
      <div className="premium-header-actions">
        <Link className="premium-search-shortcut" href="/premium-preview#catalogo" aria-label="Buscar productos"><svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round"><circle cx="10.8" cy="10.8" r="6.8"/><path d="m16 16 5 5"/></svg></Link>
        <span className="premium-preview-flag">VISTA DE PRUEBA</span>
        <button type="button" className="premium-menu-toggle" aria-label={menuOpen ? "Cerrar menú" : "Abrir menú"} aria-expanded={menuOpen} onClick={() => setMenuOpen(v => !v)}><span/><span/><span/></button>
      </div>
    </div>
    {menuOpen && <nav className="premium-mobile-menu" aria-label="Menú móvil">
      <Link href="/premium-preview" onClick={() => setMenuOpen(false)}>Inicio</Link>
      <Link href="/premium-preview#novedades" onClick={() => setMenuOpen(false)}>Novedades</Link>
      <Link href="/premium-preview#catalogo" onClick={() => setMenuOpen(false)}>Todos los productos</Link>
      <strong>Categorías</strong>
      <div className="premium-mobile-categories">{categories.map(c => <Link key={c.id} href={categoryUrl(c.id)} onClick={() => setMenuOpen(false)}>{c.name}<span aria-hidden="true">↗</span></Link>)}</div>
    </nav>}
  </header>;
}
function Footer() {
  return <footer className="premium-footer"><div><strong>UP AND DOWN</strong><span>Cabo Golf Shop · Los Cabos, México</span></div><div><span>Una tienda especializada en golf</span><span>Vista privada de diseño · Compras desactivadas</span></div></footer>;
}
function ProductCard({ p }: { p: Product }) {
  const current = productPrice(p);
  const discount = p.price != null && current < p.price;
  return <Link href={productUrl(p)} className="premium-card">
    <div className="premium-card-photo"><Photo src={imageOf(p)} alt={p.name}/>
      {p.stock != null && p.stock <= 0 ? <span className="premium-tag">Consultar disponibilidad</span> : discount ? <span className="premium-tag premium-sale-tag">Precio especial</span> : null}
      <span className="premium-card-discover" aria-hidden="true">Ver producto ↗</span>
    </div>
    <div className="premium-card-meta"><span className="premium-eyebrow">{p.brand || "UP AND DOWN"}</span><h3>{p.name}</h3><div className="premium-card-prices"><strong>{money(current,p.currency)}</strong>{discount && <del>{money(p.price!,p.currency)}</del>}</div></div>
  </Link>;
}
function ProductRail({ id, label, title, products, linkLabel = "Ver toda la colección" }: { id: string; label: string; title: string; products: Product[]; linkLabel?: string }) {
  if (!products.length) return null;
  return <section id={id} className="premium-product-section">
    <div className="premium-rail-head"><div><span className="premium-kicker">{label}</span><h2>{title}</h2></div><a href="#catalogo" className="premium-section-link">{linkLabel}<span aria-hidden="true">↗</span></a></div>
    <div className="premium-product-rail">{products.slice(0,4).map(p => <ProductCard key={p.id} p={p}/>)}</div>
  </section>;
}
export function PremiumStorefront({ categories, products, initialCategory = "" }: StoreProps & { initialCategory?: string }) {
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState(initialCategory && categories.some(c => c.id === initialCategory) ? initialCategory : "all");
  const [brand, setBrand] = useState("all");
  const [order, setOrder] = useState("featured");
  const brands = useMemo(() => [...new Set(products.map(p => p.brand?.trim()).filter((v): v is string => Boolean(v)))].sort((a,b)=>a.localeCompare(b,"es")), [products]);
  const hasCategory = (id: string) => products.some(p=>p.category_id===id);
  const activeCategories = categories.filter(c=>hasCategory(c.id));
  const latest = [...products].sort(calendarOrder).slice(0,4);
  const featured = products.filter(p=>p.featured).slice(0,4);
  const heroProduct = products.find(p=>p.featured && imageOf(p)) || products.find(p=>imageOf(p));
  const items = useMemo(() => {
    const q = search.trim().toLocaleLowerCase("es");
    const result = products.filter(p => (category === "all" || p.category_id === category) && (brand === "all" || p.brand === brand) && (!q || [p.name,p.brand,p.model,p.sku,p.short_description].some(v => (v || "").toLocaleLowerCase("es").includes(q))));
    if(order === "recent") result.sort(calendarOrder);
    if(order === "low") result.sort((a,b)=>productPrice(a)-productPrice(b));
    if(order === "high") result.sort((a,b)=>productPrice(b)-productPrice(a));
    if(order === "name") result.sort((a,b)=>a.name.localeCompare(b.name,"es"));
    if(order === "featured") result.sort((a,b)=>Number(Boolean(b.featured))-Number(Boolean(a.featured)) || calendarOrder(a,b));
    return result;
  }, [products,search,category,brand,order]);
  return <div className="premium-root"><Header categories={categories}/><main>
    <section className="premium-new-hero">
      <div className="premium-new-hero-copy"><span className="premium-kicker">GOLF · LOS CABOS</span><h1>Equípate para<br/><em>tu mejor ronda.</em></h1><p>Explora bastones, ropa, calzado y accesorios de golf cuidadosamente seleccionados.</p><div className="premium-hero-actions"><a href="#catalogo" className="premium-cta">Comprar por categoría <span aria-hidden="true">↗</span></a><a className="premium-hero-alt" href="#novedades">Ver novedades <span aria-hidden="true">→</span></a></div></div>
      <div className="premium-new-hero-image">{heroProduct ? <Link href={productUrl(heroProduct)} aria-label={"Ver "+heroProduct.name}><Photo src={imageOf(heroProduct)} alt={heroProduct.name} className="premium-hero-product-photo"/><span className="premium-hero-caption"><small>EN LA COLECCIÓN</small><strong>{heroProduct.name}</strong><span>Descubrir producto ↗</span></span></Link> : <div className="premium-hero-abstract"><span>THE GAME,<br/>ELEVATED.</span></div>}</div>
    </section>
    <div className="premium-benefit-strip" aria-label="Ventajas de navegar en UP AND DOWN"><span>GOLF SHOP EN LOS CABOS</span><span>SELECCIÓN POR CATEGORÍAS</span><span>PRODUCTOS CON FICHA INDIVIDUAL</span></div>
    <div className="premium-content">
      <ProductRail id="novedades" label="DESCUBRE LO RECIÉN AGREGADO" title="Novedades" products={latest}/>
      {activeCategories.length>0 && <section id="categorias" className="premium-categories-section"><div className="premium-rail-head"><div><span className="premium-kicker">ENCUENTRA LO QUE NECESITAS</span><h2>Compra por categoría</h2></div><a className="premium-section-link" href="#catalogo">Todas las categorías <span aria-hidden="true">↗</span></a></div><div className="premium-category-tiles">{activeCategories.slice(0,8).map(c=>{const cover=products.find(p=>p.category_id===c.id&&imageOf(p));return <a key={c.id} href="#catalogo" className="premium-category-tile" onClick={()=>{setCategory(c.id);setBrand("all");setSearch("");}}><div className="premium-category-photo">{cover ? <Photo src={imageOf(cover)} alt={c.name}/> : <span className="premium-category-no-photo">GOLF</span>}</div><span>{c.name}<span aria-hidden="true">↗</span></span></a>;})}</div></section>}
      <ProductRail id="destacados" label="SELECCIÓN UP AND DOWN" title="Destacados" products={featured}/>
      <section id="catalogo" className="premium-collection">
        <div className="premium-rail-head"><div><span className="premium-kicker">EXPLORA NUESTRO INVENTARIO ONLINE</span><h2>Todos los productos</h2></div><p>Elige, compara y encuentra tu próximo favorito.</p></div>
        <div className="premium-toolbar">
          <label className="premium-search"><svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7"><circle cx="10.5" cy="10.5" r="6.5"/><path d="m15.5 15.5 5 5"/></svg><input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Buscar producto, marca o código" aria-label="Buscar productos"/></label>
          <label className="premium-select"><span>Categoría</span><select value={category} onChange={e=>setCategory(e.target.value)} aria-label="Filtrar categoría"><option value="all">Todas</option>{categories.map(c=><option key={c.id} value={c.id}>{c.name}</option>)}</select></label>
          <label className="premium-select"><span>Marca</span><select value={brand} onChange={e=>setBrand(e.target.value)} aria-label="Filtrar marca"><option value="all">Todas</option>{brands.map(b=><option key={b} value={b}>{b}</option>)}</select></label>
          <label className="premium-select"><span>Ordenar</span><select value={order} onChange={e=>setOrder(e.target.value)} aria-label="Ordenar productos"><option value="featured">Destacados</option><option value="recent">Más recientes</option><option value="low">Menor precio</option><option value="high">Mayor precio</option><option value="name">Nombre A–Z</option></select></label>
        </div>
        <div className="premium-catalog-summary"><span>{items.length} {items.length===1?"producto":"productos"}</span>{(category!=="all"||brand!=="all"||search) && <button type="button" onClick={()=>{setCategory("all");setBrand("all");setSearch("");}}>Limpiar filtros ×</button>}</div>
        <div className="premium-grid">{items.map(p=><ProductCard key={p.id} p={p}/>)}</div>
        {!items.length && <div className="premium-empty"><h3>No encontramos resultados</h3><p>Prueba con otra categoría o una búsqueda más general.</p><button type="button" onClick={()=>{setSearch("");setCategory("all");setBrand("all");}}>Ver todos los productos</button></div>}
      </section>
    </div>
  </main><Footer/></div>;
}

export function PremiumProductDetail({ product: p, categories = [], related = [] }: { product: Product; categories?: Category[]; related?: Product[] }) {
  const images = Array.from(new Set([imageOf(p),...(p.product_images || []).slice().sort((a,b)=>(a.sort_order || 0)-(b.sort_order || 0)).map(i=>i.image_url)].filter(Boolean)));
  const [selected,setSelected] = useState(0);
  const amount = productPrice(p);
  const cat=categories.find(c=>c.id===p.category_id);
  const back=cat?categoryUrl(cat.id):"/premium-preview#catalogo";
  return <div className="premium-root"><Header categories={categories}/><main className="premium-detail">
    <nav className="premium-breadcrumb" aria-label="Ruta de navegación"><Link href="/premium-preview">Inicio</Link><span>›</span><Link href={back}>{cat?.name||"Tienda"}</Link><span>›</span><span aria-current="page">{p.name}</span></nav>
    <div className="premium-detail-grid">
      <div className="premium-gallery"><div className="premium-main-photo"><Photo src={images[selected] || ""} alt={p.name}/></div>{images.length>1 && <div className="premium-thumbs">{images.map((url,i)=><button key={url} type="button" aria-label={"Ver imagen "+(i+1)} aria-pressed={i===selected} onClick={()=>setSelected(i)}><Photo src={url} alt={p.name+", imagen "+(i+1)}/></button>)}</div>}</div>
      <div className="premium-product-copy"><span className="premium-kicker">{p.brand||"UP AND DOWN"}{cat?" · "+cat.name:""}</span><h1>{p.name}</h1>{p.model&&<p className="premium-model">{p.model}</p>}<p className="premium-price">{money(amount,p.currency)}</p>{p.price!=null&&amount<p.price&&<p className="premium-old-price">Antes {money(p.price,p.currency)}</p>}
        <div className="premium-availability"><span className="premium-in"/><span>Disponibilidad y precio final sujetos a la variante elegida</span></div>
        {p.short_description&&<p className="premium-description">{p.short_description}</p>}
        <div className="premium-product-cta"><button type="button" disabled className="premium-cta premium-disabled">Agregar al carrito · En preparación</button><small>Esta es una vista privada de diseño. Aún no se realizan compras aquí.</small><Link href="/vista-previa" className="premium-link-current">Abrir la tienda anterior ↗</Link></div>
        <div className="premium-product-facts"><div><span>CÓDIGO DEL PRODUCTO</span><strong>{p.sku||"—"}</strong></div>{p.item_condition&&<div><span>CONDICIÓN</span><strong>{p.item_condition}</strong></div>}</div>
      </div>
    </div>
    {p.description&&<section className="premium-detail-description"><h2>Descripción y detalles</h2><p>{p.description}</p></section>}
    {related.length>0&&<section className="premium-related"><div className="premium-rail-head"><div><span className="premium-kicker">SIGUE EXPLORANDO</span><h2>También podría interesarte</h2></div><Link href={back} className="premium-section-link">Ver categoría ↗</Link></div><div className="premium-product-rail">{related.slice(0,4).map(item=><ProductCard key={item.id} p={item}/>)}</div></section>}
  </main><Footer/></div>;
}
