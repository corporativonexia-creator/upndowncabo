"use client";

import { useEffect, useRef, useState } from "react";
import "./store-search.css";

type SearchProduct = { id: string; name: string; category: string; image: string; price: string };
declare global {
  interface Window {
    __UPDOWN_SEARCH_PRODUCTS__?: (query: string) => SearchProduct[];
    __UPDOWN_OPEN_SEARCH_PRODUCT__?: (id: string) => boolean;
    __UPDOWN_SEARCH_STATUS__?: "loading" | "ready" | "error";
  }
}
const RECENTS_KEY = "upDownSearchRecentV1";
const categories = ["Drivers", "Fairway Woods", "Irons", "Putters", "Wedges"];
const brands = ["TaylorMade", "Callaway"];

export function StoreSearch() {
  const dialog = useRef<HTMLDialogElement>(null);
  const input = useRef<HTMLInputElement>(null);
  const swipe = useRef<{ x: number; y: number } | null>(null);
  const restorePage = useRef<(() => void) | null>(null);
  const opener = useRef<HTMLElement | null>(null);
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [english, setEnglish] = useState(false);
  const [recent, setRecent] = useState<string[]>([]);
  const [limit, setLimit] = useState(6);
  const [, setCatalogVersion] = useState(0);
  const label = (es: string, en: string) => english ? en : es;

  useEffect(() => {
    const syncLanguage = () => setEnglish(document.documentElement.lang.startsWith("en"));
    const syncCatalog = () => setCatalogVersion(version => version + 1);
    const show = () => {
      opener.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
      setQuery(""); setLimit(6); setOpen(true);
      try {
        const saved: unknown = JSON.parse(localStorage.getItem(RECENTS_KEY) || "[]");
        setRecent(Array.isArray(saved) ? saved.filter((value): value is string => typeof value === "string" && value.length > 0 && value.length <= 80).slice(0, 4) : []);
      } catch { setRecent([]); }
    };
    const dispose = () => { setOpen(false); dialog.current?.close(); restorePage.current?.(); };
    syncLanguage();
    window.addEventListener("updown:open-search", show);
    window.addEventListener("updown:language-change", syncLanguage);
    window.addEventListener("updown:catalog-ready", syncCatalog);
    window.addEventListener("updown:storefront-dispose", dispose);
    return () => {
      window.removeEventListener("updown:open-search", show);
      window.removeEventListener("updown:language-change", syncLanguage);
      window.removeEventListener("updown:catalog-ready", syncCatalog);
      window.removeEventListener("updown:storefront-dispose", dispose);
    };
  }, []);

  useEffect(() => {
    if (!open) return;
    const node = dialog.current;
    if (!node) return;
    const body = document.body;
    const properties = ["position", "top", "left", "right", "width", "overflow"];
    const saved = properties.map(property => [property, body.style.getPropertyValue(property), body.style.getPropertyPriority(property)]);
    const y = window.scrollY;
    let restored = false;
    const restore = () => {
      if (restored) return;
      restored = true;
      saved.forEach(([property, value, priority]) => { if (value) body.style.setProperty(property, value, priority); else body.style.removeProperty(property); });
      window.scrollTo({ top: y, behavior: "instant" });
    };
    restorePage.current = restore;
    body.style.position = "fixed"; body.style.top = `-${y}px`; body.style.left = "0"; body.style.right = "0"; body.style.width = "100%"; body.style.overflow = "hidden";
    node.showModal();
    input.current?.focus({ preventScroll: true });
    return () => { node.close(); restore(); restorePage.current = null; };
  }, [open]);

  const remember = (value: string) => {
    const clean = value.trim().slice(0, 80);
    if (!clean) return;
    const next = [clean, ...recent.filter(item => item.toLowerCase() !== clean.toLowerCase())].slice(0, 4);
    setRecent(next);
    try { localStorage.setItem(RECENTS_KEY, JSON.stringify(next)); } catch { /* Search works with storage disabled. */ }
  };
  const close = (restoreFocus = true) => {
    dialog.current?.close(); restorePage.current?.(); setOpen(false);
    if (restoreFocus && opener.current?.isConnected) opener.current.focus({ preventScroll: true });
  };
  const choose = (value: string) => { setQuery(value); setLimit(6); remember(value); input.current?.blur(); };
  const results = open && query.trim() ? window.__UPDOWN_SEARCH_PRODUCTS__?.(query) || [] : [];
  const ready = open && window.__UPDOWN_SEARCH_STATUS__ === "ready";
  const failed = open && window.__UPDOWN_SEARCH_STATUS__ === "error";

  return <dialog ref={dialog} className="uds-search-panel" aria-labelledby="udsSearchHeading" onCancel={event => { event.preventDefault(); close(); }}>
    <div className="uds-search-shell">
      <div className="uds-search-heading" onTouchStart={event => { const touch = event.touches[0]; swipe.current = event.touches.length === 1 ? { x: touch.clientX, y: touch.clientY } : null; }} onTouchCancel={() => { swipe.current = null; }} onTouchEnd={event => {
        const start = swipe.current; swipe.current = null;
        const touch = event.changedTouches[0];
        if (start && touch && touch.clientY - start.y > 75 && Math.abs(touch.clientX - start.x) < 45) close();
      }}>
        <span className="uds-search-handle" aria-hidden="true" />
        <span className="uds-search-signature" translate="no">UP AND DOWN</span>
        <h2 id="udsSearchHeading">{label("Encuentra tu próximo equipo", "Find your next club")}</h2>
        <button type="button" className="uds-search-dismiss" aria-label={label("Cerrar búsqueda", "Close search")} onClick={() => close()}><svg viewBox="0 0 24 24" aria-hidden="true"><path d="m6 6 12 12M18 6 6 18" /></svg></button>
      </div>
      <form className="uds-search-form" role="search" onSubmit={event => { event.preventDefault(); remember(query); input.current?.blur(); }}>
        <svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="10.5" cy="10.5" r="6.5" /><path d="m16 16 4 4" /></svg>
        <input ref={input} type="search" enterKeyHint="search" autoComplete="off" maxLength={80} value={query} aria-label={label("Buscar por producto, marca o modelo", "Search by product, brand or model")} placeholder={label("Producto, marca o modelo…", "Product, brand or model…")} onChange={event => { setQuery(event.target.value); setLimit(6); }} />
        {query && <button type="button" aria-label={label("Borrar búsqueda", "Clear search")} onClick={() => { setQuery(""); setLimit(6); input.current?.focus(); }}>×</button>}
      </form>
      <div className="uds-search-content">
        {!query.trim() ? <>
          <section aria-label={label("Categorías", "Categories")}><h3>{label("Explora por categoría", "Explore by category")}</h3><div className="uds-search-chips">{categories.map(value => <button key={value} type="button" onClick={() => choose(value)}>{value}</button>)}</div></section>
          <section aria-label={label("Marcas", "Brands")}><h3>{label("Busca por marca", "Search by brand")}</h3><div className="uds-search-chips is-brands">{brands.map(value => <button key={value} type="button" onClick={() => choose(value)}>{value}<span aria-hidden="true">↗</span></button>)}</div></section>
          {recent.length > 0 && <section><div className="uds-search-section-head"><h3>{label("Búsquedas recientes", "Recent searches")}</h3><button type="button" onClick={() => { setRecent([]); try { localStorage.removeItem(RECENTS_KEY); } catch {} }}>{label("Borrar", "Clear")}</button></div><div className="uds-search-recents">{recent.map(value => <button key={value} type="button" onClick={() => choose(value)}><span aria-hidden="true">↶</span>{value}</button>)}</div></section>}
        </> : <>
          <p className="uds-search-count" role="status" aria-live="polite">{failed ? label("No pudimos cargar el catálogo. Intenta recargar la página.", "We couldn't load the catalog. Try reloading the page.") : !ready ? label("Cargando equipo…", "Loading equipment…") : `${results.length} ${label(results.length === 1 ? "resultado" : "resultados", results.length === 1 ? "result" : "results")}`}</p>
          {ready && !results.length && <div className="uds-search-empty"><strong>{label("Probemos con otra búsqueda", "Let's try another search")}</strong><p>{label("Escribe una marca, un modelo o una categoría como Drivers.", "Try a brand, a model or a category such as Drivers.")}</p><button type="button" onClick={() => { setQuery(""); input.current?.focus(); }}>{label("Ver categorías", "Explore categories")}</button></div>}
          <div className="uds-search-results">{results.slice(0, limit).map(product => <button type="button" className="uds-search-result" key={product.id} onClick={() => {
            remember(query); close(false);
            // Open after the dialog's body-lock cleanup, preserving product-modal scrolling.
            window.setTimeout(() => window.__UPDOWN_OPEN_SEARCH_PRODUCT__?.(product.id), 0);
          }}>
            <span className="uds-search-thumb">{/* Product photos may use existing external catalog hosts. */}
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={product.image || "/assets/category-placeholder.svg"} alt="" loading="lazy" width={76} height={76} onError={event => { if (!event.currentTarget.src.endsWith("/assets/category-placeholder.svg")) event.currentTarget.src = "/assets/category-placeholder.svg"; }} />
            </span>
            <span className="uds-search-result-copy"><small>{product.category}</small><strong>{product.name}</strong><span>{product.price}</span></span><span className="uds-search-arrow" aria-hidden="true">›</span>
          </button>)}</div>
          {results.length > limit && <button type="button" className="uds-search-more" onClick={() => setLimit(value => value + 6)}>{label("Ver más resultados", "View more results")}</button>}
        </>}
      </div>
    </div>
  </dialog>;
}
