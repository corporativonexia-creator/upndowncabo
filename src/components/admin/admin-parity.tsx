"use client";

import { useEffect, useRef } from "react";
import { createClient } from "@/lib/supabase/client";
import { adminLegacyMarkup } from "./admin-legacy-markup";

declare global {
  interface Window {
    supabase?: { createClient: (...args: unknown[]) => ReturnType<typeof createClient> };
    __UPDOWN_ADMIN_RUNTIME_ROOT__?: HTMLElement | null;
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
      script.onload = () => {
        // A script load event also fires when parsing/execution failed.
        if (src.startsWith("/updown-admin-legacy-runtime.js") &&
            window.__UPDOWN_ADMIN_RUNTIME_ROOT__ !== document.getElementById("updown-admin")) {
          reject(new Error("No se pudo iniciar el catálogo administrativo."));
          return;
        }
        resolve();
      };
      script.onerror = () => reject(new Error(`No se pudo cargar ${src}`));
      document.body.appendChild(script);
    });

    (async () => {
      await load("/updown-admin-legacy-runtime.js?v=catalog-stability-20261030");
      await load("/updown-product-heic-inventory-hotfix.js?v=heic-inventory-v3-20261002");
      await load("/updown-product-smart-entry-v1.js?v=apparel-freeze-fix-20261029");
      await load("/updown-product-condition-v1.js?v=condition-v1-20261003");
      await load("/updown-admin-v2.js?v=pos-force-signout-20261029");
      await load("/updown-pos-pin-v2.js?v=pos-pin-v3-20261001");
      await load("/updown-h63-order-comms.js?v=h63");
      await load("/updown-inventory-v2.js?v=inventory-product-v4-20261002");
      await load("/updown-product-tabs-v1.js?v=catalog-stability-20261030");
      await load("/updown-inventory-nav.js?v=inventory-nav-v2-sellers");
    })().catch((error) => {
      console.error("UP AND DOWN Admin migration", error);
      const list = document.getElementById("udList");
      if (!list) return;
      const message = document.createElement("div");
      message.setAttribute("role", "alert");
      message.className = "u-empty";
      message.textContent = "No se pudo iniciar el administrador. " + error.message + " ";
      const retry = document.createElement("button");
      retry.type = "button";
      retry.textContent = "Reintentar inicio";
      retry.onclick = () => window.location.reload();
      message.appendChild(retry);
      list.replaceChildren(message);
    });
  }, []);

  return <div suppressHydrationWarning dangerouslySetInnerHTML={{ __html: adminLegacyMarkup }} />;
}

