"use client";

import { useEffect } from "react";

/**
 * Premium White storefront: collapse the EXISTING catalog filter after its
 * Apply / Clear button handlers complete. Never override filter logic,
 * replace buttons, or change the catalog's data and selection state.
 */
export default function PreviewFilterAutoCollapse() {
  useEffect(() => {
    const onClick = (event: MouseEvent) => {
      // Desktop remains unchanged. This is the mobile/tablet UX (< 1024px).
      if (window.innerWidth >= 1024 || !(event.target instanceof Element)) return;

      const action = event.target.closest<HTMLButtonElement>(
        "#udsCatalogApply, #udsCatalogClear",
      );
      const root = document.querySelector<HTMLElement>("#updown-store.uds-premium-white");
      if (!action || !root?.contains(action)) return;

      const panel = root.querySelector<HTMLElement>("#udsCatalogFilterBox");
      const toggle = root.querySelector<HTMLButtonElement>("#udsCatalogFilterToggle");
      if (!panel?.classList.contains("is-open") || !toggle) return;

      // At document bubble phase, the original button.onclick has already
      // executed (applyCatalogFilters / clearCommerceFilters).
      // The existing CSS animates the height/opacity when .is-open is removed.
      panel.classList.remove("is-open");
      toggle.setAttribute("aria-expanded", "false");

      // Avoid leaving keyboard focus inside an invisible, collapsed panel.
      if (panel.contains(document.activeElement)) {
        toggle.focus({ preventScroll: true });
      }
    };

    document.addEventListener("click", onClick);
    return () => document.removeEventListener("click", onClick);
  }, []);

  return null;
}
