"use client";

import { useEffect, useRef } from "react";
import { createClient } from "@/lib/supabase/client";
import { adminLegacyMarkup } from "./admin-legacy-markup";

declare global {
  interface Window {
    supabase?: { createClient: (...args: unknown[]) => ReturnType<typeof createClient> };
    __UPDOWN_SUPABASE_URL__?: string;
    __UPDOWN_SUPABASE_PUBLISHABLE_KEY__?: string;
  }
}

export default function AdminParity() {
  const mounted = useRef(false);

  useEffect(() => {
    if (mounted.current) return;
    mounted.current = true;

    window.supabase = { createClient: () => createClient() };
    window.__UPDOWN_SUPABASE_URL__ = process.env.NEXT_PUBLIC_SUPABASE_URL;
    window.__UPDOWN_SUPABASE_PUBLISHABLE_KEY__ = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

    const load = (src: string) => new Promise<void>((resolve, reject) => {
      const old = document.querySelector(`script[data-updown-admin-src="${src}"]`);
      if (old) old.remove();
      const script = document.createElement("script");
      script.src = src;
      script.defer = true;
      script.dataset.updownAdminSrc = src;
      script.onload = () => resolve();
      script.onerror = () => reject(new Error(`No se pudo cargar ${src}`));
      document.body.appendChild(script);
    });

    (async () => {
      await load("/updown-admin-legacy-runtime.js?v=admin-next-h52");
      await load("/updown-product-heic-inventory-hotfix.js?v=heic-inventory-v3-20261002");
      await load("/updown-product-smart-entry-v1.js?v=smart-entry-v1-20261002");
      await load("/updown-admin-v2.js?v=admin-next-h52");
      await load("/updown-pos-pin-v2.js?v=pos-pin-v3-20261001");
      await load("/updown-h63-order-comms.js?v=h63");
      await load("/updown-inventory-v2.js?v=inventory-product-v3-20261002");
      await load("/updown-product-tabs-v1.js?v=product-tabs-v1-20261002");
      await load("/updown-product-variant-search-v1.js?v=variant-search-v1-20261002");
      await load("/updown-inventory-nav.js?v=inventory-nav-v1");
    })().catch((error) => console.error("UP AND DOWN Admin migration", error));
  }, []);

  return <div suppressHydrationWarning dangerouslySetInnerHTML={{ __html: adminLegacyMarkup }} />;
}
