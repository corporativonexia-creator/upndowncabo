"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

/**
 * Preview-only local navigation bridge.
 *
 * Canonical share URLs intentionally point to https://upndowncabo.com.
 * When the store is inspected on localhost or a private preview host,
 * navigation and prefetch must remain on that same host. Shared links
 * for WhatsApp/copy retain their canonical public destination.
 */
export default function PreviewLocalProductNavigation() {
  const router = useRouter();

  useEffect(() => {
    const productPath = (value: string): string | null => {
      try {
        const url = new URL(value, window.location.origin);
        const acceptedHost =
          url.origin === window.location.origin ||
          url.hostname === "upndowncabo.com" ||
          url.hostname === "www.upndowncabo.com";
        if (!acceptedHost || !url.pathname.startsWith("/vista-previa/producto/")) {
          return null;
        }
        return url.pathname + url.search + url.hash;
      } catch {
        return null;
      }
    };

    const canonicalForeign = (value: string) => {
      try {
        const url = new URL(value, window.location.origin);
        return url.origin !== window.location.origin &&
          (url.hostname === "upndowncabo.com" ||
            url.hostname === "www.upndowncabo.com");
      } catch {
        return false;
      }
    };

    // The catalog runtime dispatches this cancelable event before its
    // absolute-URL fallback. The shared StorefrontParity handler rejects
    // cross-origin URLs (correctly), so navigate locally here instead.
    const onNavigate = (event: Event) => {
      const value = (event as CustomEvent<{ url?: string }>).detail?.url;
      if (!value || !canonicalForeign(value)) return;
      const path = productPath(value);
      if (!path) return;
      event.preventDefault(); // cancels fallback to online domain
      router.push(path); // independent Next.js product page on current host
    };

    const onPrefetch = (event: Event) => {
      const value = (event as CustomEvent<{ url?: string }>).detail?.url;
      if (!value || !canonicalForeign(value)) return;
      const path = productPath(value);
      if (path) router.prefetch(path);
    };

    // The independent product page includes variant and related-product
    // links generated as canonical absolute URLs. Localize only their
    // *navigation hrefs* in the private page, including streamed links.
    // Share text and WhatsApp destinations remain public URLs.
    const detailRoot = document.querySelector(".ud-premium-product-skin");
    let observer: MutationObserver | null = null;
    const onDetailProductClick = (event: MouseEvent) => {
      if (event.defaultPrevented || event.button !== 0 ||
          event.metaKey || event.ctrlKey || event.shiftKey || event.altKey ||
          !(event.target instanceof Element)) return;

      const anchor = event.target.closest<HTMLAnchorElement>("a[href]");
      if (!anchor || !detailRoot?.contains(anchor) ||
          anchor.target === "_blank" || anchor.hasAttribute("download")) return;
      const path = productPath(anchor.href);
      if (!path) return;

      // A streamed related-product card uses Next.js <Link>, whose
      // internal click handler may still retain its ORIGINAL absolute href
      // even if the displayed anchor was rewritten to a local URL.
      // Intercept before React's Link handler and keep this navigation
      // on the preview's current host. Modified/new-tab clicks are native.
      event.preventDefault();
      event.stopPropagation();
      router.push(path);
    };
    if (detailRoot) {
      detailRoot.addEventListener("click", onDetailProductClick, true);
      const localizeLinks = () => {
        detailRoot.querySelectorAll<HTMLAnchorElement>("a[href]").forEach(anchor => {
          if (!canonicalForeign(anchor.href)) return;
          const path = productPath(anchor.href);
          if (path) anchor.setAttribute("href", path);
        });
      };
      localizeLinks();
      observer = new MutationObserver(localizeLinks);
      observer.observe(detailRoot, {
        childList: true,
        subtree: true,
        attributes: true,
        attributeFilter: ["href"],
      });
    }

    window.addEventListener("updown:product-navigate", onNavigate, true);
    window.addEventListener("updown:product-prefetch", onPrefetch, true);
    return () => {
      window.removeEventListener("updown:product-navigate", onNavigate, true);
      window.removeEventListener("updown:product-prefetch", onPrefetch, true);
      detailRoot?.removeEventListener("click", onDetailProductClick, true);
      observer?.disconnect();
    };
  }, [router]);

  return null;
}
