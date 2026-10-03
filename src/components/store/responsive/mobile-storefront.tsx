"use client";

import type { ReactNode } from "react";

/** Mobile/tablet presentation shell. Shared storefront controls/data live above this layer. */
export function MobileStorefront({ children }: { children: ReactNode }) {
  return (
    <div className="uds-device-ux uds-device-ux--mobile" data-storefront-ux="mobile">
      {children}
    </div>
  );
}
