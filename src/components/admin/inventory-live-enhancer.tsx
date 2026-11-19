"use client";

import { useEffect } from "react";
import { createClient } from "@/lib/supabase/client";

export default function InventoryLiveEnhancer() {
  useEffect(() => {
    const db = createClient();

    function installMovementSearch() {
      const select = document.querySelector<HTMLSelectElement>('.inv-form select[name="variant"]');
      if (!select || select.dataset.searchInstalled === "1") return;
      select.dataset.searchInstalled = "1";

      const search = document.createElement("input");
      search.type = "search";
      search.placeholder = "Buscar por producto, SKU o código de barras…";
      search.autocomplete = "off";
      search.style.marginBottom = "8px";
      search.style.width = "100%";
      search.style.padding = "11px 12px";
      search.style.border = "1px solid rgba(20,62,53,.16)";
      search.style.borderRadius = "10px";
      select.parentElement?.insertBefore(search, select);

      const original = Array.from(select.options).map((o) => ({ value: o.value, text: o.textContent || "" }));
      const render = () => {
        const q = search.value.trim().toLocaleLowerCase("es-MX");
        const selected = select.value;
        select.innerHTML = "";
        original.forEach((o, index) => {
          if (index !== 0 && q && !o.text.toLocaleLowerCase("es-MX").includes(q)) return;
          const option = document.createElement("option");
          option.value = o.value;
          option.textContent = o.text;
          select.appendChild(option);
        });
        if (Array.from(select.options).some((o) => o.value === selected)) select.value = selected;
      };
      search.addEventListener("input", render);
    }

    installMovementSearch();
    // React owns inventory quantities and metrics. Only watch for a newly
    // mounted movement form; never query stock on each DOM mutation.
    const observer = new MutationObserver(installMovementSearch);
    observer.observe(document.querySelector(".inv-page") || document.body, { childList: true, subtree: true });

    const channel = db
      .channel("admin-inventory-live-variants")
      .on("postgres_changes", { event: "*", schema: "public", table: "product_variants" }, () => {
        window.dispatchEvent(new Event("updown-inventory-stock-changed"));
      })
      .subscribe();

    return () => {
      observer.disconnect();
      db.removeChannel(channel);
    };
  }, []);

  return null;
}
