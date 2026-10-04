"use client";

import { useEffect, useMemo, useState } from "react";

function clickLegacyControl(...ids: string[]) {
  for (const id of ids) {
    const node = document.getElementById(id) as HTMLElement | null;
    if (node) {
      node.click();
      return true;
    }
  }
  return false;
}

function scrollToId(id: string) {
  const node = document.getElementById(id);
  if (node) node.scrollIntoView({ behavior: "smooth", block: "start" });
}

function collectVisibleProducts() {
  return Array.from(document.querySelectorAll<HTMLElement>("#udsGrid .uds-card"))
    .map((card) => ({
      name: card.querySelector("h3")?.textContent?.trim() || "",
      brand: card.querySelector(".uds-category")?.textContent?.trim() || "",
      card,
    }))
    .filter((item) => item.name);
}

export function MobileHeader() {
  const [searchOpen, setSearchOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [suggestions, setSuggestions] = useState<Array<{ name: string; brand: string; card: HTMLElement }>>([]);

  useEffect(() => {
    if (!searchOpen && !menuOpen) {
      document.body.style.overflow = "";
      return;
    }
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = ""; };
  }, [searchOpen, menuOpen]);

  const quickSearches = useMemo(() => ["Drivers", "Maderas", "Hierros", "Putters", "TaylorMade", "Callaway"], []);

  const runSearch = (value: string) => {
    setQuery(value);
    const input = document.getElementById("udsSearch") as HTMLInputElement | null;
    if (input) {
      input.value = value;
      input.dispatchEvent(new Event("input", { bubbles: true }));
    }
    window.setTimeout(() => {
      const normalized = value.trim().toLowerCase();
      const all = collectVisibleProducts();
      setSuggestions(
        normalized
          ? all.filter((item) => `${item.name} ${item.brand}`.toLowerCase().includes(normalized)).slice(0, 8)
          : []
      );
    }, 80);
  };

  const openProductFromSuggestion = (card: HTMLElement) => {
    const button = card.querySelector<HTMLElement>(".uds-view-equipment");
    setSearchOpen(false);
    button?.click();
  };

  const navigate = (id: string) => {
    setMenuOpen(false);
    window.setTimeout(() => scrollToId(id), 30);
  };

  return (
    <>
      <header className="uds-native-mobile-header" aria-label="Navegación móvil">
        <a className="uds-native-mobile-logo" href="#udsHome" aria-label="UP AND DOWN, inicio">
          <svg viewBox="0 0 1919 633" aria-hidden="true" focusable="false">
            <path d="M 1918 573 L 1904 569 L 1809 588 L 1686 599 L 1532 592 L 1346 552 L 1103 476 L 1103 216 L 1351 136 L 1364 126 L 1106 5 L 1084 0 L 1075 5 L 1072 468 L 960 443 L 863 432 L 774 430 L 641 440 L 442 480 L 124 574 L 9 596 L 0 610 L 15 617 L 118 601 L 551 492 L 670 474 L 755 469 L 892 474 L 1004 492 L 1343 594 L 1436 615 L 1548 630 L 1655 632 L 1751 623 L 1913 587 Z" fill="currentColor" />
          </svg>
        </a>

        <nav className="uds-native-mobile-actions" aria-label="Acciones rápidas">
          <button type="button" aria-label="Buscar" onClick={() => { setMenuOpen(false); setSearchOpen(true); setSuggestions([]); setQuery(""); }}>
            <svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="11" cy="11" r="6.5"/><path d="m16 16 4 4"/></svg>
          </button>
          <button type="button" aria-label="Carrito" onClick={() => clickLegacyControl("udsFloatingCart", "udsCartButton", "udsDockCart")}>
            <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 4h2l2.1 10.2a2 2 0 0 0 2 1.6h7.8a2 2 0 0 0 2-1.6L20 8H6.2"/><circle cx="10" cy="20" r="1"/><circle cx="18" cy="20" r="1"/></svg>
          </button>
          <button type="button" aria-label="Menú" onClick={() => { setSearchOpen(false); setMenuOpen(true); }}>
            <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 7h16M4 12h16M4 17h16"/></svg>
          </button>
        </nav>
      </header>

      {searchOpen && (
        <div className="uds-native-search" role="dialog" aria-modal="true" aria-label="Buscar productos">
          <div className="uds-native-search-bar">
            <svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="11" cy="11" r="6.5"/><path d="m16 16 4 4"/></svg>
            <input autoFocus value={query} onChange={(event) => runSearch(event.target.value)} placeholder="Buscar" aria-label="Buscar productos" />
            {query && <button className="uds-native-search-clear" type="button" aria-label="Limpiar búsqueda" onClick={() => runSearch("")}>×</button>}
          </div>
          <button className="uds-native-search-close" type="button" aria-label="Cerrar búsqueda" onClick={() => setSearchOpen(false)}>×</button>

          <div className="uds-native-search-body">
            {!query && (
              <>
                <div className="uds-native-search-label">Búsquedas rápidas</div>
                <div className="uds-native-search-links">
                  {quickSearches.map((item) => <button key={item} type="button" onClick={() => runSearch(item)}>→ <span>{item}</span></button>)}
                </div>
              </>
            )}

            {query && (
              <>
                <div className="uds-native-search-label">Sugerencias</div>
                <div className="uds-native-search-links">
                  {suggestions.length ? suggestions.map((item, index) => (
                    <button key={`${item.name}-${index}`} type="button" onClick={() => openProductFromSuggestion(item.card)}>
                      → <span>{item.name}</span>
                    </button>
                  )) : <div className="uds-native-search-empty">Sin coincidencias todavía.</div>}
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {menuOpen && (
        <div className="uds-native-menu" role="dialog" aria-modal="true" aria-label="Menú">
          <div className="uds-native-menu-head"><strong>NAVEGACIÓN</strong><button type="button" aria-label="Cerrar menú" onClick={() => setMenuOpen(false)}>×</button></div>
          <button className="uds-native-menu-search" type="button" onClick={() => { setMenuOpen(false); setSearchOpen(true); }}>Buscar equipo… <span>⌕</span></button>
          <div className="uds-native-menu-shortcuts">
            <button type="button" onClick={() => navigate("udsGolfClasses")}><small>ACCESO DIRECTO</small><strong>Clases de golf</strong></button>
            <a href="https://wa.me/526241299870?text=Hola%20Carlos%20%F0%9F%91%8B%20Vengo%20de%20UP%20AND%20DOWN%20%C2%B7%20Coque.%20Me%20gustar%C3%ADa%20recibir%20informaci%C3%B3n%20para%20unirme%20a%20GHIN%20y%20conocer%20c%C3%B3mo%20funciona%20el%20registro.%20Gracias." target="_blank" rel="noopener"><small>HANDICAP OFICIAL</small><strong>GHIN</strong></a>
          </div>
          <div className="uds-native-menu-list">
            <button type="button" onClick={() => navigate("udsCatalog")}>Tienda <span>›</span></button>
            <button type="button" onClick={() => navigate("udsCategories")}>Categorías <span>›</span></button>
            <button type="button" onClick={() => navigate("udsServices")}>Servicios <span>›</span></button>
            <button type="button" onClick={() => navigate("udsCourses")}>Golf en Los Cabos <span>›</span></button>
            <button type="button" onClick={() => navigate("udsAbout")}>Quiénes somos</button>
            <button type="button" onClick={() => { setMenuOpen(false); clickLegacyControl("udsAdvisorContact"); }}>Hablar con un asesor</button>
          </div>
          <div className="uds-native-menu-foot">UP AND DOWN · Los Cabos<br/>WhatsApp · 624 171 0903</div>
        </div>
      )}
    </>
  );
}
