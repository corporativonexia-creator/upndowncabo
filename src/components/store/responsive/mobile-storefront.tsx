"use client";

import { useLayoutEffect, type ReactNode } from "react";

/** Mobile/tablet presentation shell. Shared storefront controls/data live above this layer. */
export function MobileStorefront({ children }: { children: ReactNode }) {
  useLayoutEffect(() => {
    // HOTFIX58 keeps module-level references to its pager controls. During
    // Turbopack/HMR or a device-mode remount an old pager can survive while
    // those references are reset to null. Remove that stale node before the
    // legacy runtime boots so it always rebuilds a complete pager atomically.
    document.getElementById("udsMobileCatalogPager58")?.remove();
  }, []);

  return (
    <div className="uds-device-ux uds-device-ux--mobile" data-storefront-ux="mobile">
      <style>{`
        html,body{margin:0!important;padding:0!important;overflow-x:clip!important}
        .uds-device-ux--mobile{
          margin:0!important;
          padding:0!important;
          overflow:visible!important;
          transform:none!important;
          contain:none!important;
        }
        .uds-device-ux--mobile .uds-announcement{display:none!important}
        .uds-device-ux--mobile #updown-store{
          margin:0!important;
          padding:0!important;
          overflow-x:clip!important;
          overflow-y:visible!important;
          transform:none!important;
          contain:none!important;
          perspective:none!important;
          filter:none!important;
        }
        .uds-device-ux--mobile #updown-store .uds-header,
        .uds-device-ux--mobile #updown-store .uds-header.is-scrolled,
        .uds-device-ux--mobile #updown-store .uds-header.is-mobile-capsule{
          position:fixed!important;
          top:0!important;
          left:0!important;
          right:0!important;
          width:100%!important;
          height:auto!important;
          margin:0!important;
          border-radius:0!important;
          transform:none!important;
          translate:none!important;
          opacity:1!important;
          visibility:visible!important;
          overflow:visible!important;
          z-index:2147483000!important;
        }
        .uds-device-ux--mobile #updown-store .uds-header.is-mobile-capsule .uds-topbar{
          width:auto!important;
          min-height:70px!important;
          height:auto!important;
          padding:0!important;
          display:grid!important;
          grid-template-columns:auto 1fr auto!important;
          place-items:initial!important;
          align-items:center!important;
        }
        .uds-device-ux--mobile #updown-store .uds-header.is-mobile-capsule .uds-logo{
          width:auto!important;
          min-width:auto!important;
          height:auto!important;
          justify-self:center!important;
          background:transparent!important;
          box-shadow:none!important;
        }
        .uds-device-ux--mobile #updown-store .uds-header.is-mobile-capsule .uds-logo::before,
        .uds-device-ux--mobile #updown-store .uds-header.is-mobile-capsule .uds-logo::after{
          display:none!important;
        }
        .uds-device-ux--mobile #updown-store .uds-header.is-mobile-capsule .uds-menu-btn{
          display:inline-flex!important;
        }
        .uds-device-ux--mobile #updown-store .uds-header.is-mobile-capsule .uds-top-actions{
          display:flex!important;
          justify-self:end!important;
        }
        .uds-device-ux--mobile #updown-store .uds-header.is-mobile-capsule .uds-search-top{
          display:inline-flex!important;
        }
        .uds-device-ux--mobile #updown-store main{
          margin-top:0!important;
          padding-top:70px!important;
        }
      `}</style>
      {children}
    </div>
  );
}
