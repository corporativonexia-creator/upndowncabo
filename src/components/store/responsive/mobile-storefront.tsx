"use client";

import { useLayoutEffect, type ReactNode } from "react";

/** Mobile/tablet presentation shell. Shared storefront controls/data live above this layer. */
export function MobileStorefront({ children }: { children: ReactNode }) {
  useLayoutEffect(() => {
    document.getElementById("udsMobileCatalogPager58")?.remove();

    const root = document.getElementById("updown-store");
    const header = root?.querySelector<HTMLElement>(".uds-header");
    if (!root || !header) return;

    // The legacy runtime adds a capsule class while scrolling. Remove only that
    // class when it appears. Do not observe/write the style attribute: doing so
    // creates a MutationObserver feedback loop and keeps the page busy forever.
    const normalizeHeaderClass = () => {
      if (header.classList.contains("is-mobile-capsule")) {
        header.classList.remove("is-mobile-capsule");
      }
    };

    normalizeHeaderClass();
    const observer = new MutationObserver(normalizeHeaderClass);
    observer.observe(header, { attributes: true, attributeFilter: ["class"] });

    return () => observer.disconnect();
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
          position:fixed!important;
          top:0!important;
          left:0!important;
          right:0!important;
          bottom:auto!important;
          width:100%!important;
          height:70px!important;
          margin:0!important;
          padding:0!important;
          border-radius:0!important;
          transform:none!important;
          translate:none!important;
          opacity:1!important;
          visibility:visible!important;
          overflow:visible!important;
          z-index:2147483000!important;
        }

        .uds-device-ux--mobile #updown-store .uds-topbar,
        .uds-device-ux--mobile #updown-store .uds-header.is-mobile-capsule .uds-topbar{
          width:calc(100% - 24px)!important;
          max-width:none!important;
          height:70px!important;
          min-height:70px!important;
          margin:0 12px!important;
          padding:0!important;
          display:grid!important;
          grid-template-columns:minmax(72px,1fr) auto!important;
          align-items:center!important;
          gap:10px!important;
        }

        .uds-device-ux--mobile #updown-store .uds-logo,
        .uds-device-ux--mobile #updown-store .uds-header.is-mobile-capsule .uds-logo{
          grid-column:1!important;
          grid-row:1!important;
          justify-self:start!important;
          width:76px!important;
          min-width:76px!important;
          height:auto!important;
          margin:0!important;
          padding:0!important;
          background:transparent!important;
          box-shadow:none!important;
        }
        .uds-device-ux--mobile #updown-store .uds-logo-copy{display:none!important}
        .uds-device-ux--mobile #updown-store .uds-logo::before,
        .uds-device-ux--mobile #updown-store .uds-logo::after{display:none!important}

        .uds-device-ux--mobile #updown-store .uds-desktop-nav,
        .uds-device-ux--mobile #updown-store .uds-lang-switch{display:none!important}

        .uds-device-ux--mobile #updown-store .uds-top-actions{
          grid-column:2!important;
          grid-row:1!important;
          justify-self:end!important;
          display:flex!important;
          align-items:center!important;
          gap:8px!important;
          margin:0!important;
        }
        .uds-device-ux--mobile #updown-store .uds-search-top,
        .uds-device-ux--mobile #updown-store #udsCartButton{
          display:inline-flex!important;
          flex:0 0 auto!important;
        }
        .uds-device-ux--mobile #updown-store .uds-menu-btn{
          display:inline-flex!important;
          position:static!important;
          grid-column:auto!important;
          grid-row:auto!important;
          order:3!important;
          flex:0 0 auto!important;
        }
        .uds-device-ux--mobile #updown-store .uds-top-actions .uds-search-top{order:1!important}
        .uds-device-ux--mobile #updown-store .uds-top-actions #udsCartButton{order:2!important}

        /* Put the menu button after Search + Cart without cloning controls. */
        .uds-device-ux--mobile #updown-store .uds-topbar{position:relative!important}
        .uds-device-ux--mobile #updown-store .uds-menu-btn{
          position:absolute!important;
          right:0!important;
          top:50%!important;
          transform:translateY(-50%)!important;
        }
        .uds-device-ux--mobile #updown-store .uds-top-actions{padding-right:52px!important}

        .uds-device-ux--mobile #updown-store main{margin-top:0!important;padding-top:70px!important}
      `}</style>
      {children}
    </div>
  );
}
