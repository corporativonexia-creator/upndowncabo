"use client";

import { useEffect } from "react";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import { legacyHomeMarkup } from "./legacy-home-markup";

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

function restoreDesktopCart(root: HTMLElement) {
  if (window.matchMedia("(max-width: 760px)").matches) return;
  const actions = root.querySelector<HTMLElement>(".uds-top-actions");
  if (!actions || actions.querySelector("#udsCartButton")) return;

  const button = document.createElement("button");
  button.id = "udsCartButton";
  button.type = "button";
  button.className = "uds-icon-btn";
  button.setAttribute("aria-label", "Abrir carrito");
  button.innerHTML = `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 4h2l2.1 10.2a2 2 0 0 0 2 1.6h7.8a2 2 0 0 0 2-1.6L20 8H6.2"></path><circle cx="10" cy="20" r="1"></circle><circle cx="18" cy="20" r="1"></circle></svg><span class="uds-cart-count" id="udsCartCount">0</span>`;
  button.addEventListener("click", () => document.getElementById("udsFloatingCart")?.click());
  actions.appendChild(button);

  try {
    const cart = JSON.parse(localStorage.getItem("upDownCart") || "[]");
    const units = Array.isArray(cart)
      ? cart.reduce((sum: number, item: { quantity?: number }) => sum + Number(item.quantity || 0), 0)
      : 0;
    const count = button.querySelector<HTMLElement>("#udsCartCount");
    if (count) count.textContent = String(units);
  } catch {
    // Keep the default zero badge if local storage is unavailable.
  }
}

function installMobileNavigationAuthority(root: HTMLElement) {
  const onCaptureClick = (event: MouseEvent) => {
    if (!window.matchMedia("(max-width: 760px)").matches) return;
    const target = event.target instanceof Element ? event.target : null;
    if (!target) return;

    // Legacy runtime used to turn the logo into a second menu trigger after scroll.
    // H60 keeps one responsibility per control: logo = home, menu button = drawer.
    if (target.closest(".uds-logo")) {
      event.stopPropagation();
    }
  };

  document.addEventListener("click", onCaptureClick, true);

  // The H53 drawer is the canonical mobile drawer. Keep the older legacy panel inert
  // so cached/runtime listeners cannot expose two menus at the same time.
  const legacyMenu = root.querySelector<HTMLElement>("#udsMobileMenu");
  if (legacyMenu) {
    legacyMenu.classList.remove("is-open");
    legacyMenu.setAttribute("aria-hidden", "true");
  }

  return () => document.removeEventListener("click", onCaptureClick, true);
}

function installCoursePagination() {
  const grid = document.querySelector<HTMLElement>("#udsCourses .uds-course-grid");
  if (!grid) return () => {};

  let visible = 3;
  let button: HTMLButtonElement | null = null;

  const render = (reset = false) => {
    const cards = Array.from(grid.querySelectorAll<HTMLElement>(":scope > .uds-course"));
    if (reset) visible = 3;
    visible = Math.min(Math.max(3, visible), Math.max(3, cards.length));
    cards.forEach((card, index) => { card.hidden = index >= visible; });

    let wrap = grid.parentElement?.querySelector<HTMLElement>(".uds-course-more-wrap") || null;
    if (!wrap) {
      wrap = document.createElement("div");
      wrap.className = "uds-course-more-wrap";
      grid.insertAdjacentElement("afterend", wrap);
    }
    button = wrap.querySelector<HTMLButtonElement>("#udsCourseMore");
    if (!button) {
      button = document.createElement("button");
      button.id = "udsCourseMore";
      button.type = "button";
      button.className = "uds-course-more";
      wrap.appendChild(button);
    }
    const hasMore = cards.length > visible;
    button.hidden = !hasMore;
    button.textContent = document.documentElement.lang === "en" ? "View more courses" : "Ver más campos";
    button.onclick = () => { visible = Math.min(visible + 3, cards.length); render(false); };
  };

  const observer = new MutationObserver(() => render(true));
  observer.observe(grid, { childList: true });
  render(true);
  return () => observer.disconnect();
}

export default function StorefrontParity() {
  useEffect(() => {
    const root = document.getElementById("updown-store");
    if (root) repairStoreText(root);

    const observer = root ? new MutationObserver(() => repairStoreText(root)) : null;
    observer?.observe(root!, { childList: true, subtree: true, characterData: true });

    document.querySelectorAll<HTMLScriptElement>('script[data-updown-parity="true"], script[data-updown-home-h60="true"]').forEach((node) => node.remove());
    document.getElementById("updown-h60-styles")?.remove();

    window.__UPDOWN_PARITY_BOOTED__ = false;
    window.__UPDOWN_PARITY_VERSION__ = undefined;
    (window as any).supabase = { createClient: createSupabaseClient };
    window.__UPDOWN_SUPABASE_URL__ = process.env.NEXT_PUBLIC_SUPABASE_URL;
    window.__UPDOWN_SUPABASE_PUBLISHABLE_KEY__ = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
    window.__UPDOWN_CHECKOUT_ENABLED__ = process.env.NEXT_PUBLIC_ENABLE_LEGACY_CHECKOUT === "true";

    let stopCoursePagination = () => {};
    let stopMobileNavigationAuthority = () => {};
    const script = document.createElement("script");
    script.src = "/updown-parity-runtime.js?v=2B.1-UX5.0-H60-nav-consolidated";
    script.async = false;
    script.dataset.updownParity = "true";

    script.onload = () => {
      window.__UPDOWN_PARITY_BOOTED__ = true;
      if (root) {
        repairStoreText(root);
        restoreDesktopCart(root);
      }
      stopMobileNavigationAuthority = installMobileNavigationAuthority(root!);
      stopCoursePagination = installCoursePagination();
    };

    script.onerror = () => {
      window.__UPDOWN_PARITY_BOOTED__ = false;
      console.error("UP AND DOWN: no fue posible cargar el runtime de paridad.");
    };

    document.body.appendChild(script);

    return () => {
      observer?.disconnect();
      stopCoursePagination();
      stopMobileNavigationAuthority();
      script.onload = null;
      script.onerror = null;
    };
  }, []);

  return (
    <div
      id="updown-store"
      className="updown-next-parity uds-ux-v1 uds-ux-v2 uds-ux-v3"
      data-migration-phase="2B-UX3"
      suppressHydrationWarning
      dangerouslySetInnerHTML={{ __html: legacyHomeMarkup }}
    />
  );
}
