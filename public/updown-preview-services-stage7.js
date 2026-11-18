/* UpNDown Premium White / Stage 7 — presentation only, database-led.
 * Titles, bilingual descriptions, bullets, photos, CTAs, visibility and order
 * come exclusively from public.storefront_services via updown-parity-runtime.js.
 * This file must never rewrite product/service copy, hide registered services,
 * or mutate Supabase. It only applies the existing preview card layout.
 */
(function () {
  "use strict";
  if (typeof window.__UPDOWN_STAGE7_SERVICES_TEARDOWN__ === "function") {
    window.__UPDOWN_STAGE7_SERVICES_TEARDOWN__();
  }

  const root = document.getElementById("updown-store");
  if (!root?.classList.contains("uds-preview")) return;
  const lang = () => document.documentElement.lang.toLowerCase().startsWith("en") ? "en" : "es";
  const VS_GOLF_KEY = "27a30f4f-018e-460a-9b7d-b1dc1488143f";

  function isComingSoon(card) {
    const label = card.querySelector(".uds-service-title small")?.textContent || "";
    const hasContact = Boolean(card.querySelector(".uds-service-actions a"));
    // Status and contact eligibility are fully admin-managed text/CTA fields.
    return !hasContact && /próximamente|coming soon/i.test(label);
  }

  function apply() {
    if (!root.isConnected) return;
    const arrivals = root.querySelector("#udsNew");
    const section = root.querySelector("#udsServices");
    const catalog = root.querySelector("#udsCatalog");
    const grid = section?.querySelector(".uds-services-grid");
    if (!arrivals || !section || !catalog || !grid) return;

    if (arrivals.nextElementSibling !== section) arrivals.insertAdjacentElement("afterend", section);

    // Intro is page copy; service records and their order remain untouched.
    const intro = section.querySelector(".uds-section-intro");
    if (intro) {
      intro.textContent = lang() === "en"
        ? "Equipment care, trade-ins, consignment and guidance in one place."
        : "Cuidado de equipo, intercambios, consignación y asesoría en un solo lugar.";
    }

    for (const card of grid.querySelectorAll(":scope > [data-service-card]")) {
      card.classList.add("uds-preview-service-compact");
      card.classList.remove("uds-preview-service-merged");
      card.removeAttribute("aria-hidden");
      card.classList.toggle("uds-preview-service-coming", isComingSoon(card));
      card.classList.toggle("uds-preview-vs-card", card.dataset.serviceKind === VS_GOLF_KEY);
      // Do not touch title, subtitle, description, image, CTA, body or aria.
    }
    // The runtime queries ordered active rows; preserve that order exactly.
    const rows = window.__UPDOWN_SERVICES__;
    if (Array.isArray(rows)) {
      for (const row of rows) {
        if (!row?.key) continue;
        const card = [...grid.querySelectorAll(":scope > [data-service-card]")]
          .find(node => node.dataset.serviceKind === row.key);
        if (card) grid.appendChild(card);
      }
    }
    // The GHIN graphic already includes the USGA mark; avoid duplicate
    // decoration without changing its admin-managed photo.
    section.querySelector('[data-service-kind="ghin"] .uds-service-ghin-logo')
      ?.setAttribute("aria-hidden", "true");
    root.classList.add("uds-preview-services-stage7");
    // Mobile links are rendered from the same DB rows by the shared runtime.
  }

  function onServiceToggle(event) {
    const trigger = event.target?.closest?.("#udsServices .uds-service-head");
    const section = root.querySelector("#udsServices");
    if (!trigger || !section) return;
    const card = trigger.closest("[data-service-card]");
    if (!card?.classList.contains("is-open")) return;
    requestAnimationFrame(() => requestAnimationFrame(() => {
      if (card.classList.contains("is-open") || !section.isConnected) return;
      section.scrollIntoView({
        behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth",
        block: "start",
      });
    }));
  }
  root.addEventListener("click", onServiceToggle, true);

  const onReady = () => apply();
  window.addEventListener("updown:services-ready", onReady);
  window.addEventListener("updown:language-change", onReady);

  const dispose = () => {
    window.removeEventListener("updown:services-ready", onReady);
    window.removeEventListener("updown:language-change", onReady);
    root.removeEventListener("click", onServiceToggle, true);
    window.removeEventListener("updown:preview-services-dispose", dispose);
    if (window.__UPDOWN_STAGE7_SERVICES_TEARDOWN__ === dispose) {
      window.__UPDOWN_STAGE7_SERVICES_TEARDOWN__ = null;
    }
  };
  window.__UPDOWN_STAGE7_SERVICES_TEARDOWN__ = dispose;
  window.addEventListener("updown:preview-services-dispose", dispose, { once: true });
  apply();
})();
