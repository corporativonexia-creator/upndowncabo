"use client";

import { jsPDF } from "jspdf";

export type Consignment = {
  id: string;
  receipt_number: number;
  owner_name: string;
  owner_phone: string;
  equipment_description: string;
  condition_notes: string;
  accessories: string;
  agreed_payout: number;
  asking_price: number;
  expires_on: string | null;
  payout_business_days: number;
  status: "received" | "on_sale" | "sold_pending" | "paid" | "returned" | "refunded" | "refunded_paid";
  product_id: string | null;
  sale_id: string | null;
  sold_price: number | null;
  sold_at: string | null;
  payout_due_on: string | null;
  paid_at: string | null;
  payout_method?: string | null;
  payout_reference?: string | null;
  payout_recorded_at?: string | null;
  created_at: string;
};

export const consignmentFolio = (number: number) => "CG" + String(number).padStart(6, "0");
export const consignmentMoney = (value: number) => new Intl.NumberFormat("es-MX", {
  style: "currency", currency: "MXN",
}).format(value);

// Code39 accepts alphanumeric folios without punctuation; verified 3-wide-of-9
// patterns, including C and G, and the surrounding start/stop characters.
const CODE39: Record<string, string> = {
  "*": "nwnnwnwnn", "C": "wnwnnwnnn", "G": "nnnnnwwnw",
  "0": "nnnwwnwnn", "1": "wnnwnnnnw", "2": "nnwwnnnnw",
  "3": "wnwwnnnnn", "4": "nnnwwnnnw", "5": "wnnwwnnnn",
  "6": "nnwwwnnnn", "7": "nnnwnnwnw", "8": "wnnwnnwnn",
  "9": "nnwwnnwnn",
};

function barcode(doc: jsPDF, value: string, top: number) {
  const bars = ("*" + value + "*").split("").map(c => CODE39[c]);
  if (bars.some(pattern => !pattern)) throw new Error("El folio no admite Code39");
  const unit = 0.34, wide = 2.5;
  const width = (bars.reduce((sum, pattern) => sum + [...pattern].reduce(
    (n, part) => n + (part === "w" ? wide : 1), 0), 0) + bars.length - 1) * unit;
  let x = (80 - width) / 2;
  doc.setFillColor(0, 0, 0);
  bars.forEach((pattern, index) => {
    [...pattern].forEach((part, partIndex) => {
      const step = (part === "w" ? wide : 1) * unit;
      if (partIndex % 2 === 0) doc.rect(x, top, step, 11, "F");
      x += step;
    });
    if (index < bars.length - 1) x += unit;
  });
}

function receiptDate(value: string) {
  return new Intl.DateTimeFormat("es-MX", {
    dateStyle: "medium", timeStyle: "short", timeZone: "America/Mazatlan",
  }).format(new Date(value));
}

export function buildConsignmentReceipt(item: Consignment) {
  const sections = [
    ["PROPIETARIO", item.owner_name], ["TELÉFONO", item.owner_phone],
    ["EQUIPO EN CONSIGNACIÓN", item.equipment_description],
    ["ESTADO AL RECIBIR", item.condition_notes], ["ACCESORIOS", item.accessories],
    ["IMPORTE PACTADO PARA EL PROPIETARIO", consignmentMoney(item.agreed_payout)],
    ["PRECIO DE EXHIBICIÓN", consignmentMoney(item.asking_price)],
    ["PLAZO DE PAGO TRAS LA VENTA", `${item.payout_business_days} día(s) hábiles (salvo acuerdo por escrito)`],
    ["FIN DEL PERIODO DE EXHIBICIÓN", item.expires_on || "Sin fecha establecida"],
  ];
  const tester = new jsPDF({ unit: "mm", format: [80, 280] });
  tester.setFont("courier", "normal");
  tester.setFontSize(8);
  const sectionHeight = sections.reduce((total, [label, value]) => total +
    3.5 + tester.splitTextToSize(label, 70).length * 2.7 + tester.splitTextToSize(value, 70).length * 3.7 + 1, 0);
  const pageHeight = Math.max(188, Math.ceil(86 + sectionHeight + 33));
  const doc = new jsPDF({ unit: "mm", format: [80, pageHeight], compress: true });
  (["PROPIETARIO", "TIENDA"] as const).forEach((copy, i) => {
    if (i) doc.addPage([80, pageHeight], "portrait");
    let y = 9;
    function center(value: string, size: number, bold = false) {
      doc.setFont("courier", bold ? "bold" : "normal"); doc.setFontSize(size);
      doc.text(value, 40, y, { align: "center" }); y += size * 0.45 + 1.8;
    }
    center("UP AND DOWN CABO", 14, true);
    center("RECIBO DE EQUIPO EN CONSIGNACIÓN", 8, true);
    center(consignmentFolio(item.receipt_number), 17, true);
    barcode(doc, consignmentFolio(item.receipt_number), y); y += 15;
    center("COPIA " + copy, 8, true);
    center(receiptDate(item.created_at), 7);
    doc.line(5, y, 75, y); y += 5;
    sections.forEach(([label, value]) => {
      doc.setFont("courier", "bold"); doc.setFontSize(7);
      const labelLines: string[] = doc.splitTextToSize(label, 70);
      doc.text(labelLines, 5, y); y += labelLines.length * 2.7 + 0.8;
      doc.setFont("courier", "normal"); doc.setFontSize(8);
      const lines: string[] = doc.splitTextToSize(value, 70);
      doc.text(lines, 5, y); y += lines.length * 3.7 + 1.6;
    });
    doc.line(5, y, 75, y); y += 5;
    center("La venta se registra como producto normal en POS.", 6.5);
    center("El propietario cobra después de la venta.", 6.5);
    center("Este recibo NO acredita pago de la mercancía.", 6.5, true);
    y += 8; doc.line(12, y, 68, y); y += 4;
    center("Firma de quien entrega", 7);
  });
  return doc;
}

export function buildConsignmentPayoutReceipt(item: Consignment) {
  if (item.status !== "paid" || !item.paid_at) throw new Error("No hay una liquidación completada para imprimir.");
  const methodLabel = item.payout_method === "cash" ? "Efectivo" :
    item.payout_method === "transfer" ? "Transferencia" : "Otro";
  const rows = [
    ["FECHA", receiptDate(item.paid_at)], ["PROPIETARIO", item.owner_name],
    ["TELÉFONO", item.owner_phone], ["ARTÍCULO", item.equipment_description],
    ["IMPORTE ENTREGADO", consignmentMoney(Number(item.agreed_payout))],
    ["MÉTODO DE PAGO", methodLabel], ["REFERENCIA", item.payout_reference || "Sin referencia"],
  ];
  // Long owner names, product descriptions and bank references must not clip the signature.
  const tester = new jsPDF({ unit: "mm", format: [80, 280] });
  tester.setFont("courier", "normal"); tester.setFontSize(8);
  const rowHeight = rows.reduce((height, [, value]) => height +
    3.4 + tester.splitTextToSize(value, 70).length * 4 + 2, 0);
  const pageHeight = Math.max(158, Math.ceil(78 + rowHeight));
  const doc = new jsPDF({ unit: "mm", format: [80, pageHeight], compress: true });
  (["PROPIETARIO", "TIENDA"] as const).forEach((copy, index) => {
    if (index) doc.addPage([80, pageHeight], "portrait");
    let y = 10;
    const center = (line: string, size: number, bold = false) => {
      doc.setFont("courier", bold ? "bold" : "normal"); doc.setFontSize(size);
      doc.text(line, 40, y, { align: "center" }); y += size * 0.48 + 2;
    };
    center("UP AND DOWN CABO", 14, true);
    center("COMPROBANTE DE LIQUIDACION", 9, true);
    center(`CONSIGNACION ${consignmentFolio(item.receipt_number)}`, 10, true);
    center(`COPIA ${copy}`, 8);
    doc.line(5, y, 75, y); y += 7;
    rows.forEach(([label, value]) => {
      doc.setFont("courier", "bold"); doc.setFontSize(7); doc.text(label, 5, y); y += 3.4;
      doc.setFont("courier", "normal"); doc.setFontSize(8);
      const lines: string[] = doc.splitTextToSize(value, 70);
      doc.text(lines, 5, y); y += lines.length * 4 + 2;
    });
    y += 11; doc.line(12, y, 68, y); y += 5;
    center("Firma de conformidad del propietario", 7);
  });
  return doc;
}
