"use client";

import { useEffect } from "react";
import { createClient } from "@/lib/supabase/client";

export default function InventoryLiveEnhancer() {
  useEffect(() => {
    const db = createClient();
    let stopped = false;

    async function syncDisplayedStock() {
      const { data, error } = await db
        .from("products")
        .select("id,name,sku,barcode,stock");
      if (error || stopped) return;

      const bySku = new Map((data || []).map((p) => [String(p.sku || "").trim().toLowerCase(), Number(p.stock || 0)]));
      const byBarcode = new Map((data || []).filter((p) => p.barcode).map((p) => [String(p.barcode).trim(), Number(p.stock || 0)]));

      document.querySelectorAll<HTMLTableRowElement>(".inv-tablebox tbody tr").forEach((tr) => {
        const cells = tr.querySelectorAll<HTMLTableCellElement>("td");
        if (cells.length < 5) return;
        const sku = String(cells[2]?.textContent || "").trim().toLowerCase();
        const barcode = String(cells[3]?.textContent || "").trim();
        const current = bySku.get(sku) ?? byBarcode.get(barcode);
        if (current === undefined) return;
        const stockCell = cells[4];
        if (stockCell) stockCell.textContent = String(current);
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
      .channel("admin-inventory-live-products")
      .on("postgres_changes", { event: "*", schema: "public", table: "products" }, () => syncDisplayedStock())
      .subscribe();

    return () => {
      stopped = true;
      observer.disconnect();
      db.removeChannel(channel);
    };
  }, []);

  return null;
}
