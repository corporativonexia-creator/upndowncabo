"use client";

import type { ReactNode } from "react";

/** Mobile/tablet presentation shell. Shared storefront controls/data live above this layer. */
export function MobileStorefront({ children }: { children: ReactNode }) {
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
