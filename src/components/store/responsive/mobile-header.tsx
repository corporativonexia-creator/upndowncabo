"use client";

import { useEffect, useState } from "react";
import { getStorefrontText, type StorefrontLanguage } from "../storefront-copy";

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
  const [language, setLanguage] = useState<StorefrontLanguage>("es");
  const [, setCopyVersion] = useState(0);
  const t = (key: string) => getStorefrontText(key, language);
  useEffect(() => {
    const sync = () => { setLanguage(document.documentElement.lang.startsWith("en") ? "en" : "es"); setCopyVersion((value) => value + 1); };
    sync();
    window.addEventListener("updown:language-change", sync);
    window.addEventListener("updown:copy-ready", sync);
    return () => { window.removeEventListener("updown:language-change", sync); window.removeEventListener("updown:copy-ready", sync); };
  }, []);
  const chooseLanguage = (next: StorefrontLanguage) => {
    if (window.__UPDOWN_SET_LANGUAGE__) window.__UPDOWN_SET_LANGUAGE__(next);
    else { localStorage.setItem("upDownLanguage", next); clickLegacyControl(next === "en" ? "udsLangEn" : "udsLangEs"); }
    setLanguage(next);
  };
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

  const quickSearches = [
    { label: language === "en" ? "Drivers" : "Palos de salida", query: "driver" },
    { label: language === "en" ? "Fairway woods" : "Maderas", query: "madera" },
    { label: language === "en" ? "Irons" : "Hierros", query: "hierro" },
    { label: language === "en" ? "Putters" : "Palos de precisión", query: "putter" },
    { label: "TaylorMade", query: "TaylorMade" }, { label: "Callaway", query: "Callaway" },
  ];

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

        <nav className="uds-native-mobile-actions" aria-label={language === "en" ? "Quick actions" : "Acciones rápidas"}>
          <div className="uds-native-language" role="group" aria-label={language === "en" ? "Language" : "Idioma"}>
            <button type="button" lang="es" aria-label="Español" aria-pressed={language === "es"} onClick={() => chooseLanguage("es")}>ES</button>
            <button type="button" lang="en" aria-label="English" aria-pressed={language === "en"} onClick={() => chooseLanguage("en")}>EN</button>
          </div>
          <button type="button" aria-label={t("mobile.search")} onClick={() => { setMenuOpen(false); setSearchOpen(true); setSuggestions([]); setQuery(""); }}>
            <svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="11" cy="11" r="6.5"/><path d="m16 16 4 4"/></svg>
          </button>
          <button type="button" aria-label={t("mobile.cart")} onClick={() => clickLegacyControl("udsFloatingCart", "udsCartButton", "udsDockCart")}>
            <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 4h2l2.1 10.2a2 2 0 0 0 2 1.6h7.8a2 2 0 0 0 2-1.6L20 8H6.2"/><circle cx="10" cy="20" r="1"/><circle cx="18" cy="20" r="1"/></svg>
          </button>
          <button type="button" aria-label={t("mobile.menu")} onClick={() => { setSearchOpen(false); setMenuOpen(true); }}>
            <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 7h16M4 12h16M4 17h16"/></svg>
          </button>
        </nav>
      </header>

      {searchOpen && (
        <div className="uds-native-search" role="dialog" aria-modal="true" aria-label={t("mobile.searchProducts")}>
          <div className="uds-native-search-bar">
            <svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="11" cy="11" r="6.5"/><path d="m16 16 4 4"/></svg>
            <input autoFocus value={query} onChange={(event) => runSearch(event.target.value)} placeholder={t("mobile.search")} aria-label={t("mobile.searchProducts")} />
            {query && <button className="uds-native-search-clear" type="button" aria-label={t("mobile.clearSearch")} onClick={() => runSearch("")}>×</button>}
          </div>
          <button className="uds-native-search-close" type="button" aria-label={t("mobile.closeSearch")} onClick={() => setSearchOpen(false)}>×</button>

          <div className="uds-native-search-body">
            {!query && (
              <>
                <div className="uds-native-search-label">{t("mobile.quickSearches")}</div>
                <div className="uds-native-search-links">
                  {quickSearches.map((item) => <button key={item.query} type="button" onClick={() => runSearch(item.query)}>→ <span>{item.label}</span></button>)}
                </div>
              </>
            )}

            {query && (
              <>
                <div className="uds-native-search-label">{t("mobile.suggestions")}</div>
                <div className="uds-native-search-links">
                  {suggestions.length ? suggestions.map((item, index) => (
                    <button key={`${item.name}-${index}`} type="button" onClick={() => openProductFromSuggestion(item.card)}>
                      → <span>{item.name}</span>
                    </button>
                  )) : <div className="uds-native-search-empty">{t("mobile.noMatches")}</div>}
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {menuOpen && (
        <div className="uds-native-menu" role="dialog" aria-modal="true" aria-label={t("mobile.menu")}>
          <div className="uds-native-menu-head"><strong>{t("mobile.navigation")}</strong><button type="button" aria-label={t("mobile.closeMenu")} onClick={() => setMenuOpen(false)}>×</button></div>
          <button className="uds-native-menu-search" type="button" onClick={() => { setMenuOpen(false); setSearchOpen(true); }}>{t("mobile.searchEquipment")} <span>⌕</span></button>
          <div className="uds-native-menu-shortcuts">
            <button type="button" onClick={() => navigate("udsGolfClasses")}><small>{t("mobile.shortcuts")}</small><strong>{t("mobile.classes")}</strong></button>
            <a data-ghin-contact="" href="https://wa.me/526241299870?text=Hola%20Carlos%20%F0%9F%91%8B%20Vengo%20de%20UP%20AND%20DOWN%20%C2%B7%20Coque.%20Me%20gustar%C3%ADa%20recibir%20informaci%C3%B3n%20para%20unirme%20a%20GHIN%20y%20conocer%20c%C3%B3mo%20funciona%20el%20registro.%20Gracias." target="_blank" rel="noopener"><small>{t("mobile.handicap")}</small><strong>GHIN</strong></a>
          </div>
          <div className="uds-native-menu-list">
            <button type="button" onClick={() => navigate("udsCatalog")}>{t("mobile.shop")} <span>›</span></button>
            <button type="button" onClick={() => navigate("udsCategories")}>{t("mobile.categories")} <span>›</span></button>
            <button type="button" onClick={() => navigate("udsServices")}>{t("mobile.services")} <span>›</span></button>
            <button type="button" onClick={() => navigate("udsCourses")}>{t("mobile.courses")} <span>›</span></button>
            <button type="button" onClick={() => navigate("udsJournal")}>{t("news.title")} <span>›</span></button>
            <button type="button" onClick={() => navigate("udsAbout")}>{t("mobile.about")}</button>
            <button type="button" onClick={() => { setMenuOpen(false); clickLegacyControl("udsAdvisorContact"); }}>{t("mobile.advisor")}</button>
          </div>
          <div className="uds-native-menu-foot">UP AND DOWN · Los Cabos<br/>WhatsApp · 624 355 4700</div>
        </div>
      )}
    </>
  );
}

