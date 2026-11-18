"use client";

import { useEffect } from "react";

/**
 * Desktop-only navigation polish for shared Premium White storefronts.
 * Search state, matching, filters and URL history remain owned by the
 * existing storefront runtime. This component only measures the header
 * for CSS sticky positioning and restores the search/results viewport.
 */
export default function PreviewDesktopSearchFocus() {
  useEffect(() => {
    let root: HTMLElement | null = null;
    let classObserver: MutationObserver | null = null;
    let headerObserver: ResizeObserver | null = null;
    let firstFrame = 0;
    let secondFrame = 0;
    let attachFrame = 0;
    let wasFocused = false;

    const onDesktop = () => window.innerWidth >= 1024;
    const isFocused = () =>
      onDesktop() && !!root?.classList.contains("uds-search-focus");

    const stopScroll = () => {
      cancelAnimationFrame(firstFrame);
      cancelAnimationFrame(secondFrame);
    };

    const showFocusedResults = () => {
      stopScroll();
      if (!isFocused()) return;
      // The legacy search handler schedules scrollIntoView in the first
      // frame. Navigate AFTER it and after the old sections collapse.
      firstFrame = requestAnimationFrame(() => {
        secondFrame = requestAnimationFrame(() => {
          if (!isFocused()) return;
          window.scrollTo({
            top: 0,
            // Cancel the legacy smooth scrollIntoView animation and settle
            // at the start of the results. Two competing smooth scrolls
            // left the catalog title underneath the sticky search.
            behavior: "instant",
          });
        });
      });
    };

    const measureHeader = () => {
      if (!root || !onDesktop()) return;
      const header = root.querySelector<HTMLElement>(".uds-header");
      if (!header) return;
      root.style.setProperty(
        "--pw-preview-header-height",
        `${Math.ceil(header.getBoundingClientRect().height)}px`,
      );
      const search = root.querySelector<HTMLElement>(".uds-discovery");
      if (search) {
        root.style.setProperty(
          "--pw-preview-search-height",
          `${Math.ceil(search.getBoundingClientRect().height)}px`,
        );
      }
    };

    const attach = () => {
      const next = document.querySelector<HTMLElement>("#updown-store.uds-premium-white");
      if (!next || next === root) {
        measureHeader();
        return;
      }
      classObserver?.disconnect();
      headerObserver?.disconnect();
      root = next;
      wasFocused = isFocused();
      classObserver = new MutationObserver(() => {
        const now = isFocused();
        if (now && !wasFocused) showFocusedResults();
        wasFocused = now;
      });
      classObserver.observe(next, {
        attributes: true,
        attributeFilter: ["class"],
      });
      const header = next.querySelector<HTMLElement>(".uds-header");
      if (typeof ResizeObserver !== "undefined") {
        headerObserver = new ResizeObserver(measureHeader);
        if (header) headerObserver.observe(header);
        const search = next.querySelector<HTMLElement>(".uds-discovery");
        if (search) headerObserver.observe(search);
      }
      measureHeader();
      if (isFocused()) showFocusedResults();
    };

    const onSearchClick = (event: MouseEvent) => {
      if (!onDesktop() || !(event.target instanceof Element)) return;
      if (event.target.closest("#udsPreviewSearchButton") && root?.contains(event.target)) {
        showFocusedResults();
      }
    };
    const onSearchEnter = (event: KeyboardEvent) => {
      if (!onDesktop() || event.key !== "Enter") return;
      if (event.target instanceof Element &&
          event.target.matches("#udsSearch, #udsCatalogSearch") &&
          root?.contains(event.target)) {
        showFocusedResults();
      }
    };
    const onResize = () => {
      attach();
      measureHeader();
    };

    window.addEventListener("updown:services-ready", attach);
    window.addEventListener("updown:catalog-ready", attach);
    window.addEventListener("resize", onResize);
    document.addEventListener("click", onSearchClick);
    document.addEventListener("keydown", onSearchEnter);
    attachFrame = requestAnimationFrame(attach);

    return () => {
      window.removeEventListener("updown:services-ready", attach);
      window.removeEventListener("updown:catalog-ready", attach);
      window.removeEventListener("resize", onResize);
      document.removeEventListener("click", onSearchClick);
      document.removeEventListener("keydown", onSearchEnter);
      classObserver?.disconnect();
      headerObserver?.disconnect();
      cancelAnimationFrame(attachFrame);
      stopScroll();
    };
  }, []);

  return null;
}
