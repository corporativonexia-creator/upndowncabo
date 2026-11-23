"use client";

import { FormEvent, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createClient } from "@supabase/supabase-js";
import {
  buildConsignmentReceipt, buildConsignmentPayoutReceipt, consignmentFolio, consignmentMoney,
  type Consignment,
} from "@/lib/pos/consignment-receipt";
import styles from "./receptions.module.css";
import cx from "./consignments.module.css";

const DEVICE_KEY = "updown-pos-device-token-v1";
const initial = {
  owner_name: "", owner_phone: "", equipment_description: "", condition_notes: "",
  accessories: "", agreed_payout: "", asking_price: "", expires_on: "",
  payout_business_days: "2",
};
type Form = typeof initial;
type Category = { id: string; name: string };
type Method = "cash" | "transfer" | "other";
const stateLabel: Record<Consignment["status"], string> = {
  received: "Recibida", on_sale: "Disponible en POS", sold_pending: "Vendida · por liquidar",
  paid: "Liquidada", returned: "Devuelta al propietario", refunded: "Venta devuelta · revisar",
  refunded_paid: "Devolución después del pago · revisar",
};

function errorText(error: unknown) {
  const message = error && typeof error === "object" && "message" in error ? String(error.message) : String(error);
  const map: Record<string, string> = {
    CONSIGNMENT_MANAGER_REQUIRED: "Solo supervisores y administradores POS pueden gestionar consignaciones.",
    CONSIGNMENT_NOT_PAYABLE: "Este artículo no tiene una liquidación pendiente.",
    CONSIGNMENT_ALREADY_PAID: "La liquidación ya fue registrada; no se duplicó el pago.",
    CONSIGNMENT_CASH_SHIFT_REQUIRED: "Abre un turno de caja antes de entregar efectivo.",
    CONSIGNMENT_STOCK_MISMATCH: "El inventario cambió. Revisa la ficha antes de entregar el equipo.",
    CONSIGNMENT_NOT_RETURNABLE: "No se puede devolver este artículo al dueño desde este estado.",
    CONSIGNMENT_NOT_AVAILABLE: "Esta consignación ya no está disponible para vender.",
    CONSIGNMENT_PAYMENT_REFERENCE_REQUIRED: "Para transferencia u otro método se necesita una referencia.",
  };
  return Object.entries(map).find(([key]) => message.includes(key))?.[1] || message;
}

export default function ConsignmentWorkspace({ onReturnToService }: { onReturnToService: () => void }) {
  const db = useMemo(() => createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!, {
      auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: false,
        storage: typeof window !== "undefined" ? window.localStorage : undefined,
        storageKey: "updown-pos-auth-v1" },
    }
  ), []);
  const [token, setToken] = useState("");
  const [access, setAccess] = useState(false);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [form, setForm] = useState<Form>(initial);
  const [rows, setRows] = useState<Consignment[]>([]);
  const [search, setSearch] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [categories, setCategories] = useState<Category[]>([]);
  const [categoryId, setCategoryId] = useState("");
  const [productName, setProductName] = useState("");
  const [brand, setBrand] = useState("");
  const [model, setModel] = useState("");
  const [method, setMethod] = useState<Method>("cash");
  const [reference, setReference] = useState("");
  const [recipientConfirmed, setRecipientConfirmed] = useState(false);
  const createRequestId = useRef<string | null>(null);
  const payoutRequestId = useRef<string | null>(null);

  const selected = rows.find(r => r.id === selectedId) || null;
  const pending = rows.filter(r => r.status === "sold_pending");
  const expectedGrossProfit = selected?.sold_price != null
    ? selected.sold_price - Number(selected.agreed_payout)
    : selected ? Number(selected.asking_price) - Number(selected.agreed_payout) : 0;

  const reload = useCallback(async (device: string, query = "") => {
    const { data, error: rpcError } = await db.rpc("pos_consignment_recent", {
      p_device_token: device, p_search: query,
    });
    if (rpcError) throw rpcError;
    setRows(Array.isArray(data) ? data as Consignment[] : []);
  }, [db]);

  useEffect(() => {
    let active = true;
    const device = window.localStorage.getItem(DEVICE_KEY) || "";
    if (!device) {
      void Promise.resolve().then(() => {
        if (active) { setLoading(false); setError("Primero inicia sesión y activa una terminal POS."); }
      });
      return () => { active = false; };
    }
    void db.auth.getUser().then(({ data: { user } }) => {
      if (!user) throw new Error("Es necesario iniciar sesión como empleado POS.");
      return db.rpc("pos_consignment_manager", { p_device_token: device });
    }).then(async result => {
      if (result.error) throw result.error;
      const cat = await db.from("categories").select("id,name").eq("is_active", true).order("name");
      if (cat.error) throw cat.error;
      if (active) {
        setCategories(cat.data as Category[]);
        setToken(device);
        await reload(device);
        if (active) setAccess(true);
      }
    }).catch(reason => { if (active) setError(errorText(reason)); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [db, reload]);

  useEffect(() => {
    if (!access || !token) return;
    const timer = window.setInterval(() => {
      if (document.visibilityState === "visible" && !search.trim()) {
        void reload(token).catch(() => { /* The next explicit refresh surfaces errors. */ });
      }
    }, 45000);
    return () => window.clearInterval(timer);
  }, [access, token, reload, search]);

  function update<K extends keyof Form>(key: K, value: Form[K]) {
    createRequestId.current = null;
    setForm(previous => ({ ...previous, [key]: value }));
  }

  async function searchRows(event?: FormEvent) {
    event?.preventDefault(); setError("");
    try { await reload(token, search.trim()); } catch (reason) { setError(errorText(reason)); }
  }

  function select(item: Consignment) {
    setSelectedId(item.id);
    setCategoryId("");
    setProductName(item.equipment_description.slice(0,140));
    setBrand(""); setModel("");
    setMethod("cash"); setReference(""); setRecipientConfirmed(false);
    payoutRequestId.current = null;
    setError(""); setNotice("");
  }

  async function create(event: FormEvent) {
    event.preventDefault();
    if (Number(form.asking_price) < Number(form.agreed_payout)) {
      setError("El precio de venta no puede ser menor al importe pactado con el propietario."); return;
    }
    setBusy(true); setError(""); setNotice("");
    createRequestId.current ||= crypto.randomUUID();
    try {
      const { data, error: rpcError } = await db.rpc("pos_consignment_create", {
        p_device_token: token, p_request_id: createRequestId.current,
        p_owner_name: form.owner_name, p_owner_phone: form.owner_phone,
        p_equipment_description: form.equipment_description, p_condition_notes: form.condition_notes,
        p_accessories: form.accessories,
        p_agreed_payout: Number(form.agreed_payout), p_asking_price: Number(form.asking_price),
        p_expires_on: form.expires_on || null, p_payout_business_days: Number(form.payout_business_days),
      });
      if (rpcError) throw rpcError;
      await reload(token);
      select(data as Consignment);
      setNotice(`${consignmentFolio((data as Consignment).receipt_number)} creado. Imprime el comprobante y publica el artículo en POS.`);
      setForm(initial); createRequestId.current = null;
    } catch (reason) { setError(errorText(reason)); }
    finally { setBusy(false); }
  }

  async function act(kind: "publish" | "payout" | "return") {
    if (!selected) return;
    if (kind === "return" && !window.confirm(`¿Confirmas que devolviste físicamente ${consignmentFolio(selected.receipt_number)} al propietario? Se retirará de POS.`)) return;
    if (kind === "payout" && !window.confirm(`¿Registrar entrega de ${consignmentMoney(Number(selected.agreed_payout))} al propietario? Esta acción afecta caja si eliges efectivo.`)) return;
    setBusy(true); setError(""); setNotice("");
    if (kind === "payout") payoutRequestId.current ||= crypto.randomUUID();
    const functionName = kind === "publish" ? "pos_consignment_publish" :
      kind === "payout" ? "pos_consignment_payout" : "pos_consignment_return";
    const args = kind === "publish" ? {
      p_device_token: token, p_consignment_id: selected.id,
      p_category_id: categoryId, p_product_name: productName, p_brand: brand, p_model: model,
    } : kind === "payout" ? {
      p_device_token: token, p_consignment_id: selected.id, p_request_id: payoutRequestId.current,
      p_method: method, p_reference: reference || null, p_recipient_confirmed: recipientConfirmed,
    } : { p_device_token: token, p_consignment_id: selected.id };
    try {
      const { error: rpcError } = await db.rpc(functionName, args);
      if (rpcError) throw rpcError;
      await reload(token, search.trim());
      if (kind === "payout") payoutRequestId.current = null;
      setNotice(kind === "publish" ? "Producto publicado: ya se puede buscar y cobrar en el POS con su folio CG." :
        kind === "payout" ? "Liquidación registrada una sola vez. Conserva la referencia y el comprobante del propietario." :
        "Entrega al propietario registrada. El producto salió del catálogo POS.");
    } catch (reason) { setError(errorText(reason)); }
    finally { setBusy(false); }
  }

  function receipt(item: Consignment, download: boolean) {
    try {
      const pdf = buildConsignmentReceipt(item);
      if (download) pdf.save(`UPNDOWN-Consignacion-${consignmentFolio(item.receipt_number)}.pdf`);
      else {
        const url = URL.createObjectURL(pdf.output("blob"));
        const printWindow = window.open(url, "_blank", "noopener,noreferrer");
        if (!printWindow) { URL.revokeObjectURL(url); throw new Error("Autoriza ventanas emergentes para abrir el PDF de impresión."); }
        window.setTimeout(() => URL.revokeObjectURL(url), 60000);
      }
    } catch (reason) { setError(errorText(reason)); }
  }

  function payoutReceipt(item: Consignment) {
    try {
      buildConsignmentPayoutReceipt(item).save(`UPNDOWN-Liquidacion-${consignmentFolio(item.receipt_number)}.pdf`);
    } catch (reason) { setError(errorText(reason)); }
  }

  return (
    <section className={cx.workspace}>
      <div className={cx.heading}>
        <div><div className={styles.kicker}>UP AND DOWN · CONTROL DE PROPIETARIOS</div>
          <h1>Consignaciones</h1>
          <p className={styles.muted}>Recibir, publicar en POS, vender como producto normal y liquidar al propietario.</p>
        </div>
        <button type="button" className={styles.back} onClick={onReturnToService}>← Recepción de servicio</button>
      </div>
      {loading && <div role="status" className={styles.success}>Verificando permisos de supervisor y terminal…</div>}
      {error && <div role="alert" className={styles.alert}>{error}</div>}
      {notice && <div role="status" className={styles.success}>{notice}</div>}
      {access && <>
        <div className={cx.metrics}>
          <div><small>Expedientes consultados</small><strong>{rows.length}</strong></div>
          <div><small>Por liquidar</small><strong>{pending.length}</strong></div>
          <div><small>Importe pendiente al dueño</small><strong>{consignmentMoney(pending.reduce((sum, r) => sum + Number(r.agreed_payout), 0))}</strong></div>
        </div>
        <div className={styles.grid}>
          <section className={styles.panel}>
            <h2>Nueva consignación</h2>
            <p className={styles.muted}>Cada pieza recibe un folio único. Ningún dinero sale de caja al recibirla.</p>
            <form className={styles.fields} onSubmit={create}>
              <div className={styles.pair}>
                <div className={styles.field}><label htmlFor="cg-owner">Propietario</label>
                  <input id="cg-owner" required minLength={2} maxLength={140} value={form.owner_name}
                    onChange={e => update("owner_name", e.target.value)} /></div>
                <div className={styles.field}><label htmlFor="cg-phone">Teléfono</label>
                  <input id="cg-phone" type="tel" required minLength={7} maxLength={30} value={form.owner_phone}
                    onChange={e => update("owner_phone", e.target.value)} /></div>
              </div>
              <div className={styles.field}><label htmlFor="cg-equipment">Artículo recibido</label>
                <input id="cg-equipment" required minLength={3} maxLength={500} value={form.equipment_description}
                  onChange={e => update("equipment_description", e.target.value)} placeholder="Marca, modelo, talla, color o serie" /></div>
              <div className={styles.field}><label htmlFor="cg-condition">Estado físico al recibir</label>
                <textarea id="cg-condition" required minLength={3} maxLength={1000} rows={2} value={form.condition_notes}
                  onChange={e => update("condition_notes", e.target.value)} placeholder="Rayones, desgaste, funcionamiento, daños preexistentes" /></div>
              <div className={styles.field}><label htmlFor="cg-accessories">Accesorios (opcional)</label>
                <input id="cg-accessories" maxLength={400} value={form.accessories}
                  onChange={e => update("accessories", e.target.value)} placeholder="Funda, cargador, documentación…" /></div>
              <div className={styles.pair}>
                <div className={styles.field}><label htmlFor="cg-pay">Precio pactado con dueño (MXN)</label>
                  <input id="cg-pay" type="number" min="0.01" step="0.01" required value={form.agreed_payout}
                    onChange={e => update("agreed_payout", e.target.value)} /></div>
                <div className={styles.field}><label htmlFor="cg-sell">Precio de venta (MXN)</label>
                  <input id="cg-sell" type="number" min="0.01" step="0.01" required value={form.asking_price}
                    onChange={e => update("asking_price", e.target.value)} /></div>
              </div>
              {Number(form.asking_price) > 0 && Number(form.agreed_payout) > 0 &&
                <p className={cx.margin}>Margen bruto previsto: <strong>{consignmentMoney(Number(form.asking_price) - Number(form.agreed_payout))}</strong> (antes de comisiones e impuestos).</p>}
              <div className={styles.pair}>
                <div className={styles.field}><label htmlFor="cg-expiry">Fin de exhibición (opcional)</label>
                  <input id="cg-expiry" type="date" min={new Date().toLocaleDateString("en-CA")} value={form.expires_on}
                    onChange={e => update("expires_on", e.target.value)} /></div>
                <div className={styles.field}><label htmlFor="cg-days">Plazo para pagar tras vender (días hábiles)</label>
                  <input id="cg-days" type="number" min={0} max={60} required value={form.payout_business_days}
                    onChange={e => update("payout_business_days", e.target.value)} /></div>
              </div>
              <button className={styles.primary} disabled={busy}>{busy ? "Guardando…" : "Recibir a consignación"}</button>
            </form>
            <p className={styles.footnote}>El recibo documenta la custodia, el precio pactado y las condiciones. No constituye un pago al propietario.</p>
          </section>
          <aside className={styles.panel}>
            <h2>Control y liquidaciones</h2>
            <p className={styles.muted}>Al venderse aparece aquí como pendiente. La ficha del dueño nunca sale en el ticket del comprador.</p>
            <form className={styles.actions} onSubmit={searchRows}>
              <input className={styles.search} aria-label="Buscar consignaciones" maxLength={80} value={search}
                onChange={e => setSearch(e.target.value)} placeholder="CG000001, nombre, teléfono o artículo" />
              <button type="submit" className={styles.secondary}>Buscar</button>
              <button type="button" className={styles.secondary} onClick={() => { setSearch(""); void reload(token).catch(reason => setError(errorText(reason))); }}>Actualizar</button>
            </form>
            {selected && <section className={styles.saved} aria-label="Expediente de consignación">
              <div className={styles.selectedHeading}>
                <div><span className={styles.selectedLabel}>Expediente</span><strong>{consignmentFolio(selected.receipt_number)}</strong></div>
                <span className={styles.statusTag}>{stateLabel[selected.status]}</span>
              </div>
              <p className={styles.selectedSummary}>{selected.owner_name} · {selected.owner_phone}</p>
              <p className={styles.selectedSummary}>{selected.equipment_description}</p>
              <p className={styles.selectedSummary}>Dueño: <b>{consignmentMoney(Number(selected.agreed_payout))}</b> · Venta: <b>{consignmentMoney(Number(selected.sold_price ?? selected.asking_price))}</b> · Margen bruto: <b>{consignmentMoney(expectedGrossProfit)}</b></p>
              <p className={styles.selectedSummary}>Condición: {selected.condition_notes} · Accesorios: {selected.accessories}</p>
              {selected.expires_on && <p className={styles.selectedSummary}>Fin del periodo de exhibición: <b>{selected.expires_on}</b></p>}
              {selected.payout_due_on && <p className={cx.due}>Fecha estimada para liquidar: {selected.payout_due_on} (sin considerar días feriados).</p>}
              {selected.sale_id && <small>Venta vinculada: {selected.sale_id}</small>}
              {selected.status === "received" && <div className={styles.fields}>
                <div className={styles.field}><label htmlFor="cg-name">Nombre del artículo en catálogo POS</label>
                  <input id="cg-name" required minLength={3} value={productName} onChange={e => setProductName(e.target.value)} /></div>
                <div className={styles.field}><label htmlFor="cg-cat">Categoría</label>
                  <select id="cg-cat" value={categoryId} onChange={e => setCategoryId(e.target.value)}>
                    <option value="">Selecciona categoría</option>
                    {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                  </select></div>
                <div className={styles.pair}>
                  <div className={styles.field}><label htmlFor="cg-brand">Marca</label>
                    <input id="cg-brand" value={brand} onChange={e => setBrand(e.target.value)} /></div>
                  <div className={styles.field}><label htmlFor="cg-model">Modelo</label>
                    <input id="cg-model" value={model} onChange={e => setModel(e.target.value)} /></div>
                </div>
                <button className={styles.primary} type="button" disabled={busy || !categoryId || productName.trim().length < 3}
                  onClick={() => void act("publish")}>Publicar artículo en POS · 1 pieza</button>
              </div>}
              {selected.status === "on_sale" && <div className={styles.actions}>
                <span className={cx.due}>Escanea <b>{consignmentFolio(selected.receipt_number)}</b> en el POS para cobrar normalmente.</span>
                <button className={styles.secondary} disabled={busy} type="button" onClick={() => void act("return")}>Registrar devolución al propietario</button>
              </div>}
              {selected.status === "sold_pending" && <div className={styles.fields}>
                <p className={cx.due}>Venta cobrada. Ahora corresponde entregar <b>{consignmentMoney(Number(selected.agreed_payout))}</b> al dueño.</p>
                <div className={styles.field}><label htmlFor="cg-method">Método de liquidación</label>
                  <select id="cg-method" value={method} onChange={e => { setMethod(e.target.value as Method); payoutRequestId.current = null; }}>
                    <option value="cash">Efectivo · salida de caja</option><option value="transfer">Transferencia</option><option value="other">Otro</option>
                  </select></div>
                <div className={styles.field}><label htmlFor="cg-ref">Referencia / comprobante {method === "cash" ? "(opcional)" : "(obligatorio)"}</label>
                  <input id="cg-ref" value={reference} onChange={e => { setReference(e.target.value); payoutRequestId.current = null; }} /></div>
                <label className={cx.confirm}><input type="checkbox" checked={recipientConfirmed}
                  onChange={e => setRecipientConfirmed(e.target.checked)} /> Confirmo identidad del propietario y entrega del importe pactado.</label>
                <button type="button" className={styles.primary} disabled={busy || !recipientConfirmed || (method !== "cash" && !reference.trim())}
                  onClick={() => void act("payout")}>Registrar liquidación por {consignmentMoney(Number(selected.agreed_payout))}</button>
              </div>}
              {selected.status === "paid" && <div>
                <p className={cx.due}>Liquidación realizada · {selected.payout_method === "cash" ? "Efectivo" : selected.payout_method === "transfer" ? "Transferencia" : "Otro"} · {selected.payout_reference || "Sin referencia"}</p>
                <button type="button" className={styles.primary} onClick={() => payoutReceipt(selected)}>Descargar comprobante de liquidación con firmas</button>
              </div>}
              {selected.status.startsWith("refunded") && <p className={styles.alert}>Venta anulada o devuelta. Requiere revisión administrativa antes de volver a publicar o acordar otra liquidación.</p>}
              <div className={styles.actions}>
                <button type="button" className={styles.secondary} onClick={() => receipt(selected, false)}>Ver PDF / imprimir 2 copias</button>
                <button type="button" className={styles.secondary} onClick={() => receipt(selected, true)}>Descargar recibo</button>
              </div>
            </section>}
            <div className={styles.list}>
              {rows.map(item => <button key={item.id} type="button" aria-pressed={selectedId === item.id}
                className={`${styles.item} ${selectedId === item.id ? styles.itemActive : ""}`}
                onClick={() => select(item)}>
                <span className={styles.itemLine}><strong>{item.owner_name}</strong><span className={styles.folio}>{consignmentFolio(item.receipt_number)}</span></span>
                <small>{item.equipment_description}</small>
                <small><b>{stateLabel[item.status]}</b> · Dueño {consignmentMoney(Number(item.agreed_payout))}</small>
              </button>)}
              {!rows.length && <div className={styles.empty}>Aún no hay expedientes con este filtro.</div>}
            </div>
          </aside>
        </div>
      </>}
    </section>
  );
}
