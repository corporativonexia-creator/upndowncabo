"use client";

import { useLayoutEffect, type ReactNode } from "react";

/** Mobile/tablet presentation shell. Shared storefront controls/data live above this layer. */
export function MobileStorefront({ children }: { children: ReactNode }) {
  useLayoutEffect(() => {
    // Clean up only the stale legacy pager. Header behavior is CSS-only here:
    // no MutationObserver, scroll listener or repeated DOM writes.
    document.getElementById("udsMobileCatalogPager58")?.remove();
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
          inset:0 0 auto 0!important;
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
          display:flex!important;
          align-items:center!important;
          gap:8px!important;
        }

        .uds-device-ux--mobile #updown-store .uds-logo,
        .uds-device-ux--mobile #updown-store .uds-header.is-mobile-capsule .uds-logo{
          display:flex!important;
          order:1!important;
          flex:1 1 auto!important;
          justify-content:flex-start!important;
          width:auto!important;
          min-width:64px!important;
          height:auto!important;
          margin:0!important;
          padding:0!important;
          background:transparent!important;
          box-shadow:none!important;
        }
        .uds-device-ux--mobile #updown-store .uds-logo-copy{display:none!important}
        .uds-device-ux--mobile #updown-store .uds-logo::before,
        .uds-device-ux--mobile #updown-store .uds-logo::after{display:none!important}
        .uds-device-ux--mobile #updown-store .uds-original-vector-logo{width:72px!important;max-width:72px!important}

        .uds-device-ux--mobile #updown-store .uds-desktop-nav,
        .uds-device-ux--mobile #updown-store .uds-lang-switch{display:none!important}

        .uds-device-ux--mobile #updown-store .uds-top-actions{
          order:2!important;
          display:flex!important;
          align-items:center!important;
          gap:8px!important;
          margin:0!important;
          padding:0!important;
        }
        .uds-device-ux--mobile #updown-store .uds-search-top{display:inline-flex!important;order:1!important}
        .uds-device-ux--mobile #updown-store #udsCartButton{display:inline-flex!important;order:2!important}
        .uds-device-ux--mobile #updown-store .uds-menu-btn{
          display:inline-flex!important;
          position:static!important;
          order:3!important;
          flex:0 0 auto!important;
          margin:0!important;
          transform:none!important;
          translate:none!important;
        }

        /* DOM order has Menu before Logo, so visually move Menu after actions. */
        .uds-device-ux--mobile #updown-store .uds-topbar>.uds-menu-btn{order:3!important}
        .uds-device-ux--mobile #updown-store .uds-topbar>.uds-logo{order:1!important}
        .uds-device-ux--mobile #updown-store .uds-topbar>.uds-top-actions{order:2!important}

        .uds-device-ux--mobile #updown-store main{margin-top:0!important;padding-top:70px!important}
      `}</style>
      {children}
    </div>
  );
}
