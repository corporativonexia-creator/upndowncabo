"use client";

import { useLayoutEffect, type ReactNode } from "react";

/** Mobile/tablet presentation shell. Shared storefront controls/data live above this layer. */
export function MobileStorefront({ children }: { children: ReactNode }) {
  useLayoutEffect(() => {
    document.getElementById("udsMobileCatalogPager58")?.remove();

    const root = document.getElementById("updown-store");
    const header = root?.querySelector<HTMLElement>(".uds-header");
    const announcement = root?.querySelector<HTMLElement>(".uds-announcement");
    if (!root || !header) return;

    // Mobile owns its header completely. The legacy runtime used to mutate the
    // same node into a floating capsule while scrolling; keeping those classes
    // alive made the header jump and eventually leave the viewport.
    const pinHeader = () => {
      header.classList.remove("is-mobile-capsule");
      announcement?.classList.remove("is-mobile-hidden");
      header.style.setProperty("position", "fixed", "important");
      header.style.setProperty("top", "0px", "important");
      header.style.setProperty("left", "0px", "important");
      header.style.setProperty("right", "0px", "important");
      header.style.setProperty("width", "100%", "important");
      header.style.setProperty("margin", "0px", "important");
      header.style.setProperty("transform", "none", "important");
      header.style.setProperty("translate", "none", "important");
      header.style.setProperty("opacity", "1", "important");
      header.style.setProperty("visibility", "visible", "important");
      header.style.setProperty("z-index", "2147483000", "important");
    };

    pinHeader();
    const observer = new MutationObserver(pinHeader);
    observer.observe(header, { attributes: true, attributeFilter: ["class", "style"] });
    if (announcement) observer.observe(announcement, { attributes: true, attributeFilter: ["class", "style"] });
    window.addEventListener("scroll", pinHeader, { passive: true });
    window.addEventListener("resize", pinHeader);

    return () => {
      observer.disconnect();
      window.removeEventListener("scroll", pinHeader);
      window.removeEventListener("resize", pinHeader);
    };
  }, []);

  return (
    <div className="uds-device-ux uds-device-ux--mobile" data-storefront-ux="mobile">
      <style>{`
        html,body{margin:0!important;padding:0!important;overflow-x:clip!important}
        .uds-device-ux--mobile{margin:0!important;padding:0!important;overflow:visible!important;transform:none!important;contain:none!important}
        .uds-device-ux--mobile .uds-announcement{display:none!important}
        .uds-device-ux--mobile #updown-store{margin:0!important;padding:0!important;overflow-x:clip!important;overflow-y:visible!important;transform:none!important;contain:none!important;perspective:none!important;filter:none!important}
        .uds-device-ux--mobile #updown-store .uds-header,
        .uds-device-ux--mobile #updown-store .uds-header.is-scrolled,
        .uds-device-ux--mobile #updown-store .uds-header.is-mobile-capsule{
          position:fixed!important;inset:0 0 auto 0!important;top:0!important;left:0!important;right:0!important;
          width:100%!important;height:auto!important;margin:0!important;padding:0!important;border-radius:0!important;
          transform:none!important;translate:none!important;opacity:1!important;visibility:visible!important;overflow:visible!important;
          z-index:2147483000!important;
        }
        .uds-device-ux--mobile #updown-store .uds-topbar,
        .uds-device-ux--mobile #updown-store .uds-header.is-mobile-capsule .uds-topbar{
          width:min(100% - 24px,1280px)!important;min-height:70px!important;height:70px!important;margin:0 auto!important;padding:0!important;
          display:grid!important;grid-template-columns:auto 1fr auto!important;place-items:initial!important;align-items:center!important;
        }
        .uds-device-ux--mobile #updown-store .uds-header.is-mobile-capsule .uds-logo{width:auto!important;min-width:auto!important;height:auto!important;justify-self:center!important;background:transparent!important;box-shadow:none!important}
        .uds-device-ux--mobile #updown-store .uds-header.is-mobile-capsule .uds-logo::before,
        .uds-device-ux--mobile #updown-store .uds-header.is-mobile-capsule .uds-logo::after{display:none!important}
        .uds-device-ux--mobile #updown-store .uds-header.is-mobile-capsule .uds-menu-btn{display:inline-flex!important}
        .uds-device-ux--mobile #updown-store .uds-header.is-mobile-capsule .uds-top-actions{display:flex!important;justify-self:end!important}
        .uds-device-ux--mobile #updown-store .uds-header.is-mobile-capsule .uds-search-top{display:inline-flex!important}
        .uds-device-ux--mobile #updown-store main{margin-top:0!important;padding-top:70px!important}
      `}</style>
      {children}
    </div>
  );
}
