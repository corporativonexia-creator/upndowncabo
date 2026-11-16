"use client";

import { useEffect } from "react";

/**
 * Desktop-only navigation polish for the protected preview.
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
            behavior: window.matchMedia("(prefers-reduced-motion: reduce)")
              .matches ? "auto" : "smooth",
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
    };

    const attach = () => {
      const next = document.querySelector<HTMLElement>("#updown-store.uds-preview");
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
      if (header && typeof ResizeObserver !== "undefined") {
        headerObserver = new ResizeObserver(measureHeader);
        headerObserver.observe(header);
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
