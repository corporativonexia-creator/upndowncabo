"use client";

import type { ReactNode } from "react";

/** Desktop presentation shell. Shared storefront controls/data live above this layer. */
export function DesktopStorefront({ children }: { children: ReactNode }) {
  return (
    <div className="uds-device-ux uds-device-ux--desktop" data-storefront-ux="desktop">
      {children}
    </div>
  );
}
