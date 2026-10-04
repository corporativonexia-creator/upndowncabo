"use client";

import { useEffect, useState } from "react";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import { storefrontCopy } from "./storefront-copy";
import { legacyHomeMarkup } from "./legacy-home-markup";
import { DesktopStorefront } from "./responsive/desktop-storefront";
import { MobileStorefront } from "./responsive/mobile-storefront";
import { getStorefrontDeviceModeFromWindow, type StorefrontDeviceMode } from "./responsive/device-mode";

declare global {
  interface Window {
    __UPDOWN_SUPABASE_URL__?: string;
    __UPDOWN_SUPABASE_PUBLISHABLE_KEY__?: string;
    __UPDOWN_CHECKOUT_ENABLED__?: boolean;
    __UPDOWN_PARITY_BOOTED__?: boolean;
    __UPDOWN_PARITY_VERSION__?: string;
  }
}

function repairMojibake(value: string) {
  if (!/[ÃÂâ]/.test(value)) return value;
  let output = value;
  const replacements: Array<[RegExp, string]> = [
    [/Ã¡/g, "á"], [/Ã©/g, "é"], [/Ã­/g, "í"], [/Ã³/g, "ó"], [/Ãº/g, "ú"],
    [/Ã/g, "Á"], [/Ã‰/g, "É"], [/Ã/g, "Í"], [/Ã“/g, "Ó"], [/Ãš/g, "Ú"],
    [/Ã±/g, "ñ"], [/Ã‘/g, "Ñ"], [/Ã¼/g, "ü"], [/Ãœ/g, "Ü"],
    [/Â·/g, "·"], [/Â¿/g, "¿"], [/Â¡/g, "¡"], [/Â/g, ""],
    [/â†’/g, "→"], [/â†/g, "←"], [/â€¦/g, "…"], [/â€“/g, "–"], [/â€”/g, "—"],
    [/â€œ/g, "“"], [/â€/g, "”"], [/â€˜/g, "‘"], [/â€™/g, "’"],
    [/Ã¢â€ â€™/g, "→"], [/Ã¢â‚¬Â¦/g, "…"], [/Ã¢â‚¬â€œ/g, "–"], [/Ã¢â‚¬â€/g, "—"],
  ];
  for (const [pattern, replacement] of replacements) output = output.replace(pattern, replacement);
  return output;
}

function repairStoreText(root: HTMLElement) {
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  let node: Node | null;
  while ((node = walker.nextNode())) {
    const current = node.nodeValue || "";
    const repaired = repairMojibake(current);
    if (repaired !== current) node.nodeValue = repaired;
  }
}

function cartUnitsFromStorage() {
  try {
    const cart = JSON.parse(localStorage.getItem("upDownCart") || "[]");
    return Array.isArray(cart) ? cart.reduce((sum: number, item: { quantity?: number }) => sum + Number(item.quantity || 0), 0) : 0;
  } catch { return 0; }
}

function createCartButton() {
  const button = document.createElement("button");
  button.id = "udsCartButton"; button.type = "button"; button.className = "uds-icon-btn";
  button.setAttribute("aria-label", "Abrir carrito");
  button.innerHTML = `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 4h2l2.1 10.2a2 2 0 0 0 2 1.6h7.8a2 2 0 0 0 2-1.6L20 8H6.2"></path><circle cx="10" cy="20" r="1"></circle><circle cx="18" cy="20" r="1"></circle></svg><span class="uds-cart-count" id="udsCartCount">${cartUnitsFromStorage()}</span>`;
  button.addEventListener("click", () => document.getElementById("udsFloatingCart")?.click());
  return button;
}

function restoreDesktopCart(root: HTMLElement) {
  if (getStorefrontDeviceModeFromWindow() !== "desktop") return;
  const actions = root.querySelector<HTMLElement>(".uds-top-actions");
  if (!actions || actions.querySelector("#udsCartButton")) return;
  actions.appendChild(createCartButton());
}

function installCoursePagination() {
  const grid = document.querySelector<HTMLElement>("#udsCourses .uds-course-grid");
  if (!grid) return () => {};
  let visible = 3; let button: HTMLButtonElement | null = null;
  const render = (reset = false) => {
    const cards = Array.from(grid.querySelectorAll<HTMLElement>(":scope > .uds-course"));
    if (reset) visible = 3;
    visible = Math.min(Math.max(3, visible), Math.max(3, cards.length));
    cards.forEach((card, index) => { card.hidden = index >= visible; });
    let wrap = grid.parentElement?.querySelector<HTMLElement>(".uds-course-more-wrap") || null;
    if (!wrap) { wrap = document.createElement("div"); wrap.className = "uds-course-more-wrap"; grid.insertAdjacentElement("afterend", wrap); }
    button = wrap.querySelector<HTMLButtonElement>("#udsCourseMore");
    if (!button) { button = document.createElement("button"); button.id = "udsCourseMore"; button.type = "button"; button.className = "uds-course-more"; wrap.appendChild(button); }
    const hasMore = cards.length > visible; button.hidden = !hasMore;
    button.textContent = document.documentElement.lang === "en" ? "View more courses" : "Ver más campos";
    button.onclick = () => { visible = Math.min(visible + 3, cards.length); render(false); };
  };
  const observer = new MutationObserver(() => render(true)); observer.observe(grid, { childList: true }); render(true);
  return () => observer.disconnect();
}

const storefrontMarkupWithoutAnnouncement = legacyHomeMarkup.replace(/\s*<div class="uds-announcement">[\s\S]*?<\/div>\s*/, "\n");

function SharedLegacyStorefront() {
  return <div id="updown-store" className="updown-next-parity uds-ux-v1 uds-ux-v2 uds-ux-v3" data-migration-phase="2B-UX3" suppressHydrationWarning dangerouslySetInnerHTML={{ __html: storefrontMarkupWithoutAnnouncement }} />;
}

export default function StorefrontParity() {
  const [deviceMode, setDeviceMode] = useState<StorefrontDeviceMode | null>(null);
  useEffect(() => {
    const syncDeviceMode = () => setDeviceMode(getStorefrontDeviceModeFromWindow());
    syncDeviceMode(); window.addEventListener("resize", syncDeviceMode);
    return () => window.removeEventListener("resize", syncDeviceMode);
  }, []);

  useEffect(() => {
    if (!deviceMode) return;
    const root = document.getElementById("updown-store");
    if (root) { root.dataset.deviceMode = deviceMode; repairStoreText(root); }
    const observer = root ? new MutationObserver(() => repairStoreText(root)) : null;
    observer?.observe(root!, { childList: true, subtree: true, characterData: true });
    document.querySelectorAll<HTMLScriptElement>('script[data-updown-parity="true"], script[data-updown-home-h60="true"]').forEach((node) => node.remove());
    document.getElementById("updown-h60-styles")?.remove();
    window.__UPDOWN_PARITY_BOOTED__ = false; window.__UPDOWN_PARITY_VERSION__ = undefined;
    (window as any).supabase = { createClient: createSupabaseClient };
    window.__UPDOWN_SUPABASE_URL__ = process.env.NEXT_PUBLIC_SUPABASE_URL;
    window.__UPDOWN_SUPABASE_PUBLISHABLE_KEY__ = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
    window.__UPDOWN_CHECKOUT_ENABLED__ = process.env.NEXT_PUBLIC_ENABLE_LEGACY_CHECKOUT === "true";
    window.__UPDOWN_TEXTS__ = storefrontCopy;
    const copyAbort = new AbortController();
    fetch(`${window.__UPDOWN_SUPABASE_URL__}/rest/v1/storefront_texts?select=key,source_text,es,en`, {
      headers: { apikey: window.__UPDOWN_SUPABASE_PUBLISHABLE_KEY__ || "" },
      signal: copyAbort.signal,
    }).then(async (response) => {
      if (!response.ok) return;
      const rows = await response.json();
      if (!Array.isArray(rows) || copyAbort.signal.aborted) return;
      const merged = new Map(storefrontCopy.map((row) => [row.key, row]));
      rows.forEach((row) => { if (typeof row.key === "string" && typeof row.es === "string" && typeof row.en === "string" && typeof row.source_text === "string") merged.set(row.key, row); });
      window.__UPDOWN_TEXTS__ = Array.from(merged.values());
      window.dispatchEvent(new Event("updown:copy-ready"));
    }).catch(() => { /* The local bilingual catalog remains available. */ });
    let stopCoursePagination = () => {};
    const script = document.createElement("script");
    script.src = "/updown-parity-runtime.js?v=2B.1-UX5.0-H79-fluid-brand-motion"; script.async = false; script.dataset.updownParity = "true";
    script.onload = () => {
      window.__UPDOWN_PARITY_BOOTED__ = true;
      if (root) { repairStoreText(root); if (deviceMode === "desktop") restoreDesktopCart(root); }
      stopCoursePagination = installCoursePagination();
    };
    script.onerror = () => { window.__UPDOWN_PARITY_BOOTED__ = false; console.error("UP AND DOWN: no fue posible cargar el runtime de paridad."); };
    document.body.appendChild(script);
    return () => { copyAbort.abort(); observer?.disconnect(); stopCoursePagination(); script.remove(); script.onload = null; script.onerror = null; };
  }, [deviceMode]);

  if (!deviceMode) return null;
  const storefront = <SharedLegacyStorefront />;
  return deviceMode === "mobile" ? <MobileStorefront>{storefront}</MobileStorefront> : <DesktopStorefront>{storefront}</DesktopStorefront>;
}


