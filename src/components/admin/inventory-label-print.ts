"use client";

import { createClient } from "@/lib/supabase/client";

type InventoryLabelRow = {
  product_id: string;
  variant_id: string;
  product_name: string;
  variant_title: string;
  barcode: string | null;
  stock: number;
  attributes?: Record<string, unknown> | null;
};

const L = ["0001101", "0011001", "0010011", "0111101", "0100011", "0110001", "0101111", "0111011", "0110111", "0001011"];
const G = ["0100111", "0110011", "0011011", "0100001", "0011101", "0111001", "0000101", "0010001", "0001001", "0010111"];
const R = ["1110010", "1100110", "1101100", "1000010", "1011100", "1001110", "1010000", "1000100", "1001000", "1110100"];
const PARITY = ["LLLLLL", "LLGLGG", "LLGGLG", "LLGGGL", "LGLLGG", "LGGLLG", "LGGGLL", "LGLGLG", "LGLGGL", "LGGLGL"];

function esc(value: string) {
  return value.replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;" })[c] || c);
}

function validEan13(value: string) {
  if (!/^\d{13}$/.test(value)) return false;
  const digits = value.split("").map(Number);
  const sum = digits.slice(0, 12).reduce((total, digit, index) => total + digit * (index % 2 ? 3 : 1), 0);
  return (10 - sum % 10) % 10 === digits[12];
}

function printableBarcode(value: string) {
  // A GTIN-12 is encoded with an implied leading zero, never persisted with it.
  if (/^\d{12}$/.test(value)) return validEan13(`0${value}`) ? { encoded: `0${value}`, visible: value, upcA: true } : null;
  if (/^\d{13}$/.test(value)) return validEan13(value) ? { encoded: value, visible: value, upcA: false } : null;
  return null;
}

function barcodeSvg(code: NonNullable<ReturnType<typeof printableBarcode>>) {
  const digits = code.encoded.split("").map(Number), parity = PARITY[digits[0]];
  let bits = "101";
  for (let index = 1; index <= 6; index++) bits += (parity[index - 1] === "L" ? L : G)[digits[index]];
  bits += "01010";
  for (let index = 7; index <= 12; index++) bits += R[digits[index]];
  bits += "101";
  const barWidth = .42, left = 4, width = bits.length * barWidth + left * 2;
  let bars = "";
  for (let index = 0; index < bits.length; index++) {
    if (bits[index] !== "1") continue;
    const guard = index < 3 || (index >= 45 && index < 50) || index >= 92;
    bars += `<rect x="${left + index * barWidth}" y="1" width="${barWidth + .02}" height="${guard ? 14.4 : 12.5}"/>`;
  }
  const digitsText = code.upcA
    ? `<text x="2.3" y="16.7" text-anchor="middle" font-family="Arial,sans-serif" font-size="3">${code.visible[0]}</text><text x="14" y="18" text-anchor="middle" font-family="Arial,sans-serif" font-size="3" letter-spacing=".42">${code.visible.slice(1, 6)}</text><text x="34" y="18" text-anchor="middle" font-family="Arial,sans-serif" font-size="3" letter-spacing=".42">${code.visible.slice(6, 11)}</text><text x="${width - 2.3}" y="16.7" text-anchor="middle" font-family="Arial,sans-serif" font-size="3">${code.visible[11]}</text>`
    : `<text x="${width / 2}" y="18" text-anchor="middle" font-family="Arial,sans-serif" font-size="3" letter-spacing=".42">${code.visible}</text>`;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} 18.5"><rect width="100%" height="100%" fill="white"/><g fill="black">${bars}</g>${digitsText}</svg>`;
}

function money(value: number, currency: string) {
  const code = currency === "USD" ? "USD" : "MXN";
  return `${new Intl.NumberFormat("es-MX", { style: "currency", currency: code, minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(value)} ${code}`;
}

/** One entry point for 50 × 30 mm thermal labels; price is always re-read before printing. */
export async function printInventoryLabels(row: InventoryLabelRow) {
  const barcode = String(row.barcode || "").trim();
  const printable = printableBarcode(barcode);
  if (!printable) {
    alert("Este producto necesita un código UPC-A de 12 o EAN-13 de 13 dígitos con verificador válido para imprimir.");
    return;
  }

  const db = createClient();
  // These reads are independent. Resolve both by immutable IDs, not by table text or SKU.
  const [{ data: variant, error: variantError }, { data: product, error: productError }] = await Promise.all([
    db.from("product_variants").select("title,attributes,price,sale_price").eq("id", row.variant_id).maybeSingle(),
    db.from("products").select("price,sale_price,currency").eq("id", row.product_id).maybeSingle(),
  ]);
  if (variantError || productError || !variant || !product) {
    alert("No se pudo verificar el precio actual de esta variante. Intenta nuevamente.");
    return;
  }

  // Preserve the commercial priority: variant offer > variant price > parent offer > parent price.
  const rawPrice = variant.sale_price ?? variant.price ?? product.sale_price ?? product.price;
  const price = rawPrice == null ? null : Number(rawPrice);
  if (price === null || !Number.isFinite(price) || price < 0) {
    alert("No pude obtener un precio válido para esta etiqueta. Revisa el precio del producto o de su variante.");
    return;
  }

  const rawQuantity = window.prompt("¿Cuántas etiquetas deseas imprimir?", String(Math.max(1, Number(row.stock) || 1)));
  if (rawQuantity === null) return;
  const quantity = Math.max(1, Math.min(500, Math.floor(Number(rawQuantity) || 1)));
  const attributes = (variant.attributes || row.attributes || {}) as Record<string, unknown>;
  const variantTitle = String(variant.title || row.variant_title || "").trim();
  const titleParts = variantTitle.split(/\s*[\/|·]\s*/).filter(Boolean);
  const size = String(attributes.talla || attributes.size || "").trim();
  const color = String(attributes.color || attributes.colour || titleParts.slice(1).join(" / ") || "").trim();
  const lowerLine = [row.product_name, color].filter(Boolean).join(" · ");
  const currency = product.currency === "USD" ? "USD" : "MXN";
  const symbolSvg = barcodeSvg(printable);
  const labels = Array.from({ length: quantity }, () => `<section class="label"><div class="brand">UP AND DOWN</div><div class="product-line"><div class="name">${esc(size)}</div><div class="price">${esc(money(price, currency))}</div></div><div class="variant">${esc(lowerLine)}</div><div class="barcode">${symbolSvg}</div></section>`).join("");
  const popup = window.open("", "_blank", "width=700,height=700");
  if (!popup) {
    alert("Permite ventanas emergentes para imprimir etiquetas.");
    return;
  }
  popup.document.write(`<!doctype html><html><head><meta charset="utf-8"><title>Etiquetas</title><style>@page{size:50mm 30mm;margin:0}*{box-sizing:border-box}html,body{margin:0;padding:0;background:#fff;font-family:Arial,sans-serif}.label{width:50mm;height:30mm;padding:1.1mm 2mm .6mm;overflow:hidden;page-break-after:always;break-after:page;text-align:center;color:#000}.label:last-child{page-break-after:auto}.brand{font-family:Arial,sans-serif;font-size:8.2pt;font-weight:900;letter-spacing:1.2mm;line-height:1.05;white-space:nowrap;margin:0 auto 1mm}.product-line{display:flex;align-items:baseline;justify-content:center;gap:1.5mm;max-width:46mm;margin:0 auto}.name{font-size:7.4pt;font-weight:800;line-height:1;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:29mm}.price{font-size:10pt;font-weight:900;line-height:1;white-space:nowrap}.variant{font-size:5.6pt;font-weight:600;line-height:1;margin-top:.35mm;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.barcode{height:17mm;margin:.45mm auto 0;display:flex;align-items:center;justify-content:center}.barcode svg{width:44mm;height:17mm;display:block}@media screen{body{background:#eee;padding:10px}.label{background:#fff;margin:0 auto 10px;box-shadow:0 2px 10px #999}}@media print{body{background:#fff}.label{margin:0;box-shadow:none}}</style></head><body>${labels}<script>window.onload=()=>setTimeout(()=>window.print(),250)<\/script></body></html>`);
  popup.document.close();
}
