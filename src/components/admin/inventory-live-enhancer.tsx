"use client";

import { useEffect } from "react";
import { createClient } from "@/lib/supabase/client";

export default function InventoryLiveEnhancer() {
  useEffect(() => {
    const db = createClient();
    let stopped = false;

    async function syncDisplayedStock() {
      // Inventory table rows represent variants, not parent products.
      // Parent barcode can equal a variant barcode, so never use parent stock here.
      const { data, error } = await db
        .from("product_variants")
        .select("sku,barcode,stock");
      if (error || stopped) return;

      const bySku = new Map((data || []).map(v => [String(v.sku || "").trim().toLowerCase(), Number(v.stock || 0)]));
      document.querySelectorAll<HTMLTableRowElement>(".inv-tablebox tbody tr").forEach(tr => {
        const cells = tr.querySelectorAll<HTMLTableCellElement>("td");
        if (cells.length < 5) return;
        const sku = String(cells[2]?.textContent || "").trim().toLowerCase();
        const stock = bySku.get(sku);
        if (stock === undefined) return;
        if (cells[4] && cells[4].textContent !== String(stock)) cells[4].textContent = String(stock);
      });
    }

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

    syncDisplayedStock();
    installMovementSearch();
    const observer = new MutationObserver(() => {
      installMovementSearch();
      syncDisplayedStock();
    });
    observer.observe(document.body, { childList: true, subtree: true });

    const channel = db
      .channel("admin-inventory-live-variants")
      .on("postgres_changes", { event: "*", schema: "public", table: "product_variants" }, () => syncDisplayedStock())
      .subscribe();

    return () => {
      stopped = true;
      observer.disconnect();
      db.removeChannel(channel);
    };
  }, []);

  return null;
}
