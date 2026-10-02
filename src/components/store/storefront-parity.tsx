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

export default function StorefrontParity() {
  useEffect(() => {
    const root = document.getElementById("updown-store");
    if (root) repairStoreText(root);

    const observer = root
      ? new MutationObserver(() => repairStoreText(root))
      : null;
    observer?.observe(root!, { childList: true, subtree: true, characterData: true });

    const previousRuntime = document.querySelector<HTMLScriptElement>(
      'script[data-updown-parity="true"]',
    );

    if (previousRuntime) previousRuntime.remove();

    window.__UPDOWN_PARITY_BOOTED__ = false;
    window.__UPDOWN_PARITY_VERSION__ = undefined;

    (window as any).supabase = { createClient: createSupabaseClient };
    window.__UPDOWN_SUPABASE_URL__ = process.env.NEXT_PUBLIC_SUPABASE_URL;
    window.__UPDOWN_SUPABASE_PUBLISHABLE_KEY__ =
      process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
    window.__UPDOWN_CHECKOUT_ENABLED__ =
      process.env.NEXT_PUBLIC_ENABLE_LEGACY_CHECKOUT === "true";

    const script = document.createElement("script");
    script.src = "/updown-parity-runtime.js?v=2B.1-UX5.0-H59-UTF8CART";
    script.async = false;
    script.dataset.updownParity = "true";

    script.onload = () => {
      window.__UPDOWN_PARITY_BOOTED__ = true;
      if (root) repairStoreText(root);
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
