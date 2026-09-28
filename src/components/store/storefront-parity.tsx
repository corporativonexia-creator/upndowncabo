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

export default function StorefrontParity() {
  useEffect(() => {
    // Keep one runtime instance only. During Fast Refresh a stale window flag
    // may survive, so the DOM script is the source of truth.
    const previousRuntime = document.querySelector<HTMLScriptElement>(
      'script[data-updown-parity="true"]',
    );

    if (previousRuntime) {
      previousRuntime.remove();
    }

    window.__UPDOWN_PARITY_BOOTED__ = false;
    window.__UPDOWN_PARITY_VERSION__ = undefined;

    (window as any).supabase = { createClient: createSupabaseClient };
    window.__UPDOWN_SUPABASE_URL__ = process.env.NEXT_PUBLIC_SUPABASE_URL;
    window.__UPDOWN_SUPABASE_PUBLISHABLE_KEY__ =
      process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
    window.__UPDOWN_CHECKOUT_ENABLED__ =
      process.env.NEXT_PUBLIC_ENABLE_LEGACY_CHECKOUT === "true";

    const script = document.createElement("script");
    script.src = "/updown-parity-runtime.js?v=2B.1-UX5.0-H59";
    script.async = false;
    script.dataset.updownParity = "true";

    script.onload = () => {
      window.__UPDOWN_PARITY_BOOTED__ = true;
    };

    script.onerror = () => {
      window.__UPDOWN_PARITY_BOOTED__ = false;
      console.error("UP AND DOWN: no fue posible cargar el runtime de paridad.");
    };

    document.body.appendChild(script);

    return () => {
      // React Strict Mode / route unmount cleanup.
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
