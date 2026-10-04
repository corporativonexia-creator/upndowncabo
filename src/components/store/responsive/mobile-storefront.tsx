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
        html,body{margin:0!important;padding:0!important}
        .uds-device-ux--mobile{margin:0!important;padding:0!important}
        .uds-device-ux--mobile .uds-announcement{display:none!important}
        .uds-device-ux--mobile #updown-store{margin:0!important;padding:0!important}
        .uds-device-ux--mobile #updown-store .uds-header{
          position:fixed!important;
          top:0!important;
          left:0!important;
          right:0!important;
          margin:0!important;
          transform:none!important;
          translate:none!important;
          z-index:2147483000!important;
        }
        .uds-device-ux--mobile #updown-store main{margin-top:0!important;padding-top:0!important}
      `}</style>
      {children}
    </div>
  );
}
