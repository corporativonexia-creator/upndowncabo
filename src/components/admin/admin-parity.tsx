"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { adminLegacyMarkup } from "./admin-legacy-markup";
import { installAdminSidebar } from "./install-admin-sidebar";
import QuickProductEntry from "./quick-product-entry";

declare global {
  interface Window {
    supabase?: { createClient: (...args: unknown[]) => ReturnType<typeof createClient> };
    __UPDOWN_ADMIN_RUNTIME_ROOT__?: HTMLElement | null;
    __UPDOWN_SUPABASE_URL__?: string;
    __UPDOWN_SUPABASE_PUBLISHABLE_KEY__?: string;
  }
}

type BootState = "loading" | "ready" | "error";
// Preserve the DOM mutated by the active legacy runtimes across React state updates.
const ADMIN_MARKUP = { __html: adminLegacyMarkup };


/**
 * A0/A1: render the legacy DOM for existing business logic, but do not reveal
 * its unenhanced state. Retire only scripts with demonstrated functional parity.
 */
export default function AdminParity({ active, section }: { active: boolean; section: string }) {
  const router = useRouter();
  const startup = useRef<Promise<void> | null>(null);
  const routeSelection = useRef({ initialized: false, active: false, section: "" });
  const [bootState, setBootState] = useState<BootState>("loading");
  const [bootError, setBootError] = useState("");
  const [productHost, setProductHost] = useState<HTMLElement | null>(null);
  const [captureVisited, setCaptureVisited] = useState(false);
  const [galleryHost, setGalleryHost] = useState<HTMLElement | null>(null);
  const [galleryVisited, setGalleryVisited] = useState(false);

  useEffect(() => {
    let attached = true;
    if (!startup.current) {
      startup.current = (async () => {
        performance.mark("updown-admin-start");
        window.supabase = { createClient: () => createClient() };
        window.__UPDOWN_SUPABASE_URL__ = process.env.NEXT_PUBLIC_SUPABASE_URL;
        window.__UPDOWN_SUPABASE_PUBLISHABLE_KEY__ = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
        const root = document.getElementById("updown-admin");
        if (!root) throw new Error("No se encontró la estructura administrativa.");

        const load = (src: string) => new Promise<void>((resolve, reject) => {
          const old = document.querySelector<HTMLScriptElement>(
            'script[data-updown-admin-src="' + src + '"]',
          );
          if (old) old.remove();
          const script = document.createElement("script");
          script.src = src;
          script.dataset.updownAdminSrc = src;
          script.onload = () => {
            if (src.startsWith("/updown-admin-legacy-runtime.js") &&
                window.__UPDOWN_ADMIN_RUNTIME_ROOT__ !== root) {
              reject(new Error("No se pudo iniciar el catálogo administrativo."));
              return;
            }
            resolve();
          };
          script.onerror = () => reject(new Error("No se pudo cargar " + src.split("?")[0] + "."));
          document.body.appendChild(script);
        });
                await load("/updown-admin-legacy-runtime.js?v=novedades-seven-days-20261108");
        await load("/updown-product-heic-inventory-hotfix.js?v=heic-only-a10-3-20261118");
        await load("/updown-product-smart-entry-v1.js?v=on-demand-variants-20261101");
        await load("/updown-product-condition-v1.js?v=condition-v1-20261003");
        await load("/updown-admin-v2.js?v=pos-omnichannel-20261126");
        await load("/updown-pos-pin-v2.js?v=pos-pin-v3-20261001");
        await load("/updown-h63-order-comms.js?v=h63");
        await load("/updown-inventory-v2.js?v=inventory-product-v4-20261002");
        await load("/updown-product-tabs-v1.js?v=photo-gallery-tab-20261119");

        // Script.onload does not guarantee asynchronously installed tabs exist.
        const critical = [
          "udProductsTab", "udOrdersTab", "udv2ContentTab",
          "udv2PosTab", "udv2SellersTab", "udProductWorkspaceTabs",
        ];
        let prepared = false;
        for (let attempt = 0; attempt < 240; attempt += 1) {
          prepared = critical.every((id) => document.getElementById(id));
          if (prepared) break;
          await new Promise<void>((resolve) => window.setTimeout(resolve, 50));
        }
        if (!prepared) throw new Error("Algunos módulos tardaron demasiado en iniciar.");
        // Move original nodes, preserving legacy event listeners.
        installAdminSidebar(href => router.push(href));
        if (document.querySelector("#updown-admin .u-admin-nav")?.getAttribute("data-premium-sidebar") !== "ready" ||
            !document.getElementById("udInventoryMainNav")) {
          throw new Error("No se pudo preparar el menú administrativo.");
        }
        performance.mark("updown-admin-ready");
        performance.measure("updown-admin-bootstrap", "updown-admin-start", "updown-admin-ready");
      })();
    }
    startup.current.then(
      () => { if (attached) setBootState("ready"); },
      (error: unknown) => {
        console.error("UP AND DOWN Admin shell", error);
        if (attached) {
          setBootError(error instanceof Error ? error.message : "Error inesperado.");
          setBootState("error");
        }
      },
    );
    return () => { attached = false; };
  }, [router]);

  useEffect(() => {
    if (bootState !== "ready") return;
    const last = routeSelection.current;
    if (!active) { last.active = false; return; }
    // The initial script boot already consumed the bookmarked query parameter.
    // On later visits, select the original button without reloading its scripts.
    if (last.initialized && (!last.active || last.section !== section)) {
      const id: Record<string, string> = {
        orders: "udOrdersTab", pos: "udv2PosTab",
        vendedores: "udv2SellersTab", sellers: "udv2SellersTab",
        clases: "udv2LessonsTab", classes: "udv2LessonsTab",
        contenido: "udv2ContentTab", content: "udv2ContentTab",
      };
      document.getElementById(id[section] || "udProductsTab")?.click();
    }
    last.initialized = true;
    last.active = true;
    last.section = section;
  }, [active, bootState, section]);

  useEffect(() => {
    if (bootState !== "ready") return;
    const host = document.getElementById("udUnifiedProductHost");
    const gallery = document.getElementById("udProductGalleryHost");
    if (!host || !gallery) return;
    // The existing admin DOM is owned by the legacy runtime. A portal inserts
    // the reusable React capture without replacing handlers or form nodes.
    // eslint-disable-next-line react-hooks/set-state-in-effect -- Host is created by the legacy script before bootState becomes ready.
    setProductHost(host);
    setGalleryHost(gallery);
    const onView = (event: Event) => {
      if ((event as CustomEvent<{ view: string }>).detail?.view === "capture") {
        setCaptureVisited(true);
      }
      if ((event as CustomEvent<{ view: string }>).detail?.view === "gallery") {
        setGalleryVisited(true);
      }
    };
    window.addEventListener("updown:admin-product-view", onView);
    // A bookmarked /admin?producto=nuevo can select capture before React
    // attaches this listener. Recover its already-active state without
    // mounting the form during normal catalog startup.
    if (!host.hidden) setCaptureVisited(true);
    if (!gallery.hidden) setGalleryVisited(true);
    return () => window.removeEventListener("updown:admin-product-view", onView);
  }, [bootState]);

  return (
    <div className="ud-admin-boot">
      {bootState !== "ready" && (
        <section className="ud-admin-splash" role={bootState === "error" ? "alert" : "status"}>
          {bootState === "loading" && <div className="ud-admin-splash-icon" aria-hidden="true" />}
          <strong>{bootState === "error" ? "No fue posible abrir el administrador" : "Preparando el administrador"}</strong>
          <p>{bootState === "error" ? bootError : "Organizando los módulos y herramientas de trabajo…"}</p>
          {bootState === "error" && (
            <button type="button" onClick={() => window.location.reload()}>Reintentar</button>
          )}
        </section>
      )}
      <div
        className="ud-admin-legacy"
        data-admin-ready={bootState === "ready" ? "true" : "false"}
        aria-hidden={bootState !== "ready"}
        dangerouslySetInnerHTML={ADMIN_MARKUP}
      />
      {productHost && captureVisited && createPortal(<QuickProductEntry embedded />, productHost)}
      {galleryHost && galleryVisited && createPortal(<QuickProductEntry embedded galleryOnly />, galleryHost)}
    </div>
  );
}
