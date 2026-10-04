"use client";

import Image from "next/image";
import { useEffect, useState } from "react";
import { getStorefrontText, type StorefrontLanguage } from "../storefront-copy";

type MobileService = { key: string; title_es: string; title_en: string; image_url: string | null };
const VS_GOLF_SERVICE_KEY = "27a30f4f-018e-460a-9b7d-b1dc1488143f";
const VS_GOLF_LOGO = "https://xlkjztcxqlsegboivccg.supabase.co/storage/v1/object/public/site-content/services/0811b780-f34c-4b44-8816-50c04cecde0b/37180710-f81a-4b6f-aac3-a6bf5720bcff.png";
declare global {
  interface Window {
    __UPDOWN_SERVICES__?: MobileService[];
    __UPDOWN_OPEN_SERVICE__?: (key: string) => boolean;
  }
}

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

function openSearch() { window.dispatchEvent(new Event("updown:open-search")); }

export function MobileHeader() {
  const [services, setServices] = useState<MobileService[] | null>(null);
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
  useEffect(() => {
    const syncServices = () => setServices(window.__UPDOWN_SERVICES__ || null);
    syncServices();
    window.addEventListener("updown:services-ready", syncServices);
    return () => window.removeEventListener("updown:services-ready", syncServices);
  }, []);
  const chooseLanguage = (next: StorefrontLanguage) => {
    if (window.__UPDOWN_SET_LANGUAGE__) window.__UPDOWN_SET_LANGUAGE__(next);
    else { localStorage.setItem("upDownLanguage", next); clickLegacyControl(next === "en" ? "udsLangEn" : "udsLangEs"); }
    setLanguage(next);
  };
  const [menuOpen, setMenuOpen] = useState(false);
  useEffect(() => {
    if (!menuOpen) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = previous; };
  }, [menuOpen]);

  const navigate = (id: string) => {
    setMenuOpen(false);
    window.setTimeout(() => scrollToId(id), 30);
  };

  const navigateService = (key: string) => {
    setMenuOpen(false);
    window.setTimeout(() => { window.__UPDOWN_OPEN_SERVICE__?.(key); }, 40);
  };
  const shortcuts = [
    { key: "classes", title: t("mobile.classes"), subtitle: t("mobile.shortcuts") },
    { key: "ghin", title: "GHIN", subtitle: t("mobile.handicap") },
    { key: VS_GOLF_SERVICE_KEY, title: "VS Golf", subtitle: language === "en" ? "Putters & Wedges" : "Putters y Wedges" },
  ];
  const available = (key: string) => services === null || services.some(service => service.key === key);

  return (
    <>
      <header className="uds-native-mobile-header" aria-label="Navegación móvil">
        <a className="uds-native-mobile-logo" href="#udsHome" aria-label="UP AND DOWN, inicio">
          <svg viewBox="0 0 841.89 292.21" aria-hidden="true" focusable="false">
            <path d="M487.69,0c2.11,0,4.84.51,7.24.67,19.23,1.24,37.18,3.93,54.09,14.38l19.95,12.32c7.23,4.47,14.2,8.69,21.96,12.09,10.35,4.66,21.08,6.28,32.42,6.4l23.96.23-19.01,16.47c-3.62,3.13-7.52,5.51-11.66,7.98-17.32,10.34-35.07,8.55-54.04,3.73s-38.9-5.76-58.5-2.1c-7.43,1.39-14.49,2.98-21.75,5.63v131.14s54.16,17.53,54.16,17.53l68.64,21.12c13.32,3.67,26.34,6.32,39.98,8.62,57.26,9.69,111.58,7.83,166.77-10.79,2.46-.83,4.53,2.25,4.66,3.89.2,2.48-1.01,4.22-3.46,5.14-56.31,21.08-117.16,27.27-176.73,17.8-26.3-4.18-52.32-10.57-77.62-18.8l-91.08-29.62c-12.62-4.11-25.15-7.06-38.06-10.03-35.81-8.22-72.32-10.61-109.03-7.48-32.44,2.77-64.62,8.14-96.1,16.49l-128.11,34c-16.24,4.31-32.54,7.18-49.17,8.54l-14.51,1.18c-2.24.18-3.66-2.82-3.67-4.56s1.04-4.35,3.29-4.61c20.48-2.39,40.47-5.84,60.49-10.92,9.16-2.33,17.81-4.43,26.85-7.27l92.58-29.06c10.18-3.2,20.07-5.54,30.44-8.07,21.58-5.27,43.17-9.15,65.32-11.77,32.47-3.84,64.88-3.58,97.21.82,9.86,1.34,19.13,2.61,28.74,4.94l36.28,8.8.07-22.1.09-91.09-.14-91.6h17.45Z" fill="currentColor" />
          </svg>
          <span className="uds-native-mobile-wordmark" translate="no">UP AND DOWN</span>
        </a>

        <nav className="uds-native-mobile-actions" aria-label={language === "en" ? "Quick actions" : "Acciones rápidas"}>
          <div className="uds-native-language" role="group" aria-label={language === "en" ? "Language" : "Idioma"}>
            <button type="button" lang="es" aria-label="Español" aria-pressed={language === "es"} onClick={() => chooseLanguage("es")}>ES</button>
            <button type="button" lang="en" aria-label="English" aria-pressed={language === "en"} onClick={() => chooseLanguage("en")}>EN</button>
          </div>
          {available("ghin") && <button type="button" className="uds-native-service-logo" disabled={services === null} aria-label={language === "en" ? "View GHIN service" : "Ver servicio GHIN"} onClick={() => navigateService("ghin")}>
            <Image src="/assets/usga-ghin.png" width={34} height={34} sizes="40px" alt="USGA GHIN" />
          </button>}
          {available(VS_GOLF_SERVICE_KEY) && <button type="button" className="uds-native-service-logo is-vs-golf" disabled={services === null} aria-label={language === "en" ? "VS Golf: Putters and Wedges service" : "VS Golf: servicio de Putters y Wedges"} onClick={() => navigateService(VS_GOLF_SERVICE_KEY)}>
            <Image src={VS_GOLF_LOGO} width={34} height={34} sizes="40px" alt="VS Golf" />
          </button>}
          <button type="button" aria-label={t("mobile.search")} onClick={() => { setMenuOpen(false); openSearch(); }}>
            <svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="11" cy="11" r="6.5"/><path d="m16 16 4 4"/></svg>
          </button>
          <button type="button" aria-label={t("mobile.cart")} onClick={() => clickLegacyControl("udsFloatingCart", "udsCartButton", "udsDockCart")}>
            <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 4h2l2.1 10.2a2 2 0 0 0 2 1.6h7.8a2 2 0 0 0 2-1.6L20 8H6.2"/><circle cx="10" cy="20" r="1"/><circle cx="18" cy="20" r="1"/></svg>
          </button>
          <button type="button" className="uds-native-menu-trigger" aria-label={t("mobile.menu")} aria-expanded={menuOpen} onPointerUp={() => setMenuOpen(true)} onClick={() => setMenuOpen(true)}>
            <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 7h16M4 12h16M4 17h16"/></svg>
          </button>
        </nav>
      </header>

      {menuOpen && (
        <div className="uds-native-menu" role="dialog" aria-modal="true" aria-label={t("mobile.menu")}>
          <div className="uds-native-menu-head"><strong>{t("mobile.navigation")}</strong><button type="button" aria-label={t("mobile.closeMenu")} onClick={() => setMenuOpen(false)}>×</button></div>
          <button className="uds-native-menu-search" type="button" onClick={() => { setMenuOpen(false); window.setTimeout(openSearch, 0); }}>{t("mobile.searchEquipment")} <span>⌕</span></button>
          <div className="uds-native-menu-shortcuts">
            {services === null ? <p role="status">{language === "en" ? "Loading services…" : "Cargando servicios…"}</p> : shortcuts.map(shortcut => {
              const service = services.find(item => item.key === shortcut.key);
              if (!service) return null;
              const href = service.key === "classes" ? "#udsGolfClasses" : `#udsService-${service.key}`;
              return <a key={service.key} className="uds-native-service-card" href={href} onClick={event => { event.preventDefault(); navigateService(service.key); }}>
                <div className="uds-native-service-media"><Image src={service.image_url || "/assets/category-placeholder.svg"} alt="" fill sizes="(max-width: 700px) 45vw, 320px" /></div>
                <div className="uds-native-service-copy"><small>{shortcut.subtitle}</small><strong>{shortcut.title}</strong><span aria-hidden="true">↗</span></div>
              </a>;
            })}
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

