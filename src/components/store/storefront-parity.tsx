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

function ensureLegacyRuntimeCompatibility(root: HTMLElement) {
  if (!root.querySelector(".uds-announcement")) {
    const announcement = document.createElement("div");
    announcement.className = "uds-announcement uds-runtime-compat";
    announcement.hidden = true;
    announcement.setAttribute("aria-hidden", "true");
    root.prepend(announcement);
  }
}

function installCanonicalMobileHeader(root: HTMLElement) {
  let style = document.getElementById("updown-canonical-mobile-header") as HTMLStyleElement | null;
  if (!style) {
    style = document.createElement("style");
    style.id = "updown-canonical-mobile-header";
    style.textContent = `
      @media (max-width:760px){
        #updown-store .uds-header .uds-topbar{
          display:flex!important;
          align-items:center!important;
          width:100%!important;
          height:58px!important;
          min-height:58px!important;
          padding:7px 10px 7px 12px!important;
          gap:6px!important;
        }
        #updown-store .uds-header .uds-logo{
          order:1!important;
          display:flex!important;
          align-items:center!important;
          width:auto!important;
          min-width:0!important;
          margin-right:auto!important;
          flex:1 1 auto!important;
        }
        #updown-store .uds-header .uds-original-vector-logo{
          display:block!important;
          width:82px!important;
          height:30px!important;
        }
        #updown-store .uds-header .uds-logo-copy{display:none!important}
        #updown-store .uds-header .uds-desktop-nav{display:none!important}
        #updown-store .uds-header .uds-top-actions{
          order:2!important;
          display:flex!important;
          align-items:center!important;
          gap:4px!important;
          flex:0 0 auto!important;
        }
        #updown-store .uds-header .uds-lang-switch{display:none!important}
        #updown-store .uds-header .uds-top-actions .uds-icon-btn,
        #updown-store .uds-header>.uds-topbar>.uds-menu-btn{
          display:inline-flex!important;
          align-items:center!important;
          justify-content:center!important;
          width:38px!important;
          height:38px!important;
          min-width:38px!important;
          padding:0!important;
          border:0!important;
          border-radius:50%!important;
          background:transparent!important;
          color:#fff!important;
          box-shadow:none!important;
        }
        #updown-store .uds-header>.uds-topbar>.uds-menu-btn{
          order:3!important;
          position:relative!important;
          inset:auto!important;
          margin:0!important;
          flex:0 0 38px!important;
        }
        #updown-store .uds-header .uds-top-actions .uds-icon-btn svg,
        #updown-store .uds-header>.uds-topbar>.uds-menu-btn svg{
          width:20px!important;
          height:20px!important;
          fill:none!important;
          stroke:currentColor!important;
        }
        #updown-store .uds-mobile-quick-actions{display:none!important}
        #updown-store .uds-mobile-search-panel{display:none!important}
      }
    `;
    document.head.appendChild(style);
  }

  // H60 inserted a second search/cart/menu trio. The legacy controls are the
  // canonical controls because the storefront runtime already binds them to
  // focusDiscoverySearch, openCart and openMenu.
  root.querySelector(".uds-mobile-quick-actions")?.remove();
  root.querySelector("#udsMobileSearchPanel")?.remove();
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

export default function StorefrontParity() {
  useEffect(() => {
    const root = document.getElementById("updown-store");
    if (root) {
      ensureLegacyRuntimeCompatibility(root);
      repairStoreText(root);
    }

    const observer = root
      ? new MutationObserver(() => repairStoreText(root))
      : null;
    observer?.observe(root!, { childList: true, subtree: true, characterData: true });

    document.querySelectorAll<HTMLScriptElement>(
      'script[data-updown-parity="true"], script[data-updown-home-h60="true"]',
    ).forEach((node) => node.remove());

    window.__UPDOWN_PARITY_BOOTED__ = false;
    window.__UPDOWN_PARITY_VERSION__ = undefined;

    (window as any).supabase = { createClient: createSupabaseClient };
    window.__UPDOWN_SUPABASE_URL__ = process.env.NEXT_PUBLIC_SUPABASE_URL;
    window.__UPDOWN_SUPABASE_PUBLISHABLE_KEY__ =
      process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
    window.__UPDOWN_CHECKOUT_ENABLED__ =
      process.env.NEXT_PUBLIC_ENABLE_LEGACY_CHECKOUT === "true";

    const script = document.createElement("script");
    script.src = "/updown-parity-runtime.js?v=2B.1-UX5.0-H61";
    script.async = false;
    script.dataset.updownParity = "true";

    script.onload = () => {
      window.__UPDOWN_PARITY_BOOTED__ = true;
      if (root) {
        repairStoreText(root);
        restoreDesktopCart(root);
      }

      const homePatch = document.createElement("script");
      homePatch.src = "/updown-home-h60.js?v=H60.1";
      homePatch.async = false;
      homePatch.dataset.updownHomeH60 = "true";
      homePatch.onload = () => {
        if (root) installCanonicalMobileHeader(root);
      };
      document.body.appendChild(homePatch);
    };

    script.onerror = () => {
      window.__UPDOWN_PARITY_BOOTED__ = false;
      console.error("UP AND DOWN: no fue posible cargar el runtime de paridad.");
    };

    document.body.appendChild(script);

    return () => {
      observer?.disconnect();
      script.onload = null;
      script.onerror = null;
      document.querySelector<HTMLScriptElement>('script[data-updown-home-h60="true"]')?.remove();
      document.getElementById("updown-canonical-mobile-header")?.remove();
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
