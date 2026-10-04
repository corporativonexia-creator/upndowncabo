"use client";

import type { ReactNode } from "react";

/** Desktop presentation shell. Shared storefront controls/data live above this layer. */
export function DesktopStorefront({ children }: { children: ReactNode }) {
  return (
    <div className="uds-device-ux uds-device-ux--desktop" data-storefront-ux="desktop">
      <style>{`
        html,body{margin:0!important;padding:0!important}
        .uds-device-ux--desktop{margin:0!important;padding:0!important}
        .uds-device-ux--desktop .uds-announcement{display:none!important}
        .uds-device-ux--desktop #updown-store{margin:0!important;padding:0!important}
        .uds-device-ux--desktop #updown-store .uds-header{
          position:fixed!important;
          top:0!important;
          left:0!important;
          right:0!important;
          margin:0!important;
          transform:none!important;
          translate:none!important;
          z-index:2147483000!important;
        }
      `}</style>
      {children}
    </div>
  );
}
