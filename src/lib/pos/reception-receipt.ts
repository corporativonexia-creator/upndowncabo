"use client";

import { jsPDF } from "jspdf";

export type ServiceReception = {
  id: string;
  receipt_number: number;
  service_product_id: string;
  status: "received" | "ready" | "delivered";
  checkout_sale_id?: string | null;
  customer_name: string;
  customer_phone: string;
  equipment_description: string;
  service_name: string;
  work_description: string;
  condition_notes: string;
  accessories: string;
  employee_number: string;
  employee_name: string;
  terminal_name: string;
  received_at: string;
};

export function receptionFolio(number: number) {
  return "SR-" + String(number).padStart(6, "0");
}

export function receptionFileName(reception: ServiceReception) {
  return "UPNDOWN-Recepcion-" + receptionFolio(reception.receipt_number) + ".pdf";
}

export function receptionDate(value: string) {
  return new Intl.DateTimeFormat("es-MX", {
    timeZone: "America/Mazatlan",
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

// Code 39 for uppercase workshop folios (SR- + digits).
// Printed as actual bars on BOTH 80-mm PDF copies, not a decorative stripe.
const CODE39: Record<string,string> = {
  "*":"nwnnwnwnn", "-":"nnnnwnwnw",
  "S":"nnwnnnwwn", "R":"wnnnnnwwn",
  "0":"nnnwwnwnn", "1":"wnnwnnnnw", "2":"nnwwnnnnw", "3":"wnwwnnnnn",
  "4":"nnnwwnnnw", "5":"wnnwwnnnn", "6":"nnwwwnnnn", "7":"nnnwnnwnw",
  "8":"wnnwnnwnn", "9":"nnwwnnwnn",
};
function drawReceptionBarcode(doc: jsPDF, folio: string, top: number) {
  const pattern = ("*" + folio + "*").split("").map(c => CODE39[c]);
  if (pattern.some(v => !v)) throw new Error("Código de recepción no compatible con Code 39");
  const unit = 0.34;
  const wide = 2.5;
  const widths = pattern.flatMap(part => [...part].map(p => p === "w" ? wide : 1));
  const total = (widths.reduce((sum, width) => sum + width, 0) + pattern.length - 1) * unit;
  let x = (80 - total) / 2;
  doc.setFillColor(0, 0, 0);
  pattern.forEach((part,index) => {
    for (let i=0;i<part.length;i++) {
      const width = (part[i] === "w" ? wide : 1) * unit;
      if (i % 2 === 0) doc.rect(x, top, width, 12, "F");
      x += width;
    }
    if (index + 1 < pattern.length) x += unit;
  });
}

type Field = { label: string; value: string };
function fieldsFor(reception: ServiceReception): Field[] {
  return [
    { label: "CLIENTE", value: reception.customer_name },
    { label: "TELEFONO", value: reception.customer_phone },
    { label: "EQUIPO RECIBIDO", value: reception.equipment_description },
    { label: "SERVICIO", value: reception.service_name },
    { label: "TRABAJO SOLICITADO", value: reception.work_description },
    { label: "ESTADO AL RECIBIR", value: reception.condition_notes },
    { label: "ACCESORIOS", value: reception.accessories },
    { label: "RECIBIO", value: "#" + reception.employee_number + " " + reception.employee_name },
    { label: "TERMINAL", value: reception.terminal_name },
  ];
}

export function buildReceptionPdf(reception: ServiceReception) {
  const tester = new jsPDF({ unit: "mm", format: [80, 250] });
  const data = fieldsFor(reception);
  const pageHeight = Math.max(150, Math.ceil(
    83 + data.reduce((sum, f) => {
      tester.setFont("helvetica", "normal");
      tester.setFontSize(8);
      return sum + 4.1 + tester.splitTextToSize(f.value, 70).length * 3.8 + 1.5;
    }, 0) + 26
  ));

  const doc = new jsPDF({ unit: "mm", format: [80, pageHeight], compress: true });
  const copies = ["CLIENTE", "TALLER"] as const;

  copies.forEach((copy, index) => {
    if (index) doc.addPage([80, pageHeight], "portrait");
    let y = 9;
    const center = (text: string, size: number, bold = false) => {
      doc.setFont("helvetica", bold ? "bold" : "normal");
      doc.setFontSize(size);
      doc.text(text, 40, y, { align: "center" });
      y += size * 0.45 + 1.8;
    };
    const rule = () => {
      doc.setDrawColor(130);
      doc.line(5, y, 75, y);
      y += 4;
    };
    center("UP AND DOWN CABO", 14, true);
    center("PLAZA ALBA · EL TEZAL · LOS CABOS", 7);
    center("RECEPCION DE EQUIPO PARA SERVICIO", 8.5, true);
    y += 2;
    rule();
    center(receptionFolio(reception.receipt_number), 18, true);
    drawReceptionBarcode(doc, receptionFolio(reception.receipt_number), y);
    y += 16;
    center("COPIA " + copy, 9, true);
    center(receptionDate(reception.received_at), 7);
    rule();
    data.forEach((f) => {
      doc.setFont("helvetica", "bold");
      doc.setFontSize(7);
      doc.text(f.label, 5, y);
      y += 3.5;
      doc.setFont("helvetica", "normal");
      doc.setFontSize(8);
      const lines: string[] = doc.splitTextToSize(f.value, 70);
      doc.text(lines, 5, y);
      y += lines.length * 3.8 + 1.5;
    });
    rule();
    center(copy === "CLIENTE" ? "CONSERVE ESTE COMPROBANTE" : "MANTENER JUNTO AL EQUIPO", 7.5, true);
    center("Recepcion de equipo. NO es comprobante de pago.", 6.4);
    if (copy === "CLIENTE") {
      y += 8;
      doc.setDrawColor(140);
      doc.line(12, y, 68, y);
      y += 4;
      center("Firma de quien entrega", 7);
    }
  });
  return doc;
}
