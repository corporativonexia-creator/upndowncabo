"use client";

import type { ReactNode } from "react";

/** Mobile/tablet presentation shell. Shared storefront controls/data live above this layer. */
export function MobileStorefront({ children }: { children: ReactNode }) {
  return (
    <div className="uds-device-ux uds-device-ux--mobile" data-storefront-ux="mobile">
      <style>{`
        .uds-device-ux--mobile .uds-announcement{display:none!important}
        .uds-device-ux--mobile{margin:0!important;padding:0!important}
        .uds-device-ux--mobile #updown-store{margin:0!important;padding-top:0!important}
        .uds-device-ux--mobile .uds-header{top:0!important;margin-top:0!important}
      `}</style>
      {children}
    </div>
  );
}
