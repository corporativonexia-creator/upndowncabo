/* HOTFIX60B_SELLER_POS_ACCESS */
"use client";

import { FormEvent, useEffect, useMemo, useRef, useState } from "react";
import { createClient } from "@supabase/supabase-js";
import { jsPDF } from "jspdf";

type Access = {
  employee_id: string;
  employee_number: string;
  full_name: string;
  employee_role: string;
  employee_status: string;
  terminal_id: string | null;
  terminal_name: string | null;
  terminal_authorized: boolean;
  open_shift_id: string | null;
  open_shift_started_at: string | null;
  opening_cash: number | null;
};


type Product = {
  id: string;
  name: string;
  sku: string | null;
  barcode: string | null;
  brand: string | null;
  model: string | null;
  price: number | string | null;
  sale_price: number | string | null;
  stock: number | string | null;
  cover_image_url: string | null;
  status: string;
};

type CartItem = {
  product: Product;
  quantity: number;
};

type ShiftPayment = {
  method: "cash" | "card_terminal" | "transfer" | "other";
  amount: number | string;
  reference?: string | null;
};

type ShiftSale = {
  id: string;
  sale_number: number;
  status: string;
  currency: string;
  subtotal: number | string;
  discount_amount: number | string;
  total: number | string;
  created_at: string;
  void_reason?: string | null;
  refund_reason?: string | null;
  items: Array<{
    product_id: string;
    sku?: string | null;
    product_name: string;
    unit_price: number | string;
    quantity: number;
    line_total: number | string;
  }>;
  payments: ShiftPayment[];
};


type LookupSale = {
  id: string;
  sale_number: number;
  status: string;
  currency: string;
  subtotal: number | string;
  discount_amount: number | string;
  total: number | string;
  created_at: string;
  shift_id: string;
  items: ShiftSale["items"];
  payments: ShiftSale["payments"];
};
type RefundSearchSale = {
  id: string;
  sale_number: number;
  status: string;
  currency: string;
  total: number | string;
  created_at: string;
  employee_number?: string | null;
  employee_name?: string | null;
  terminal_name?: string | null;
  products?: string | null;
  skus?: string | null;
  payment_methods?: string | null;
  payment_references?: string | null;
};

type CashMovement = {
  id: string;
  movement_type: "cash_in" | "cash_out";
  amount: number | string;
  reason: string;
  created_at: string;
};


const DEVICE_KEY = "updown-pos-device-token-v1";
const INACTIVITY_MS = 30 * 60 * 1000;
const ACCESS_REVALIDATE_MS = 60 * 1000;

function money(value: number) {
  return new Intl.NumberFormat("es-MX", {
    style: "currency",
    currency: "MXN",
  }).format(Number(value || 0));
}


function productPrice(product: Product) {
  return Number(product.sale_price ?? product.price ?? 0);
}

function numeric(value: number | string | null | undefined) {
  const n = Number(value ?? 0);
  return Number.isFinite(n) ? n : 0;
}

function parseMoneyText(value: string) {
  const normalized = String(value || "").replace(/[^0-9.-]/g, "");
  const amount = Number(normalized);
  return Number.isFinite(amount) ? amount : 0;
}

function paymentLabel(method: ShiftPayment["method"]) {
  if (method === "cash") return "Efectivo";
  if (method === "card_terminal") return "Terminal";
  if (method === "transfer") return "Transferencia";
  return "Otro";
}


function saleStatusLabel(status: string) {
  if (status === "completed") return "COMPLETADA";
  if (status === "voided") return "ANULADA";
  if (status === "refunded") return "DEVUELTA";
  return String(status || "VENTA").toUpperCase();
}

function receiptFileName(sale: ShiftSale) {
  return `UP-AND-DOWN-Ticket-${sale.sale_number}.pdf`;
}

function buildReceiptPdf(sale: ShiftSale, access: Access | null) {
  const doc = new jsPDF({
    orientation: "portrait",
    unit: "mm",
    format: [80, 210],
  });

  const width = 80;
  const margin = 6;
  const right = width - margin;
  let y = 8;

  const line = () => {
    doc.setDrawColor(210);
    doc.line(margin, y, right, y);
    y += 4;
  };

  const writePair = (label: string, value: string) => {
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.text(label, margin, y);
    doc.setFont("helvetica", "bold");
    doc.text(value, right, y, { align: "right" });
    y += 4;
  };

  doc.setFont("times", "bold");
  doc.setFontSize(17);
  doc.text("UP AND DOWN", width / 2, y, { align: "center" });
  y += 5;

  doc.setFont("helvetica", "bold");
  doc.setFontSize(7);
  doc.text("PUNTO DE VENTA · LOS CABOS", width / 2, y, { align: "center" });
  y += 6;

  line();

  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  doc.text(`TICKET · VENTA #${sale.sale_number}`, margin, y);
  y += 5;

  writePair(
    "Fecha",
    new Date(sale.created_at).toLocaleString("es-MX", {
      dateStyle: "short",
      timeStyle: "short",
    }),
  );
  writePair("Estado", saleStatusLabel(sale.status));
  writePair(
    "Cajero",
    access
      ? `#${access.employee_number} ${access.full_name}`
      : "UP AND DOWN",
  );
  writePair("Terminal", access?.terminal_name || "POS");

  line();

  doc.setFont("helvetica", "bold");
  doc.setFontSize(8);
  doc.text("PRODUCTOS", margin, y);
  y += 4;

  for (const item of sale.items || []) {
    doc.setFont("helvetica", "bold");
    doc.setFontSize(8);
    const title = doc.splitTextToSize(item.product_name, 55);
    doc.text(title, margin, y);
    y += title.length * 3.4;

    doc.setFont("helvetica", "normal");
    doc.setFontSize(7);
    doc.text(
      `${item.quantity} × ${money(numeric(item.unit_price))}`,
      margin,
      y,
    );
    doc.setFont("helvetica", "bold");
    doc.text(money(numeric(item.line_total)), right, y, { align: "right" });
    y += 4;

    if (item.sku) {
      doc.setFont("helvetica", "normal");
      doc.setTextColor(100);
      doc.text(`SKU: ${item.sku}`, margin, y);
      doc.setTextColor(0);
      y += 3.5;
    }
  }

  line();

  writePair("Subtotal", money(numeric(sale.subtotal)));

  if (numeric(sale.discount_amount) > 0) {
    writePair("Descuento", `-${money(numeric(sale.discount_amount))}`);
  }

  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.text("TOTAL", margin, y);
  doc.text(money(numeric(sale.total)), right, y, { align: "right" });
  y += 6;

  line();

  doc.setFont("helvetica", "bold");
  doc.setFontSize(8);
  doc.text("PAGO", margin, y);
  y += 4;

  for (const payment of sale.payments || []) {
    writePair(paymentLabel(payment.method), money(numeric(payment.amount)));
    if (payment.reference) {
      doc.setFont("helvetica", "normal");
      doc.setFontSize(7);
      doc.text(`Ref: ${payment.reference}`, margin, y);
      y += 3.5;
    }
  }

  if (sale.status === "voided" && sale.void_reason) {
    line();
    doc.setFont("helvetica", "bold");
    doc.setFontSize(8);
    doc.text("ANULACIÓN", margin, y);
    y += 4;
    doc.setFont("helvetica", "normal");
    doc.text(doc.splitTextToSize(sale.void_reason, 68), margin, y);
    y += 8;
  }

  if (sale.status === "refunded" && sale.refund_reason) {
    line();
    doc.setFont("helvetica", "bold");
    doc.setFontSize(8);
    doc.text("DEVOLUCIÓN", margin, y);
    y += 4;
    doc.setFont("helvetica", "normal");
    doc.text(doc.splitTextToSize(sale.refund_reason, 68), margin, y);
    y += 8;
  }

  line();

  doc.setFont("helvetica", "normal");
  doc.setFontSize(7);
  doc.text("Gracias por tu compra.", width / 2, y, { align: "center" });
  y += 4;
  doc.text(
    "Conserva este comprobante para cualquier aclaración.",
    width / 2,
    y,
    { align: "center" },
  );

  return doc;
}


function makeDeviceToken() {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return [...bytes].map((b) => b.toString(16).padStart(2, "0")).join("");
}

function parseMoney(value: FormDataEntryValue | null) {
  const normalized = String(value ?? "")
    .replace(/[^0-9.-]/g, "");
  const amount = Number(normalized);
  return Number.isFinite(amount) ? amount : 0;
}

function formatMoneyInput(value: string) {
  const normalized = value.replace(/[^0-9.]/g, "");
  const amount = Number(normalized || 0);
  if (!Number.isFinite(amount)) return "";
  return new Intl.NumberFormat("es-MX", {
    style: "currency",
    currency: "MXN",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount);
}

function CurrencyInput({
  name,
  required = false,
  defaultValue,
}: {
  name: string;
  required?: boolean;
  defaultValue?: number;
}) {
  return (
    <div className="pos-money-input">
      <input
        name={name}
        type="text"
        inputMode="decimal"
        autoComplete="off"
        required={required}
        defaultValue={
          typeof defaultValue === "number"
            ? formatMoneyInput(String(defaultValue))
            : ""
        }
        placeholder="$0.00"
        onFocus={(event) => {
          const raw = event.currentTarget.value.replace(/[^0-9.]/g, "");
          event.currentTarget.value = raw;
          event.currentTarget.select();
        }}
        onInput={(event) => {
          let value = event.currentTarget.value.replace(/[^0-9.]/g, "");
          const parts = value.split(".");
          if (parts.length > 2) {
            value = `${parts.shift()}.${parts.join("")}`;
          }
          if (value.includes(".")) {
            const [whole, decimals = ""] = value.split(".");
            value = `${whole}.${decimals.slice(0, 2)}`;
          }
          event.currentTarget.value = value;
        }}
        onBlur={(event) => {
          if (!event.currentTarget.value.trim()) return;
          event.currentTarget.value = formatMoneyInput(
            event.currentTarget.value,
          );
        }}
      />
      <span className="pos-money-code">MXN</span>
    </div>
  );
}

function readableError(error: unknown) {
  if (error instanceof Error) return error.message;

  if (error && typeof error === "object") {
    const e = error as Record<string, unknown>;
    const parts = [
      e.message ? `message=${String(e.message)}` : "",
      e.code ? `code=${String(e.code)}` : "",
      e.details ? `details=${String(e.details)}` : "",
      e.hint ? `hint=${String(e.hint)}` : "",
      e.status ? `status=${String(e.status)}` : "",
    ].filter(Boolean);

    if (parts.length) return parts.join(" | ");

    try {
      return JSON.stringify(error);
    } catch {
      return String(error);
    }
  }

  return String(error);
}

export default function PosPage() {
  const supabase = useMemo(
    () =>
      createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
        {
          auth: {
            persistSession: true,
            autoRefreshToken: true,
            detectSessionInUrl: false,
            storage:
              typeof window !== "undefined"
                ? window.localStorage
                : undefined,
            storageKey: "updown-pos-auth-v1",
          },
        },
      ),
    [],
  );

  const [ready, setReady] = useState(false);
  const [deviceToken, setDeviceToken] = useState("");
  const [access, setAccess] = useState<Access | null>(null);
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);

  const [products, setProducts] = useState<Product[]>([]);
  const [productsLoading, setProductsLoading] = useState(false);
  const [productQuery, setProductQuery] = useState("");
  const [cart, setCart] = useState<CartItem[]>([]);
  const [paymentMethod, setPaymentMethod] =
    useState<ShiftPayment["method"]>("cash");
  const [paymentReference, setPaymentReference] = useState("");
  const [cashReceived, setCashReceived] = useState("");
  const [shiftSales, setShiftSales] = useState<ShiftSale[]>([]);
  const [salesLoading, setSalesLoading] = useState(false);

  const [voidingSaleId, setVoidingSaleId] = useState<string | null>(null);
  const [voidReason, setVoidReason] = useState("");
  const [lookupNumber, setLookupNumber] = useState("");
  const [lookupSale, setLookupSale] = useState<LookupSale | null>(null);
  const [lookupBusy, setLookupBusy] = useState(false);
  const [refundSearchQuery, setRefundSearchQuery] = useState("");
  const [refundSearchFrom, setRefundSearchFrom] = useState("");
  const [refundSearchTo, setRefundSearchTo] = useState("");
  const [refundSearchResults, setRefundSearchResults] = useState<RefundSearchSale[]>([]);
  const [refundSearchBusy, setRefundSearchBusy] = useState(false);
  const [refundReason, setRefundReason] = useState("");
  const [refundMethod, setRefundMethod] =
    useState<ShiftPayment["method"]>("cash");
  const [cashMovements, setCashMovements] = useState<CashMovement[]>([]);
  const [cashIn, setCashIn] = useState(0);
  const [cashOut, setCashOut] = useState(0);
  const [cashRefunds, setCashRefunds] = useState(0);
  const [expectedCashServer, setExpectedCashServer] = useState<number | null>(null);
  const [cashMovementType, setCashMovementType] =
    useState<"cash_in" | "cash_out">("cash_in");
  const [cashMovementAmount, setCashMovementAmount] = useState("");
  const [cashMovementReason, setCashMovementReason] = useState("");

  const inactivityTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const accessRevalidateTimer = useRef<ReturnType<typeof setInterval> | null>(null);
  const accessRef = useRef<Access | null>(null);
  const deviceTokenRef = useRef("");
  const revalidatingRef = useRef(false);

  async function loadProducts() {
    setProductsLoading(true);
    try {
      const { data, error } = await supabase
        .from("products")
        .select(
          "id,name,sku,barcode,brand,model,price,sale_price,stock,cover_image_url,status",
        )
        .eq("status", "active")
        .order("name", { ascending: true })
        .limit(500);

      if (error) throw error;
      setProducts((data || []) as Product[]);
    } catch (error) {
      setMessage(`PRODUCTS_ERROR: ${readableError(error)}`);
    } finally {
      setProductsLoading(false);
    }
  }

  async function loadShiftSales() {
    if (!deviceToken) return;
    setSalesLoading(true);
    try {
      const { data, error } = await supabase.rpc(
        "pos_get_current_shift_sales",
        { p_device_token: deviceToken },
      );
      if (error) throw error;
      const payload = data as {
        sales?: ShiftSale[];
        cash_movements?: CashMovement[];
        cash_in?: number | string;
        cash_out?: number | string;
        cash_refunds?: number | string;
        expected_cash?: number | string;
      } | null;

      setShiftSales(Array.isArray(payload?.sales) ? payload!.sales! : []);
      setCashMovements(
        Array.isArray(payload?.cash_movements) ? payload!.cash_movements! : [],
      );
      setCashIn(numeric(payload?.cash_in));
      setCashOut(numeric(payload?.cash_out));
      setCashRefunds(numeric(payload?.cash_refunds));
      setExpectedCashServer(
        payload?.expected_cash == null ? null : numeric(payload.expected_cash),
      );
    } catch (error) {
      setMessage(`SHIFT_SALES_ERROR: ${readableError(error)}`);
    } finally {
      setSalesLoading(false);
    }
  }

  function handleBarcodeScan(rawValue: string) {
    const code = rawValue.trim();
    if (!code) return false;

    const product = products.find(
      (item) => item.barcode?.trim() === code,
    );

    if (!product) {
      setMessage(`Código ${code} no registrado en inventario.`);
      return false;
    }

    const stock = numeric(product.stock);
    if (stock <= 0) {
      setMessage(`${product.name} está agotado.`);
      setProductQuery("");
      return false;
    }

    const currentQuantity =
      cart.find((item) => item.product.id === product.id)?.quantity ?? 0;

    if (currentQuantity >= stock) {
      setMessage(
        `${product.name}: ya tienes en el carrito todo el stock disponible (${stock}).`,
      );
      setProductQuery("");
      return false;
    }

    addToCart(product);
    setProductQuery("");
    setMessage(`✓ ${product.name} agregado por código de barras.`);
    return true;
  }

  useEffect(() => {
    let scanBuffer = "";
    let lastKeyAt = 0;
    let resetTimer: ReturnType<typeof setTimeout> | null = null;

    function resetScannerBuffer() {
      scanBuffer = "";
      lastKeyAt = 0;
      if (resetTimer) {
        clearTimeout(resetTimer);
        resetTimer = null;
      }
    }

    function handleGlobalScannerKey(event: KeyboardEvent) {
      const target = event.target as HTMLElement | null;
      const tagName = target?.tagName?.toLowerCase();
      const isEditable =
        tagName === "input" ||
        tagName === "textarea" ||
        tagName === "select" ||
        Boolean(target?.isContentEditable);

      // Cuando el cajero está escribiendo en un campo, no interferimos.
      // El lector global funciona desde cualquier zona no editable del POS.
      if (isEditable) {
        resetScannerBuffer();
        return;
      }

      const now = Date.now();

      if (event.key === "Enter") {
        if (scanBuffer.length >= 6) {
          const code = scanBuffer;
          resetScannerBuffer();
          event.preventDefault();
          handleBarcodeScan(code);
          return;
        }

        resetScannerBuffer();
        return;
      }

      if (event.key.length !== 1) return;

      // Un lector USB escribe mucho más rápido que una persona. Si hubo una
      // pausa larga, comenzamos una lectura nueva.
      if (lastKeyAt && now - lastKeyAt > 120) scanBuffer = "";

      scanBuffer += event.key;
      lastKeyAt = now;

      if (resetTimer) clearTimeout(resetTimer);
      resetTimer = setTimeout(resetScannerBuffer, 250);
    }

    document.addEventListener("keydown", handleGlobalScannerKey);
    return () => {
      document.removeEventListener("keydown", handleGlobalScannerKey);
      if (resetTimer) clearTimeout(resetTimer);
    };
  }, [products, cart]);

  function addToCart(product: Product) {
    const stock = numeric(product.stock);
    if (stock <= 0) return;

    setCart((current) => {
      const existing = current.find((item) => item.product.id === product.id);
      if (!existing) return [...current, { product, quantity: 1 }];

      return current.map((item) =>
        item.product.id === product.id
          ? {
              ...item,
              quantity: Math.min(item.quantity + 1, stock),
            }
          : item,
      );
    });
  }

  function setCartQuantity(productId: string, nextQuantity: number) {
    setCart((current) =>
      current
        .map((item) => {
          if (item.product.id !== productId) return item;
          const stock = numeric(item.product.stock);
          return {
            ...item,
            quantity: Math.max(0, Math.min(nextQuantity, stock)),
          };
        })
        .filter((item) => item.quantity > 0),
    );
  }

  function removeFromCart(productId: string) {
    setCart((current) =>
      current.filter((item) => item.product.id !== productId),
    );
  }

  async function checkoutSale() {
    if (!access?.open_shift_id || cart.length === 0) return;

    const total = cart.reduce(
      (sum, item) => sum + productPrice(item.product) * item.quantity,
      0,
    );

    if (paymentMethod === "cash") {
      const received = parseMoneyText(cashReceived);
      if (received < total) {
        setMessage(
          `Efectivo insuficiente. Total ${money(total)} · recibido ${money(received)}.`,
        );
        return;
      }
    }

    setBusy(true);
    setMessage("");

    try {
      const { data, error } = await supabase.rpc("pos_create_sale", {
        p_device_token: deviceToken,
        p_items: cart.map((item) => ({
          product_id: item.product.id,
          quantity: item.quantity,
        })),
        p_payments: [
          {
            method: paymentMethod,
            amount: Number(total.toFixed(2)),
            reference: paymentReference.trim() || null,
          },
        ],
        p_discount_amount: 0,
        p_notes: null,
      });

      if (error) throw error;

      const result = data as {
        sale_number?: number;
        total?: number | string;
      } | null;

      const change =
        paymentMethod === "cash"
          ? Math.max(0, parseMoneyText(cashReceived) - total)
          : 0;

      setCart([]);
      setCashReceived("");
      setPaymentReference("");

      // Refrescamos el turno para obtener la venta recién confirmada por Supabase.
      // No imprimimos antes de esta confirmación para evitar tickets de ventas fallidas.
      await Promise.all([loadProducts(), loadAccess(deviceToken)]);

      const { data: refreshedData, error: refreshedError } = await supabase.rpc(
        "pos_get_current_shift_sales",
        { p_device_token: deviceToken },
      );
      if (refreshedError) throw refreshedError;

      const refreshedPayload = refreshedData as {
        sales?: ShiftSale[];
        cash_movements?: CashMovement[];
        cash_in?: number | string;
        cash_out?: number | string;
        cash_refunds?: number | string;
        expected_cash?: number | string;
      } | null;

      const refreshedSales = Array.isArray(refreshedPayload?.sales)
        ? refreshedPayload!.sales!
        : [];
      setShiftSales(refreshedSales);
      setCashMovements(
        Array.isArray(refreshedPayload?.cash_movements)
          ? refreshedPayload!.cash_movements!
          : [],
      );
      setCashIn(numeric(refreshedPayload?.cash_in));
      setCashOut(numeric(refreshedPayload?.cash_out));
      setCashRefunds(numeric(refreshedPayload?.cash_refunds));
      setExpectedCashServer(
        refreshedPayload?.expected_cash == null
          ? null
          : numeric(refreshedPayload.expected_cash),
      );

      const completedSale = refreshedSales.find(
        (sale) => sale.sale_number === result?.sale_number,
      );

      let printNote = "";
      if (completedSale) {
        try {
          printReceipt(completedSale);
          printNote = " · Ticket listo para imprimir en POS-80C.";
        } catch (printError) {
          printNote = ` · Venta guardada, pero no se abrió impresión: ${readableError(printError)}`;
        }
      } else {
        printNote = " · Venta guardada; usa Ticket PDF en el historial si necesitas imprimirla.";
      }

      setMessage(
        `Venta #${result?.sale_number ?? "—"} cobrada por ${money(
          numeric(result?.total ?? total),
        )}${
          paymentMethod === "cash" && change > 0
            ? ` · Cambio ${money(change)}`
            : ""
        }.${printNote}`,
      );
    } catch (error) {
      setMessage(`SALE_ERROR: ${readableError(error)}`);
      await loadProducts();
    } finally {
      setBusy(false);
    }
  }

  function printReceipt(sale: ShiftSale) {
    const doc = buildReceiptPdf(sale, access);
    const blobUrl = doc.output("bloburl");
    const printWindow = window.open(String(blobUrl), "_blank");

    if (!printWindow) {
      URL.revokeObjectURL(String(blobUrl));
      throw new Error("El navegador bloqueó la ventana de impresión. Permite ventanas emergentes para este POS.");
    }

    // Esperamos a que el visor PDF cargue antes de invocar el diálogo de impresión.
    // En Fase A el cajón se abre mediante el driver POS-80C configurado como
    // Cash Drawer #1 After Printing.
    window.setTimeout(() => {
      try {
        printWindow.focus();
        printWindow.print();
      } catch {
        // Si el visor PDF del navegador no acepta print() automáticamente,
        // el ticket queda abierto para que el cajero use Ctrl+P.
      }
    }, 900);
  }

  function downloadReceipt(sale: ShiftSale) {
    const doc = buildReceiptPdf(sale, access);
    doc.save(receiptFileName(sale));
    setMessage(`Ticket de venta #${sale.sale_number} generado.`);
  }

  async function shareReceiptWhatsApp(sale: ShiftSale) {
    try {
      const doc = buildReceiptPdf(sale, access);
      const blob = doc.output("blob");
      const file = new File([blob], receiptFileName(sale), {
        type: "application/pdf",
      });

      const shareText =
        `UP AND DOWN · Comprobante de venta #${sale.sale_number}\n` +
        `Total: ${money(numeric(sale.total))}\n` +
        `Fecha: ${new Date(sale.created_at).toLocaleString("es-MX")}`;

      if (
        navigator.share &&
        navigator.canShare &&
        navigator.canShare({ files: [file] })
      ) {
        await navigator.share({
          title: `UP AND DOWN · Venta #${sale.sale_number}`,
          text: shareText,
          files: [file],
        });
        setMessage("Comprobante listo para compartir.");
        return;
      }

      // Fallback de escritorio: descarga el PDF y abre WhatsApp con el texto.
      // Los navegadores de escritorio no permiten adjuntar archivos
      // automáticamente a WhatsApp Web desde un enlace normal.
      doc.save(receiptFileName(sale));

      const phoneRaw = window.prompt(
        "Número de WhatsApp del cliente con lada y país (opcional). Déjalo vacío para elegir contacto en WhatsApp.",
        "",
      );
      const phone = String(phoneRaw || "").replace(/\D/g, "");
      const whatsappUrl = phone
        ? `https://wa.me/${phone}?text=${encodeURIComponent(shareText)}`
        : `https://wa.me/?text=${encodeURIComponent(shareText)}`;

      window.open(whatsappUrl, "_blank", "noopener,noreferrer");
      setMessage(
        "PDF descargado. WhatsApp se abrió con el mensaje listo; adjunta el PDF descargado.",
      );
    } catch (error) {
      if (
        error instanceof DOMException &&
        error.name === "AbortError"
      ) {
        return;
      }
      setMessage(`RECEIPT_SHARE_ERROR: ${readableError(error)}`);
    }
  }

  async function voidSale(sale: ShiftSale) {
    if (!canReverseSales) return;
    const reason = voidReason.trim();

    if (reason.length < 4) {
      setMessage("Escribe un motivo de al menos 4 caracteres.");
      return;
    }

    setBusy(true);
    setMessage("");

    try {
      const { data, error } = await supabase.rpc("pos_void_sale", {
        p_device_token: deviceToken,
        p_sale_id: sale.id,
        p_reason: reason,
      });

      if (error) throw error;

      const result = data as { sale_number?: number } | null;
      setVoidingSaleId(null);
      setVoidReason("");

      await Promise.all([loadProducts(), loadShiftSales(), loadAccess(deviceToken)]);

      setMessage(
        `Venta #${result?.sale_number ?? sale.sale_number} anulada y stock repuesto.`,
      );
    } catch (error) {
      setMessage(`VOID_ERROR: ${readableError(error)}`);
    } finally {
      setBusy(false);
    }
  }

  async function loadRefundSaleByNumber(saleNumber: number) {
    if (!canReverseSales) return;

    if (!Number.isInteger(saleNumber) || saleNumber <= 0) {
      setMessage("Ingresa un número de venta válido.");
      return;
    }

    setLookupBusy(true);
    setMessage("");
    setLookupSale(null);

    try {
      const { data, error } = await supabase.rpc("pos_lookup_sale", {
        p_device_token: deviceToken,
        p_sale_number: saleNumber,
      });

      if (error) throw error;
      setLookupNumber(String(saleNumber));
      setLookupSale(data as LookupSale);
    } catch (error) {
      setMessage(`LOOKUP_ERROR: ${readableError(error)}`);
    } finally {
      setLookupBusy(false);
    }
  }

  async function lookupSaleByNumber() {
    const saleNumber = Number(lookupNumber);
    await loadRefundSaleByNumber(saleNumber);
  }

  async function searchRefundableSales() {
    if (!canReverseSales) return;

    const query = refundSearchQuery.trim();

    if (!query && !refundSearchFrom && !refundSearchTo) {
      setMessage("Escribe un folio, producto, SKU o referencia; o selecciona un rango de fechas.");
      return;
    }

    if (refundSearchFrom && refundSearchTo && refundSearchFrom > refundSearchTo) {
      setMessage("La fecha Desde no puede ser posterior a Hasta.");
      return;
    }

    setRefundSearchBusy(true);
    setRefundSearchResults([]);
    setLookupSale(null);
    setMessage("");

    try {
      const { data, error } = await supabase.rpc("pos_search_refundable_sales", {
        p_device_token: deviceToken,
        p_query: query || null,
        p_date_from: refundSearchFrom || null,
        p_date_to: refundSearchTo || null,
        p_limit: 50,
      });

      if (error) throw error;

      const payload = data as {
        sales?: RefundSearchSale[];
        count?: number;
      } | null;

      const rows = Array.isArray(payload?.sales) ? payload!.sales! : [];
      setRefundSearchResults(rows);

      if (rows.length === 0) {
        setMessage("No encontramos ventas elegibles para devolución con esos criterios.");
      } else if (rows.length >= 50) {
        setMessage("Mostrando las primeras 50 coincidencias. Usa fechas o una búsqueda más específica para reducir resultados.");
      }
    } catch (error) {
      setMessage(`SEARCH_ERROR: ${readableError(error)}`);
    } finally {
      setRefundSearchBusy(false);
    }
  }

  function clearRefundSearch() {
    setRefundSearchQuery("");
    setRefundSearchFrom("");
    setRefundSearchTo("");
    setRefundSearchResults([]);
    setLookupSale(null);
    setLookupNumber("");
    setRefundReason("");
    setRefundMethod("cash");
    setMessage("");
  }


  async function refundSale() {
    if (!canReverseSales || !lookupSale) return;

    const reason = refundReason.trim();
    if (reason.length < 4) {
      setMessage("Escribe un motivo de devolución de al menos 4 caracteres.");
      return;
    }

    if (lookupSale.status !== "completed") {
      setMessage(`La venta está en estado ${lookupSale.status} y ya no puede devolverse.`);
      return;
    }

    setBusy(true);
    setMessage("");

    try {
      const { data, error } = await supabase.rpc("pos_refund_sale", {
        p_device_token: deviceToken,
        p_sale_id: lookupSale.id,
        p_method: refundMethod,
        p_reason: reason,
      });

      if (error) throw error;

      const result = data as {
        sale_number?: number;
        refund_number?: number;
        amount?: number | string;
      } | null;

      setLookupSale(null);
      setLookupNumber("");
      setRefundSearchResults([]);
      setRefundReason("");
      setRefundMethod("cash");

      await Promise.all([loadProducts(), loadShiftSales(), loadAccess(deviceToken)]);

      setMessage(
        `Devolución #${result?.refund_number ?? "—"} aplicada a venta #${
          result?.sale_number ?? "—"
        } por ${money(numeric(result?.amount))}. Stock repuesto.`,
      );
    } catch (error) {
      setMessage(`REFUND_ERROR: ${readableError(error)}`);
    } finally {
      setBusy(false);
    }
  }

  async function createCashMovement() {
    if (!canReverseSales) return;

    const amount = parseMoneyText(cashMovementAmount);
    const reason = cashMovementReason.trim();

    if (amount <= 0) {
      setMessage("Ingresa un monto válido.");
      return;
    }

    if (reason.length < 4) {
      setMessage("Escribe un motivo de al menos 4 caracteres.");
      return;
    }

    setBusy(true);
    setMessage("");

    try {
      const { data, error } = await supabase.rpc("pos_create_cash_movement", {
        p_device_token: deviceToken,
        p_movement_type: cashMovementType,
        p_amount: Number(amount.toFixed(2)),
        p_reason: reason,
      });

      if (error) throw error;

      const result = data as {
        movement_type?: "cash_in" | "cash_out";
        amount?: number | string;
      } | null;

      setCashMovementAmount("");
      setCashMovementReason("");

      await Promise.all([loadShiftSales(), loadAccess(deviceToken)]);

      setMessage(
        `${result?.movement_type === "cash_out" ? "Salida" : "Entrada"} de caja registrada por ${money(
          numeric(result?.amount),
        )}.`,
      );
    } catch (error) {
      setMessage(`CASH_MOVEMENT_ERROR: ${readableError(error)}`);
    } finally {
      setBusy(false);
    }
  }

  async function logout(reason = "") {
    if (inactivityTimer.current) {
      clearTimeout(inactivityTimer.current);
      inactivityTimer.current = null;
    }
    if (accessRevalidateTimer.current) {
      clearInterval(accessRevalidateTimer.current);
      accessRevalidateTimer.current = null;
    }
    accessRef.current = null;
    await supabase.auth.signOut();
    setAccess(null);
    setCart([]);
    setShiftSales([]);
    setCashMovements([]);
    setCashIn(0);
    setCashOut(0);
    setCashRefunds(0);
    setExpectedCashServer(null);
    setProducts([]);
    if (reason) setMessage(reason);
  }

  function armInactivity() {
    if (!accessRef.current) return;
    if (inactivityTimer.current) clearTimeout(inactivityTimer.current);
    inactivityTimer.current = setTimeout(() => {
      logout("Sesión cerrada por 30 minutos de inactividad.");
    }, INACTIVITY_MS);
  }

  async function loadAccess(token: string) {
    const { data, error } = await supabase.rpc("pos_get_my_access", {
      p_device_token: token,
    });
    if (error) throw error;
    const row = Array.isArray(data) ? data[0] : data;

    if (!row) {
      throw new Error("POS_ACCESS_NOT_FOUND");
    }

    if (row.employee_status !== "active") {
      throw new Error("POS_EMPLOYEE_NOT_ACTIVE");
    }

    if (!row.terminal_authorized) {
      throw new Error("TERMINAL_NOT_AUTHORIZED");
    }

    accessRef.current = row as Access;
    setAccess(row as Access);
    return row as Access;
  }

  async function revalidateAccess(reason = "periodic") {
    if (!accessRef.current || !deviceTokenRef.current || revalidatingRef.current) {
      return;
    }

    revalidatingRef.current = true;
    try {
      await loadAccess(deviceTokenRef.current);
    } catch (error) {
      const message =
        error instanceof Error ? error.message : String(error || "");

      const expectedAccessChange =
        message === "TERMINAL_NOT_AUTHORIZED" ||
        message === "POS_EMPLOYEE_NOT_ACTIVE" ||
        message === "POS_ACCESS_NOT_FOUND";

      if (!expectedAccessChange) {
        console.warn("POS access revalidation", reason, error);
      }

      await logout(
        message === "TERMINAL_NOT_AUTHORIZED"
          ? "Esta terminal dejó de estar autorizada. Inicia sesión nuevamente desde una terminal válida."
          : "Tu acceso al POS cambió o fue suspendido. Inicia sesión nuevamente.",
      );
    } finally {
      revalidatingRef.current = false;
    }
  }

  useEffect(() => {
    let token = localStorage.getItem(DEVICE_KEY) || "";
    if (!token) {
      token = makeDeviceToken();
      localStorage.setItem(DEVICE_KEY, token);
    }

    deviceTokenRef.current = token;
    setDeviceToken(token);

    (async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (user) {
        try {
          await loadAccess(token);
          armInactivity();
        } catch (error) {
          await supabase.auth.signOut();
          accessRef.current = null;
          setAccess(null);
          setMessage(`POS_ACCESS_ERROR: ${readableError(error)}`);
        }
      }

      setReady(true);
    })();

    const activityEvents = ["pointerdown", "keydown", "touchstart", "wheel"];
    const resetActivity = () => {
      if (accessRef.current) armInactivity();
    };

    const onFocus = () => {
      if (accessRef.current) void revalidateAccess("window_focus");
    };

    const onVisibility = () => {
      if (document.visibilityState === "visible" && accessRef.current) {
        void revalidateAccess("visibility");
      }
    };

    activityEvents.forEach((name) =>
      window.addEventListener(name, resetActivity, { passive: true }),
    );
    window.addEventListener("focus", onFocus);
    document.addEventListener("visibilitychange", onVisibility);

    return () => {
      activityEvents.forEach((name) =>
        window.removeEventListener(name, resetActivity),
      );
      window.removeEventListener("focus", onFocus);
      document.removeEventListener("visibilitychange", onVisibility);

      if (inactivityTimer.current) clearTimeout(inactivityTimer.current);
      if (accessRevalidateTimer.current) clearInterval(accessRevalidateTimer.current);
    };
  }, []);

  useEffect(() => {
    accessRef.current = access;

    if (!access || !deviceToken) {
      if (accessRevalidateTimer.current) {
        clearInterval(accessRevalidateTimer.current);
        accessRevalidateTimer.current = null;
      }
      return;
    }

    if (accessRevalidateTimer.current) {
      clearInterval(accessRevalidateTimer.current);
    }

    accessRevalidateTimer.current = setInterval(() => {
      void revalidateAccess("interval");
    }, ACCESS_REVALIDATE_MS);

    return () => {
      if (accessRevalidateTimer.current) {
        clearInterval(accessRevalidateTimer.current);
        accessRevalidateTimer.current = null;
      }
    };
  }, [access?.employee_id, access?.employee_status, access?.terminal_id, deviceToken]);

  useEffect(() => {
    if (!access?.open_shift_id) {
      setCart([]);
      setShiftSales([]);
      return;
    }

    loadProducts();
    loadShiftSales();
  }, [access?.open_shift_id]);

  async function activateTerminal(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formElement = event.currentTarget;
    setBusy(true);
    setMessage("");
    const form = new FormData(formElement);
    const code = String(form.get("code") || "").trim().toUpperCase();
    try {
      const { error } = await supabase.rpc("pos_activate_terminal", {
        p_activation_code: code,
        p_device_token: deviceToken,
      });
      if (error) throw error;
      setMessage("Terminal activada. Ya puedes iniciar sesión.");
      formElement.reset();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "No se pudo activar la terminal.");
    } finally {
      setBusy(false);
    }
  }

  async function login(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setMessage("");

    const form = new FormData(event.currentTarget);
    const loginCode = String(form.get("employee") || "")
      .trim()
      .toUpperCase()
      .replace(/\s+/g, "")
      .replace(/[^A-Z0-9_-]/g, "")
      .slice(0, 30);
    const password = String(form.get("password") || "");

    try {
      const response = await fetch("/api/pos/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          login_code: loginCode,
          password,
        }),
      });

      const raw = await response.text();
      let body: any = {};
      try {
        body = raw ? JSON.parse(raw) : {};
      } catch {
        body = {};
      }

      if (!response.ok) {
        const detail =
          body.error ||
          body.message ||
          (raw ? raw.slice(0, 220) : "respuesta vacía");
        throw new Error(`POS_LOGIN_HTTP_${response.status}: ${detail}`);
      }

      if (!body.access_token || !body.refresh_token) {
        throw new Error(
          `POS_LOGIN_BAD_RESPONSE_${response.status}: ${
            raw ? raw.slice(0, 220) : "respuesta vacía"
          }`,
        );
      }

      const { error: sessionError } = await supabase.auth.setSession({
        access_token: body.access_token,
        refresh_token: body.refresh_token,
      });

      if (sessionError) throw sessionError;

      await loadAccess(deviceToken);
      armInactivity();
    } catch (error) {
      await supabase.auth.signOut();
      setMessage(`POS_LOGIN_CLIENT_ERROR: ${readableError(error)}`);
    } finally {
      setBusy(false);
    }
  }

  async function openShift(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setMessage("");
    const form = new FormData(event.currentTarget);
    const pin = String(form.get("pin") || "");
    const opening = parseMoney(form.get("opening"));
    try {
      const { error } = await supabase.rpc("pos_open_shift", {
        p_device_token: deviceToken,
        p_pin: pin,
        p_opening_cash: opening,
      });
      if (error) throw error;
      await loadAccess(deviceToken);
      setMessage("Turno abierto correctamente.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "No se pudo abrir el turno.");
    } finally {
      setBusy(false);
    }
  }

  async function closeShift(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setMessage("");
    const form = new FormData(event.currentTarget);
    const closing = parseMoney(form.get("closing"));
    const notes = String(form.get("notes") || "");
    try {
      const { data, error } = await supabase.rpc("pos_close_shift", {
        p_device_token: deviceToken,
        p_closing_cash: closing,
        p_notes: notes,
      });
      if (error) throw error;

      const result = data as {
        expected_cash?: number | string;
        closing_cash?: number | string;
        difference?: number | string;
      } | null;

      setCart([]);
      setShiftSales([]);
      await loadAccess(deviceToken);

      setMessage(
        `Turno cerrado · esperado ${money(
          numeric(result?.expected_cash),
        )} · contado ${money(
          numeric(result?.closing_cash),
        )} · diferencia ${money(numeric(result?.difference))}.`,
      );
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "No se pudo cerrar el turno.");
    } finally {
      setBusy(false);
    }
  }

  const filteredProducts = products.filter((product) => {
    const query = productQuery.trim().toLowerCase();
    if (!query) return true;
    return [
      product.name,
      product.sku,
      product.barcode,
      product.brand,
      product.model,
    ]
      .filter(Boolean)
      .some((value) => String(value).toLowerCase().includes(query));
  });

  const cartSubtotal = cart.reduce(
    (sum, item) => sum + productPrice(item.product) * item.quantity,
    0,
  );

  const cashSales = shiftSales.reduce(
    (sum, sale) =>
      sale.status === "completed"
        ? sum +
          (sale.payments || [])
            .filter((payment) => payment.method === "cash")
            .reduce((paymentSum, payment) => paymentSum + numeric(payment.amount), 0)
        : sum,
    0,
  );

  const expectedCash =
    expectedCashServer ??
    (numeric(access?.opening_cash) + cashSales + cashIn - cashOut - cashRefunds);
  const cashReceivedAmount = parseMoneyText(cashReceived);
  const cashChange =
    paymentMethod === "cash"
      ? Math.max(0, cashReceivedAmount - cartSubtotal)
      : 0;

  const canReverseSales =
    access?.employee_role === "supervisor" ||
    access?.employee_role === "pos_admin";

  const roleLabel =
    access?.employee_role === "cashier"
      ? "Cajero"
      : access?.employee_role === "supervisor"
        ? "Supervisor"
        : access?.employee_role === "pos_admin"
          ? "Administrador POS"
          : access?.employee_role || "—";

  if (!ready) {
    return <main className="pos-shell"><section className="pos-card">Cargando POS…</section></main>;
  }

  return (
    <main className="pos-shell">
      <style jsx global>{`
        html,body{margin:0;background:#f5f2ec;color:#17201d;font-family:Inter,Arial,sans-serif}
        *{box-sizing:border-box}
        .pos-shell{min-height:100vh;padding:22px;display:grid;place-items:start center;background:linear-gradient(180deg,#143e35 0 230px,#f5f2ec 230px)}
        .pos-wrap{width:min(1180px,100%)}
        .pos-brand{color:white;padding:18px 4px 28px}
        .pos-brand strong{display:block;font-family:"Cormorant Garamond",serif;font-size:38px;line-height:.9;letter-spacing:.04em}
        .pos-brand span{display:block;margin-top:8px;font-size:10px;font-weight:800;letter-spacing:.16em;opacity:.72}
        .pos-card{width:100%;padding:24px;border:1px solid rgba(20,62,53,.12);border-radius:24px;background:#fff;box-shadow:0 18px 55px rgba(20,62,53,.12)}
        .pos-grid{display:grid;grid-template-columns:1fr 1fr;gap:16px}
        .pos-card h1,.pos-card h2{margin:0;color:#143e35;font-family:"Cormorant Garamond",serif}
        .pos-card h1{font-size:50px;line-height:.9}.pos-card h2{font-size:34px}
        .pos-muted{color:#68736f;font-size:13px;line-height:1.6}
        .pos-form{display:grid;gap:12px;margin-top:20px}
        .pos-field{display:grid;gap:6px}
        .pos-field label{font-size:10px;font-weight:800;color:#2f6f5b;text-transform:uppercase;letter-spacing:.08em}
        .pos-field input,.pos-field textarea{width:100%;min-height:50px;padding:12px 14px;border:1px solid rgba(20,62,53,.16);border-radius:13px;background:#fff;font-size:16px}
        .pos-btn{min-height:50px;padding:12px 18px;border:0;border-radius:999px;background:#143e35;color:#fff;font-weight:800;cursor:pointer}
        .pos-btn.secondary{background:#fff;color:#143e35;border:1px solid rgba(20,62,53,.16)}
        .pos-btn:disabled{opacity:.5;cursor:not-allowed}
        .pos-message{margin-top:14px;padding:12px;border-radius:12px;background:#f3efe7;color:#143e35;font-size:12px;line-height:1.5}
        .pos-kicker{font-size:10px;color:#2f6f5b;font-weight:800;letter-spacing:.15em;text-transform:uppercase}
        .pos-stats{display:grid;grid-template-columns:repeat(3,1fr);gap:10px;margin:18px 0}
        .pos-stat{padding:14px;border-radius:14px;background:#f8f6f2}
        .pos-stat span{display:block;font-size:9px;color:#68736f;text-transform:uppercase;font-weight:800}
        .pos-stat strong{display:block;margin-top:5px;color:#143e35;font-size:15px}
        .pos-ready{padding:18px;border-radius:18px;background:#143e35;color:white;margin:18px 0}
        .pos-ready strong{display:block;font-size:18px}.pos-ready span{display:block;margin-top:5px;font-size:11px;opacity:.75}
        .pos-note{margin-top:16px;padding:13px;border-left:3px solid #c8a86b;background:#f7f2e8;border-radius:0 12px 12px 0;color:#143e35;font-size:11px;line-height:1.6}
        .pos-sales-layout{display:grid;grid-template-columns:minmax(0,1.45fr) minmax(320px,.75fr);gap:16px;margin-top:16px}
        .pos-panel{border:1px solid rgba(20,62,53,.12);border-radius:20px;background:#fff;overflow:hidden}
        .pos-panel-head{padding:16px 18px;border-bottom:1px solid rgba(20,62,53,.1);display:flex;align-items:center;justify-content:space-between;gap:12px}
        .pos-panel-head h3{margin:0;font-size:18px;color:#143e35}
        .pos-search{width:100%;min-height:44px;padding:10px 13px;border:1px solid rgba(20,62,53,.16);border-radius:12px;background:#fff;font-size:15px}
        .pos-products{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:10px;padding:12px;max-height:600px;overflow:auto}
        .pos-product{display:grid;grid-template-columns:72px minmax(0,1fr);gap:12px;padding:10px;border:1px solid rgba(20,62,53,.11);border-radius:15px;background:#fbfaf7}
        .pos-product-media{width:72px;height:72px;border-radius:12px;background:#eeeae1;overflow:hidden;display:grid;place-items:center;color:#8a938f;font-size:10px;font-weight:800}
        .pos-product-media img{width:100%;height:100%;object-fit:cover}
        .pos-product-main{min-width:0}
        .pos-product-main strong{display:block;color:#143e35;font-size:14px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
        .pos-product-meta{margin-top:3px;color:#72807b;font-size:10px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
        .pos-product-row{display:flex;align-items:end;justify-content:space-between;gap:8px;margin-top:10px}
        .pos-product-price{font-size:15px;font-weight:900;color:#143e35}
        .pos-stock{font-size:10px;font-weight:800;color:#2f6f5b}.pos-stock.zero{color:#a45c55}
        .pos-add{min-width:34px;height:34px;border:0;border-radius:999px;background:#143e35;color:white;font-size:18px;cursor:pointer}.pos-add:disabled{opacity:.35;cursor:not-allowed}
        .pos-cart{padding:14px;display:grid;gap:10px}
        .pos-cart-empty{padding:28px 14px;text-align:center;color:#7a8581;font-size:12px}
        .pos-cart-item{padding:12px;border:1px solid rgba(20,62,53,.1);border-radius:14px}
        .pos-cart-top{display:flex;justify-content:space-between;gap:10px}
        .pos-cart-top strong{font-size:13px;color:#143e35}
        .pos-cart-top button{border:0;background:transparent;color:#9a534f;cursor:pointer;font-weight:800}
        .pos-qty{display:flex;align-items:center;justify-content:space-between;gap:8px;margin-top:10px}
        .pos-qty-controls{display:flex;align-items:center;gap:8px}
        .pos-qty-controls button{width:30px;height:30px;border-radius:999px;border:1px solid rgba(20,62,53,.16);background:#fff;color:#143e35;font-weight:900;cursor:pointer}
        .pos-qty-controls span{min-width:24px;text-align:center;font-weight:900}
        .pos-line-total{font-weight:900;color:#143e35}
        .pos-checkout{padding:14px;border-top:1px solid rgba(20,62,53,.1);display:grid;gap:12px}
        .pos-total-row{display:flex;justify-content:space-between;align-items:end;gap:12px}
        .pos-total-row span{font-size:11px;color:#68736f;text-transform:uppercase;font-weight:800}
        .pos-total-row strong{font-size:28px;color:#143e35}
        .pos-payment-tabs{display:grid;grid-template-columns:repeat(2,1fr);gap:8px}
        .pos-payment-tabs button{min-height:42px;padding:8px;border:1px solid rgba(20,62,53,.16);border-radius:12px;background:#fff;color:#143e35;font-weight:800;cursor:pointer}
        .pos-payment-tabs button.active{background:#143e35;color:#fff;border-color:#143e35}
        .pos-change{padding:10px 12px;border-radius:12px;background:#edf6f1;color:#143e35;font-size:12px;font-weight:800;display:flex;justify-content:space-between}
        .pos-shift-summary{display:grid;grid-template-columns:repeat(3,1fr);gap:10px;margin-top:14px}
        .pos-history{margin-top:16px;border-top:1px solid rgba(20,62,53,.1);padding-top:16px}
        .pos-history-list{display:grid;gap:8px;margin-top:10px}
        .pos-history-sale{padding:11px 12px;border:1px solid rgba(20,62,53,.1);border-radius:12px;display:grid;grid-template-columns:1fr auto;gap:6px}
        .pos-history-sale strong{color:#143e35}.pos-history-sale small{color:#75807c}
        .pos-sale-actions{grid-column:1/-1;display:flex;gap:8px;align-items:center;flex-wrap:wrap;margin-top:4px}
        .pos-receipt-actions{grid-column:1/-1;display:flex;gap:8px;align-items:center;flex-wrap:wrap;margin-top:7px}
        .pos-receipt-btn{border:1px solid rgba(20,62,53,.16);background:#fff;color:#143e35;border-radius:10px;padding:8px 10px;font-weight:800;cursor:pointer}
        .pos-receipt-btn.primary{background:#143e35;color:#fff;border-color:#143e35}
        .pos-link-danger{border:0;background:#fff0ee;color:#9a3d36;border-radius:10px;padding:8px 10px;font-weight:800;cursor:pointer}
        .pos-inline-reverse{grid-column:1/-1;display:grid;grid-template-columns:minmax(0,1fr) auto;gap:8px;margin-top:8px}
        .pos-inline-reverse input{min-height:40px;border:1px solid rgba(20,62,53,.16);border-radius:10px;padding:9px 11px}
        .pos-supervisor{margin-top:18px;padding:16px;border:1px solid rgba(156,74,57,.18);border-radius:18px;background:#fffaf7}
        .pos-supervisor h3{margin:0;color:#143e35}
        .pos-cash-tools{margin-top:18px;padding:16px;border:1px solid rgba(20,62,53,.14);border-radius:18px;background:#f8fbf9}
        .pos-cash-tools-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:10px;margin-top:12px}
        .pos-cash-movement-list{display:grid;gap:8px;margin-top:12px}
        .pos-cash-movement{display:grid;grid-template-columns:1fr auto;gap:8px;padding:11px 12px;border:1px solid rgba(20,62,53,.1);border-radius:12px;background:#fff}
        .pos-cash-movement.cash_in strong{color:#23634f}
        .pos-cash-movement.cash_out strong{color:#9a3d36}
        .pos-cash-summary{display:grid;grid-template-columns:repeat(3,1fr);gap:8px;margin-top:12px}
        .pos-supervisor-grid{display:grid;grid-template-columns:1fr auto;gap:10px;margin-top:12px}
        .pos-supervisor-grid input,.pos-supervisor select,.pos-supervisor textarea{width:100%;border:1px solid rgba(20,62,53,.16);border-radius:11px;padding:10px 12px;background:#fff}
        .pos-refund-search{display:grid;grid-template-columns:minmax(220px,1.6fr) minmax(135px,.7fr) minmax(135px,.7fr) auto auto;gap:8px;align-items:end;margin-top:12px}
        .pos-refund-search-field{display:grid;gap:5px}
        .pos-refund-search-field label{font-size:10px;font-weight:800;color:#5e6b66;text-transform:uppercase;letter-spacing:.04em}
        .pos-refund-search-results{display:grid;gap:8px;margin-top:12px}
        .pos-refund-result{border:1px solid rgba(20,62,53,.12);border-radius:12px;padding:11px 12px;background:#fff;display:grid;grid-template-columns:minmax(0,1fr) auto;gap:8px;align-items:start}
        .pos-refund-result-main{min-width:0}
        .pos-refund-result-head{display:flex;gap:8px;align-items:center;flex-wrap:wrap}
        .pos-refund-result-meta{margin-top:4px;color:#75807c;font-size:11px;line-height:1.45}
        .pos-refund-result-products{margin-top:6px;color:#43524d;font-size:11px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
        .pos-refund-result-actions{display:grid;justify-items:end;gap:6px}
        .pos-refund-result-actions strong{color:#143e35}
        @media(max-width:760px){
          .pos-refund-search{grid-template-columns:1fr 1fr}
          .pos-refund-search .pos-search-query{grid-column:1/-1}
          .pos-refund-search button{min-height:44px}
          .pos-refund-result{grid-template-columns:1fr}
          .pos-refund-result-actions{display:flex;justify-content:space-between;align-items:center}
        }
        .pos-lookup-card{margin-top:14px;padding:14px;border:1px solid rgba(20,62,53,.12);border-radius:14px;background:white}
        .pos-status-pill{display:inline-flex;margin-top:6px;padding:4px 8px;border-radius:999px;font-size:10px;font-weight:900;text-transform:uppercase;background:#edf1ef;color:#42524c}
        .pos-status-pill.completed{background:#e9f5ef;color:#23634f}
        .pos-status-pill.voided,.pos-status-pill.refunded{background:#f8ebe8;color:#91493f}
        .pos-refund-items{margin-top:10px;display:grid;gap:6px}
        .pos-refund-item{display:flex;justify-content:space-between;gap:12px;font-size:12px;color:#43524d}
        .pos-money-input{position:relative;display:flex;align-items:center}
        .pos-money-input input{width:100%;padding-right:72px;font-variant-numeric:tabular-nums}
        .pos-money-code{position:absolute;right:18px;font-size:12px;font-weight:800;letter-spacing:.08em;color:#48635b;pointer-events:none}
        @media(max-width:900px){.pos-sales-layout{grid-template-columns:1fr}.pos-products{max-height:none}}
        @media(max-width:680px){.pos-cash-tools-grid,.pos-cash-summary{grid-template-columns:1fr}.pos-shell{padding:12px}.pos-grid{grid-template-columns:1fr}.pos-stats,.pos-shift-summary{grid-template-columns:1fr}.pos-card{padding:20px}.pos-card h1{font-size:42px}.pos-products{grid-template-columns:1fr}.pos-payment-tabs{grid-template-columns:1fr 1fr}}
      `}</style>

      <div className="pos-wrap">
        <header className="pos-brand">
          <strong>UP AND DOWN</strong>
          <span>PUNTO DE VENTA · LOS CABOS</span>
        </header>

        {!access ? (
          <div className="pos-grid">
            <section className="pos-card">
              <div className="pos-kicker">Acceso de empleados y vendedores</div>
              <h1>Entrar al POS</h1>
              <p className="pos-muted">Usa tu número de empleado o código de vendedor y tu contraseña. El acceso solo funciona en una terminal previamente autorizada.</p>
              <form className="pos-form" onSubmit={login}>
                <div className="pos-field"><label>Empleado o vendedor</label><input name="employee" inputMode="text" autoCapitalize="characters" autoComplete="off" maxLength={30} placeholder="Ej. 0024 o VENDED001" required /></div>
                <div className="pos-field"><label>Contraseña</label><input name="password" type="password" autoComplete="current-password" required /></div>
                <button className="pos-btn" disabled={busy}>Entrar</button>
              </form>
            </section>

            <section className="pos-card">
              <div className="pos-kicker">Configuración de terminal</div>
              <h2>Activar este equipo</h2>
              <p className="pos-muted">Solo se hace una vez. Un administrador debe generar el código desde Admin → POS / Caja.</p>
              <form className="pos-form" onSubmit={activateTerminal}>
                <div className="pos-field"><label>Código de activación</label><input name="code" autoCapitalize="characters" maxLength={12} required /></div>
                <button className="pos-btn secondary" disabled={busy}>Activar terminal</button>
              </form>
              <div className="pos-note">Aunque alguien conozca una contraseña de empleado, no podrá abrir caja desde otro dispositivo sin una terminal autorizada y el PIN vigente del turno.</div>
            </section>
          </div>
        ) : (
          <section className="pos-card">
            <div className="pos-kicker">Sesión de empleado</div>
            <h1>Hola, {access.full_name}</h1>
            <div className="pos-stats">
              <div className="pos-stat"><span>Empleado</span><strong>#{access.employee_number}</strong></div>
              <div className="pos-stat"><span>Terminal</span><strong>{access.terminal_name}</strong></div>
              <div className="pos-stat"><span>Rol</span><strong>{roleLabel}</strong></div>
            </div>

            {access.open_shift_id ? (
              <>
                <div className="pos-ready">
                  <strong>Turno abierto · POS habilitado</strong>
                  <span>
                    Inicio: {access.open_shift_started_at
                      ? new Date(access.open_shift_started_at).toLocaleString("es-MX")
                      : "—"}{" "}
                    · Fondo: {money(numeric(access.opening_cash))}
                  </span>
                </div>

                <div className="pos-shift-summary">
                  <div className="pos-stat">
                    <span>Ventas del turno</span>
                    <strong>{shiftSales.filter((sale) => sale.status === "completed").length}</strong>
                  </div>
                  <div className="pos-stat">
                    <span>Ventas en efectivo</span>
                    <strong>{money(cashSales)}</strong>
                  </div>
                  <div className="pos-stat">
                    <span>Efectivo esperado</span>
                    <strong>{money(expectedCash)}</strong>
                  </div>
                </div>

                <div className="pos-sales-layout">
                  <section className="pos-panel">
                    <div className="pos-panel-head">
                      <div>
                        <div className="pos-kicker">Catálogo</div>
                        <h3>Agregar productos</h3>
                      </div>
                      <small>{productsLoading ? "Actualizando…" : `${products.length} productos`}</small>
                    </div>

                    <div style={{ padding: "12px 12px 0" }}>
                      <input
                        className="pos-search"
                        value={productQuery}
                        onChange={(event) => setProductQuery(event.target.value)}
                        onKeyDown={(event) => {
                          if (event.key !== "Enter") return;

                          const code = event.currentTarget.value.trim();
                          const barcodeMatch = products.some(
                            (product) => product.barcode?.trim() === code,
                          );

                          if (!barcodeMatch) return;

                          event.preventDefault();
                          handleBarcodeScan(code);
                        }}
                        placeholder="Escanea código o busca producto, SKU, marca o modelo…"
                        autoComplete="off"
                        autoFocus
                      />
                    </div>

                    <div className="pos-products">
                      {filteredProducts.map((product) => {
                        const stock = numeric(product.stock);
                        return (
                          <article className="pos-product" key={product.id}>
                            <div className="pos-product-media">
                              {product.cover_image_url ? (
                                <img src={product.cover_image_url} alt="" />
                              ) : (
                                "SIN FOTO"
                              )}
                            </div>
                            <div className="pos-product-main">
                              <strong>{product.name}</strong>
                              <div className="pos-product-meta">
                                {[product.brand, product.model, product.sku]
                                  .filter(Boolean)
                                  .join(" · ") || "Producto"}
                              </div>
                              <div className="pos-product-row">
                                <div>
                                  <div className="pos-product-price">
                                    {money(productPrice(product))}
                                  </div>
                                  <div className={`pos-stock ${stock <= 0 ? "zero" : ""}`}>
                                    {stock > 0 ? `Stock: ${stock}` : "Agotado"}
                                  </div>
                                </div>
                                <button
                                  className="pos-add"
                                  type="button"
                                  disabled={busy || stock <= 0}
                                  onClick={() => addToCart(product)}
                                  aria-label={`Agregar ${product.name}`}
                                >
                                  +
                                </button>
                              </div>
                            </div>
                          </article>
                        );
                      })}

                      {!productsLoading && filteredProducts.length === 0 && (
                        <div className="pos-cart-empty">
                          No encontramos productos con esa búsqueda.
                        </div>
                      )}
                    </div>
                  </section>

                  <aside className="pos-panel">
                    <div className="pos-panel-head">
                      <div>
                        <div className="pos-kicker">Venta actual</div>
                        <h3>Carrito</h3>
                      </div>
                      <small>
                        {cart.reduce((sum, item) => sum + item.quantity, 0)} piezas
                      </small>
                    </div>

                    {cart.length === 0 ? (
                      <div className="pos-cart-empty">
                        Agrega productos del catálogo para comenzar una venta.
                      </div>
                    ) : (
                      <div className="pos-cart">
                        {cart.map((item) => (
                          <div className="pos-cart-item" key={item.product.id}>
                            <div className="pos-cart-top">
                              <strong>{item.product.name}</strong>
                              <button
                                type="button"
                                onClick={() => removeFromCart(item.product.id)}
                              >
                                Quitar
                              </button>
                            </div>
                            <div className="pos-qty">
                              <div className="pos-qty-controls">
                                <button
                                  type="button"
                                  onClick={() =>
                                    setCartQuantity(
                                      item.product.id,
                                      item.quantity - 1,
                                    )
                                  }
                                >
                                  −
                                </button>
                                <span>{item.quantity}</span>
                                <button
                                  type="button"
                                  disabled={
                                    item.quantity >= numeric(item.product.stock)
                                  }
                                  onClick={() =>
                                    setCartQuantity(
                                      item.product.id,
                                      item.quantity + 1,
                                    )
                                  }
                                >
                                  +
                                </button>
                              </div>
                              <div className="pos-line-total">
                                {money(
                                  productPrice(item.product) * item.quantity,
                                )}
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}

                    <div className="pos-checkout">
                      <div className="pos-total-row">
                        <span>Total</span>
                        <strong>{money(cartSubtotal)}</strong>
                      </div>

                      <div className="pos-payment-tabs">
                        {(
                          [
                            ["cash", "Efectivo"],
                            ["card_terminal", "Terminal"],
                            ["transfer", "Transferencia"],
                            ["other", "Otro"],
                          ] as const
                        ).map(([method, label]) => (
                          <button
                            key={method}
                            className={paymentMethod === method ? "active" : ""}
                            type="button"
                            onClick={() => setPaymentMethod(method)}
                          >
                            {label}
                          </button>
                        ))}
                      </div>

                      {paymentMethod === "cash" ? (
                        <>
                          <div className="pos-field">
                            <label>Efectivo recibido</label>
                            <input
                              type="text"
                              inputMode="decimal"
                              value={cashReceived}
                              placeholder="$0.00"
                              onChange={(event) =>
                                setCashReceived(
                                  event.target.value.replace(/[^0-9.]/g, ""),
                                )
                              }
                              onBlur={(event) => {
                                if (!event.currentTarget.value) return;
                                setCashReceived(
                                  formatMoneyInput(event.currentTarget.value),
                                );
                              }}
                              onFocus={(event) => {
                                const raw = event.currentTarget.value.replace(
                                  /[^0-9.]/g,
                                  "",
                                );
                                setCashReceived(raw);
                              }}
                            />
                          </div>
                          <div className="pos-change">
                            <span>Cambio</span>
                            <strong>{money(cashChange)}</strong>
                          </div>
                        </>
                      ) : (
                        <div className="pos-field">
                          <label>Referencia / últimos dígitos (opcional)</label>
                          <input
                            value={paymentReference}
                            onChange={(event) =>
                              setPaymentReference(event.target.value)
                            }
                            placeholder="Referencia de pago"
                          />
                        </div>
                      )}

                      <button
                        className="pos-btn"
                        type="button"
                        disabled={
                          busy ||
                          cart.length === 0 ||
                          cartSubtotal <= 0 ||
                          (paymentMethod === "cash" &&
                            cashReceivedAmount < cartSubtotal)
                        }
                        onClick={checkoutSale}
                      >
                        {busy
                          ? "Procesando…"
                          : `COBRAR ${money(cartSubtotal)}`}
                      </button>
                    </div>
                  </aside>
                </div>

                <div className="pos-history">
                  <div className="pos-panel-head" style={{ padding: 0, border: 0 }}>
                    <div>
                      <div className="pos-kicker">Actividad</div>
                      <h3 style={{ margin: "2px 0 0", color: "#143e35" }}>
                        Ventas del turno
                      </h3>
                    </div>
                    <small>{salesLoading ? "Actualizando…" : `${shiftSales.length} ventas`}</small>
                  </div>

                  <div className="pos-history-list">
                    {shiftSales.slice(0, 8).map((sale) => (
                      <div className="pos-history-sale" key={sale.id}>
                        <div>
                          <strong>Venta #{sale.sale_number}</strong>
                          <small style={{ display: "block", marginTop: 3 }}>
                            {new Date(sale.created_at).toLocaleString("es-MX")} ·{" "}
                            {(sale.payments || [])
                              .map((payment) => paymentLabel(payment.method))
                              .join(" + ") || "Sin pago"}
                          </small>
                          <span className={`pos-status-pill ${sale.status}`}>
                            {sale.status}
                          </span>
                        </div>
                        <strong>{money(numeric(sale.total))}</strong>

                        <div className="pos-receipt-actions">
                          <button
                            type="button"
                            className="pos-receipt-btn"
                            onClick={() => downloadReceipt(sale)}
                          >
                            Ticket PDF
                          </button>
                          <button
                            type="button"
                            className="pos-receipt-btn primary"
                            onClick={() => shareReceiptWhatsApp(sale)}
                          >
                            WhatsApp
                          </button>
                        </div>

                        {canReverseSales &&
                          sale.status === "completed" &&
                          (voidingSaleId === sale.id ? (
                            <div className="pos-inline-reverse">
                              <input
                                value={voidReason}
                                onChange={(event) => setVoidReason(event.target.value)}
                                placeholder="Motivo de anulación"
                                autoFocus
                              />
                              <div style={{ display: "flex", gap: 6 }}>
                                <button
                                  type="button"
                                  className="pos-link-danger"
                                  disabled={busy}
                                  onClick={() => voidSale(sale)}
                                >
                                  Confirmar anulación
                                </button>
                                <button
                                  type="button"
                                  onClick={() => {
                                    setVoidingSaleId(null);
                                    setVoidReason("");
                                  }}
                                >
                                  Cancelar
                                </button>
                              </div>
                            </div>
                          ) : (
                            <div className="pos-sale-actions">
                              <button
                                type="button"
                                className="pos-link-danger"
                                onClick={() => {
                                  setVoidingSaleId(sale.id);
                                  setVoidReason("");
                                }}
                              >
                                Anular venta
                              </button>
                            </div>
                          ))}
                      </div>
                    ))}

                    {!salesLoading && shiftSales.length === 0 && (
                      <div className="pos-cart-empty">
                        Todavía no hay ventas en este turno.
                      </div>
                    )}
                  </div>
                </div>

                {canReverseSales && (
                  <section className="pos-cash-tools">
                    <div className="pos-kicker">Caja</div>
                    <h3 style={{ margin: 0, color: "#143e35" }}>
                      Movimientos de efectivo
                    </h3>
                    <p className="pos-muted">
                      Registra entradas o salidas manuales para que el efectivo esperado
                      del turno permanezca correcto.
                    </p>

                    <div className="pos-cash-summary">
                      <div className="pos-stat">
                        <span>Entradas</span>
                        <strong>{money(cashIn)}</strong>
                      </div>
                      <div className="pos-stat">
                        <span>Salidas</span>
                        <strong>{money(cashOut)}</strong>
                      </div>
                      <div className="pos-stat">
                        <span>Devoluciones efectivo</span>
                        <strong>{money(cashRefunds)}</strong>
                      </div>
                    </div>

                    <div className="pos-cash-tools-grid">
                      <div className="pos-field">
                        <label>Tipo</label>
                        <select
                          value={cashMovementType}
                          onChange={(event) =>
                            setCashMovementType(
                              event.target.value as "cash_in" | "cash_out",
                            )
                          }
                        >
                          <option value="cash_in">Entrada de efectivo</option>
                          <option value="cash_out">Salida de efectivo</option>
                        </select>
                      </div>

                      <div className="pos-field">
                        <label>Monto</label>
                        <input
                          type="text"
                          inputMode="decimal"
                          value={cashMovementAmount}
                          placeholder="$0.00"
                          onChange={(event) =>
                            setCashMovementAmount(
                              event.target.value.replace(/[^0-9.]/g, ""),
                            )
                          }
                          onBlur={(event) => {
                            if (!event.currentTarget.value) return;
                            setCashMovementAmount(
                              formatMoneyInput(event.currentTarget.value),
                            );
                          }}
                          onFocus={(event) => {
                            const raw = event.currentTarget.value.replace(
                              /[^0-9.]/g,
                              "",
                            );
                            setCashMovementAmount(raw);
                          }}
                        />
                      </div>
                    </div>

                    <div className="pos-field" style={{ marginTop: 10 }}>
                      <label>Motivo</label>
                      <input
                        value={cashMovementReason}
                        onChange={(event) =>
                          setCashMovementReason(event.target.value)
                        }
                        placeholder="Ej. retiro de efectivo, cambio adicional…"
                      />
                    </div>

                    <button
                      className="pos-btn"
                      type="button"
                      disabled={
                        busy ||
                        parseMoneyText(cashMovementAmount) <= 0 ||
                        cashMovementReason.trim().length < 4
                      }
                      onClick={createCashMovement}
                    >
                      Registrar movimiento
                    </button>

                    <div className="pos-cash-movement-list">
                      {cashMovements.slice(0, 8).map((movement) => (
                        <div
                          className={`pos-cash-movement ${movement.movement_type}`}
                          key={movement.id}
                        >
                          <div>
                            <strong>
                              {movement.movement_type === "cash_in"
                                ? "Entrada"
                                : "Salida"}
                            </strong>
                            <small style={{ display: "block", marginTop: 3 }}>
                              {movement.reason} ·{" "}
                              {new Date(movement.created_at).toLocaleString("es-MX")}
                            </small>
                          </div>
                          <strong>
                            {movement.movement_type === "cash_in" ? "+" : "−"}
                            {money(numeric(movement.amount))}
                          </strong>
                        </div>
                      ))}

                      {cashMovements.length === 0 && (
                        <div className="pos-cart-empty">
                          No hay movimientos manuales en este turno.
                        </div>
                      )}
                    </div>
                  </section>
                )}

                {canReverseSales && (
                  <section className="pos-supervisor">
                    <div className="pos-kicker">Supervisor / POS Admin</div>
                    <h3>Buscar venta para devolución</h3>
                    <p className="pos-muted">
                      Puedes buscar ventas de cualquier día. La devolución V1 es completa y repone todo el inventario de la venta.
                    </p>

                    <div className="pos-refund-search">
                      <div className="pos-refund-search-field pos-search-query">
                        <label>Buscar</label>
                        <input
                          type="search"
                          value={refundSearchQuery}
                          onChange={(event) => setRefundSearchQuery(event.target.value)}
                          onKeyDown={(event) => {
                            if (event.key === "Enter") {
                              event.preventDefault();
                              void searchRefundableSales();
                            }
                          }}
                          placeholder="Folio, producto, SKU o referencia"
                        />
                      </div>

                      <div className="pos-refund-search-field">
                        <label>Desde</label>
                        <input
                          type="date"
                          value={refundSearchFrom}
                          onChange={(event) => setRefundSearchFrom(event.target.value)}
                        />
                      </div>

                      <div className="pos-refund-search-field">
                        <label>Hasta</label>
                        <input
                          type="date"
                          value={refundSearchTo}
                          onChange={(event) => setRefundSearchTo(event.target.value)}
                        />
                      </div>

                      <button
                        className="pos-btn"
                        type="button"
                        disabled={refundSearchBusy}
                        onClick={searchRefundableSales}
                      >
                        {refundSearchBusy ? "Buscando…" : "Buscar"}
                      </button>

                      <button
                        className="pos-btn secondary"
                        type="button"
                        disabled={
                          refundSearchBusy ||
                          (!refundSearchQuery &&
                            !refundSearchFrom &&
                            !refundSearchTo &&
                            refundSearchResults.length === 0)
                        }
                        onClick={clearRefundSearch}
                      >
                        Limpiar
                      </button>
                    </div>

                    {refundSearchResults.length > 0 && (
                      <div className="pos-refund-search-results">
                        {refundSearchResults.map((sale) => (
                          <div className="pos-refund-result" key={sale.id}>
                            <div className="pos-refund-result-main">
                              <div className="pos-refund-result-head">
                                <strong>Venta #{sale.sale_number}</strong>
                                <span className={`pos-status-pill ${sale.status}`}>
                                  {sale.status}
                                </span>
                              </div>
                              <div className="pos-refund-result-meta">
                                {new Date(sale.created_at).toLocaleString("es-MX")} ·{" "}
                                {sale.employee_number
                                  ? `#${sale.employee_number} · ${sale.employee_name || "Empleado"}`
                                  : sale.employee_name || "Empleado"}{" "}
                                · {sale.terminal_name || "Terminal"}
                              </div>
                              {(sale.products || sale.skus) && (
                                <div className="pos-refund-result-products">
                                  {sale.products || ""}
                                  {sale.skus ? ` · SKU: ${sale.skus}` : ""}
                                </div>
                              )}
                              {sale.payment_references && (
                                <div className="pos-refund-result-meta">
                                  Ref: {sale.payment_references}
                                </div>
                              )}
                            </div>

                            <div className="pos-refund-result-actions">
                              <strong>{money(numeric(sale.total))}</strong>
                              <button
                                type="button"
                                className="pos-btn"
                                disabled={lookupBusy}
                                onClick={() => loadRefundSaleByNumber(sale.sale_number)}
                              >
                                Ver / devolver
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}

                    <details style={{ marginTop: 12 }}>
                      <summary style={{ cursor: "pointer", fontSize: 12, fontWeight: 800 }}>
                        Buscar directamente por número de venta
                      </summary>
                      <div className="pos-supervisor-grid" style={{ marginTop: 8 }}>
                        <input
                          type="number"
                          min="1"
                          value={lookupNumber}
                          onChange={(event) => setLookupNumber(event.target.value)}
                          placeholder="Número de venta"
                        />
                        <button
                          className="pos-btn"
                          type="button"
                          disabled={lookupBusy || !lookupNumber}
                          onClick={lookupSaleByNumber}
                        >
                          {lookupBusy ? "Buscando…" : "Abrir venta"}
                        </button>
                      </div>
                    </details>

                    {lookupSale && (
                      <div className="pos-lookup-card">
                        <div className="pos-total-row">
                          <div>
                            <strong>Venta #{lookupSale.sale_number}</strong>
                            <div>
                              <span className={`pos-status-pill ${lookupSale.status}`}>
                                {lookupSale.status}
                              </span>
                            </div>
                          </div>
                          <strong>{money(numeric(lookupSale.total))}</strong>
                        </div>

                        <div className="pos-refund-items">
                          {(lookupSale.items || []).map((item) => (
                            <div
                              className="pos-refund-item"
                              key={`${item.product_id}-${item.sku ?? ""}`}
                            >
                              <span>{item.quantity} × {item.product_name}</span>
                              <strong>{money(numeric(item.line_total))}</strong>
                            </div>
                          ))}
                        </div>

                        {lookupSale.status === "completed" ? (
                          <div style={{ display: "grid", gap: 10, marginTop: 14 }}>
                            <div className="pos-field">
                              <label>Método de devolución</label>
                              <select
                                value={refundMethod}
                                onChange={(event) =>
                                  setRefundMethod(
                                    event.target.value as ShiftPayment["method"],
                                  )
                                }
                              >
                                <option value="cash">Efectivo</option>
                                <option value="card_terminal">Terminal</option>
                                <option value="transfer">Transferencia</option>
                                <option value="other">Otro</option>
                              </select>
                            </div>

                            <div className="pos-field">
                              <label>Motivo de devolución</label>
                              <textarea
                                rows={3}
                                value={refundReason}
                                onChange={(event) => setRefundReason(event.target.value)}
                                placeholder="Explica brevemente el motivo"
                              />
                            </div>

                            <button
                              className="pos-link-danger"
                              type="button"
                              disabled={busy || refundReason.trim().length < 4}
                              onClick={refundSale}
                            >
                              Procesar devolución completa
                            </button>
                          </div>
                        ) : (
                          <div className="pos-note">
                            Esta venta ya no está disponible para devolución.
                          </div>
                        )}
                      </div>
                    )}
                  </section>
                )}

                <form className="pos-form" onSubmit={closeShift}>
                  <h2 style={{ marginTop: 16 }}>Cerrar turno</h2>
                  <p className="pos-muted">
                    Efectivo esperado: <strong>{money(expectedCash)}</strong>.
                    Cuenta físicamente la caja antes de cerrar.
                  </p>
                  <div className="pos-field">
                    <label>Efectivo contado al cierre</label>
                    <CurrencyInput
                      key={`closing-${expectedCash}`}
                      name="closing"
                      required
                      defaultValue={expectedCash}
                    />
                  </div>
                  <div className="pos-field">
                    <label>Notas de cierre</label>
                    <textarea name="notes" rows={3} />
                  </div>
                  <button
                    className="pos-btn"
                    disabled={busy || cart.length > 0}
                  >
                    Cerrar turno
                  </button>
                  {cart.length > 0 && (
                    <div className="pos-note">
                      Vacía o cobra el carrito antes de cerrar el turno.
                    </div>
                  )}
                </form>
              </>
            ) : (
              <>
                <h2>Abrir turno</h2>
                <p className="pos-muted">Necesitas el PIN vigente generado por el administrador.</p>
                <form className="pos-form" onSubmit={openShift}>
                  <div className="pos-field"><label>Fondo inicial de caja</label><CurrencyInput name="opening" required defaultValue={0} /></div>
                  <div className="pos-field"><label>PIN de apertura</label><input name="pin" inputMode="numeric" pattern="[0-9]{6}" maxLength={6} required /></div>
                  <button className="pos-btn" disabled={busy}>Abrir turno</button>
                </form>
              </>
            )}

            <button className="pos-btn secondary" style={{marginTop:16}} onClick={()=>logout()} type="button">Cerrar sesión</button>
          </section>
        )}

        {message && <div className="pos-message" role="status">{message}</div>}
      </div>
    </main>
  );
}
