"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { productPageUrl } from "@/lib/storefront/product-share";
import type { RelatedProduct } from "@/lib/storefront/get-related-products";

function affiliateCode(): string | null {
  try {
    const query = new URLSearchParams(window.location.search).get("ref");
    if (query && /^[a-z0-9_-]{1,48}$/i.test(query)) return query.toUpperCase();
    const stored = JSON.parse(localStorage.getItem("upDownAffiliateReferral") || "null");
    if (stored && stored.code && Number(stored.expires_at) > Date.now()
      && /^[a-z0-9_-]{1,48}$/i.test(stored.code)) return String(stored.code).toUpperCase();
  } catch { /* Private browsing can disable local storage. */ }
  return null;
}
function price(amount: number, currency: string) {
  try { return new Intl.NumberFormat("es-MX", { style: "currency", currency }).format(amount); }
  catch { return new Intl.NumberFormat("es-MX", { style: "currency", currency: "MXN" }).format(amount); }
}
export default function RelatedProductsRail({ products, preview }: { products: RelatedProduct[]; preview: boolean }) {
  const [code, setCode] = useState<string | null>(null);
  useEffect(() => { void Promise.resolve().then(() => setCode(affiliateCode())); }, []);
  if (!products.length) return null;
  return <section className="ud-related" aria-label="Artículos relacionados">
    <div className="ud-related-heading">
      <div><span>DESCUBRE MÁS EQUIPO</span><h2>Productos que también podrían interesarte</h2></div>
      <div className="ud-related-controls">
        <button type="button" aria-label="Ver productos anteriores" onClick={() =>
          document.getElementById("ud-related-strip")?.scrollBy({ left: -390, behavior: "smooth" })}>‹</button>
        <button type="button" aria-label="Ver más productos" onClick={() =>
          document.getElementById("ud-related-strip")?.scrollBy({ left: 390, behavior: "smooth" })}>›</button>
      </div>
    </div>
    <div id="ud-related-strip" className="ud-related-strip" role="list">
      {products.map(item =>
        <Link prefetch={false} role="listitem" key={item.id} className="ud-related-card"
          href={productPageUrl(item.key, preview, code)}>
          <div className="ud-related-image">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img loading="lazy" alt={item.image ? item.name : ""}
              src={item.image || "/assets/updown-product-placeholder.svg"}
              onError={event => {
                const img = event.currentTarget;
                if (!img.src.endsWith("/assets/updown-product-placeholder.svg")) {
                  img.src = "/assets/updown-product-placeholder.svg";
                  img.alt = "";
                }
              }} />
            {item.stock <= 0 && <span className="ud-related-sold">Agotado</span>}
          </div>
          <div className="ud-related-caption">
            <small>{item.relation}</small><strong>{item.name}</strong>
            <span>{price(item.price, item.currency)}</span>
          </div>
        </Link>)}
    </div>
  </section>;
}
