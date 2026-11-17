"use client";

import { FormEvent, useEffect, useMemo, useRef, useState } from "react";
import { createClient } from "@supabase/supabase-js";
import {
  buildReceptionPdf, normalizeReceptionFolio, receptionDate, receptionFileName, receptionFolio,
  type ServiceReception,
} from "@/lib/pos/reception-receipt";
import styles from "./receptions.module.css";

type ServiceOption = { id: string; name: string; sku: string };
type Identity = { employee_number: string; employee_name: string; terminal_name: string };
type ReceptionForm = {
  customer_name: string; customer_phone: string; equipment_description: string;
  service_product_id: string; work_description: string; condition_notes: string; accessories: string;
};
const blank: ReceptionForm = {
  customer_name: "", customer_phone: "", equipment_description: "",
  service_product_id: "", work_description: "", condition_notes: "", accessories: "",
};
const DEVICE_KEY = "updown-pos-device-token-v1";

function errorText(error: unknown) {
  if (error && typeof error === "object" && "message" in error) {
    return String(error.message);
  }
  return error instanceof Error ? error.message : String(error);
}

export default function ServiceRecepcionesPage() {
  const db = useMemo(() => createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      auth: {
        persistSession: true, autoRefreshToken: true, detectSessionInUrl: false,
        storage: typeof window !== "undefined" ? window.localStorage : undefined,
        storageKey: "updown-pos-auth-v1",
      },
    }
  ), []);
  const [token, setToken] = useState("");
  const [identity, setIdentity] = useState<Identity | null>(null);
  const [services, setServices] = useState<ServiceOption[]>([]);
  const [receptions, setReceptions] = useState<ServiceReception[]>([]);
  const [form, setForm] = useState<ReceptionForm>(blank);
  const [selected, setSelected] = useState<ServiceReception | null>(null);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [printing, setPrinting] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const requestId = useRef<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    const device = window.localStorage.getItem(DEVICE_KEY) || "";
    if (!device) {
      void Promise.resolve().then(() => {
        if (!cancelled) {
          setError("Este equipo no está activado para el POS. Entra y activa la terminal desde /pos.");
          setLoading(false);
        }
      });
      return;
    }
    void Promise.resolve().then(() => { if (!cancelled) setToken(device); });
    void Promise.all([
      db.rpc("pos_reception_access", { p_device_token: device }),
      db.from("products").select("id,name,sku").eq("is_service", true)
        .eq("status", "active").eq("pos_visible", true).order("name"),
      db.rpc("pos_reception_recent", { p_device_token: device, p_search: "" }),
    ]).then(([who, svc, history]) => {
      if (who.error) throw who.error;
      if (svc.error) throw svc.error;
      if (history.error) throw history.error;
      if (!cancelled) {
        setIdentity(who.data as Identity);
        setServices((svc.data || []) as ServiceOption[]);
        setReceptions(Array.isArray(history.data) ? history.data as ServiceReception[] : []);
      }
    }).catch((e) => {
      if (!cancelled) setError("Acceso a recepciones: " + errorText(e) + ". Regresa al POS e inicia sesión.");
    }).finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [db]);

  function update<K extends keyof ReceptionForm>(key: K, value: ReceptionForm[K]) {
    setForm((current) => ({ ...current, [key]: value }));
    requestId.current = null;
  }

  async function refreshHistory(query = "") {
    const { data, error: historyError } = await db.rpc("pos_reception_recent", {
      p_device_token: token, p_search: query,
    });
    if (historyError) throw historyError;
    setReceptions(Array.isArray(data) ? data as ServiceReception[] : []);
  }

  async function searchHistory(e: FormEvent) {
    e.preventDefault();
    setBusy(true); setError("");
    try { await refreshHistory(normalizeReceptionFolio(search) || search.trim()); }
    catch (e) { setError("No se pudo consultar el historial: " + errorText(e)); }
    finally { setBusy(false); }
  }

  async function register(e: FormEvent) {
    e.preventDefault();
    if (!identity || !token || busy) return;
    if (!form.service_product_id) { setError("Selecciona el servicio del catálogo POS."); return; }
    setBusy(true); setError(""); setNotice("");
    try {
      if (!requestId.current) requestId.current = crypto.randomUUID();
      const payload = {
        p_device_token: token, p_request_id: requestId.current,
        p_customer_name: form.customer_name.trim(), p_customer_phone: form.customer_phone.trim(),
        p_equipment_description: form.equipment_description.trim(),
        p_service_product_id: form.service_product_id,
        p_work_description: form.work_description.trim(),
        p_condition_notes: form.condition_notes.trim(),
        p_accessories: form.accessories.trim() || "No especificados",
      };
      const { data, error: saveError } = await db.rpc("pos_reception_create", payload);
      if (saveError) throw saveError;
      const saved = data as ServiceReception;
      setSelected(saved);
      setForm(blank);
      requestId.current = null;
      setNotice("Recepción " + receptionFolio(saved.receipt_number) + " guardada. Imprime la copia del cliente y la del taller.");
      try { await refreshHistory(""); setSearch(""); } catch { /* El folio quedó guardado; la lista puede recargarse. */ }
    } catch (e) {
      setError("No se pudo registrar la recepción: " + errorText(e) + ". Si dudas si se guardó, consulta el historial antes de repetir.");
    } finally { setBusy(false); }
  }

  async function markReady(reception: ServiceReception) {
    if (busy || !identity || !token) return;
    setBusy(true); setError(""); setNotice("");
    try {
      const { data, error } = await db.rpc("pos_reception_set_ready", {
        p_device_token: token, p_reception_id: reception.id,
      });
      if (error) throw error;
      const updated = data as ServiceReception;
      setSelected(updated);
      setNotice("Equipo " + receptionFolio(updated.receipt_number) +
        " listo para entregar. Cuando el cliente venga, escanea el folio en caja y captura el precio.");
      await refreshHistory(search.trim());
    } catch (e) {
      setError("No se pudo actualizar el equipo: " + errorText(e));
    } finally { setBusy(false); }
  }

  function pdf(reception: ServiceReception, print: boolean) {
    const doc = buildReceptionPdf(reception);
    if (!print) {
      doc.save(receptionFileName(reception));
      setNotice("PDF con las dos copias descargado: " + receptionFolio(reception.receipt_number));
      return;
    }
    const blobUrl = doc.output("bloburl");
    const win = window.open(String(blobUrl), "_blank");
    if (!win) {
      doc.save(receptionFileName(reception));
      setNotice("El navegador bloqueó la ventana. Descargué el PDF; ábrelo e imprime ambas páginas.");
      return;
    }
    window.setTimeout(() => { try { win.focus(); win.print(); } catch { /* El usuario puede imprimir desde el visor. */ } }, 900);
    setNotice("Se abrió el comprobante con las dos copias. Selecciona la impresora de 80 mm y verifica la configuración del cajón.");
  }

  async function printThermal(reception: ServiceReception) {
    if (printing) return;
    setPrinting(true); setError(""); setNotice("");
    try {
      const resp = await fetch("http://127.0.0.1:18181/print-reception", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reception }),
      });
      if (!resp.ok) {
        if (resp.status === 404) throw new Error("BRIDGE_ANTIGUO");
        throw new Error("Impresión incierta (" + resp.status + "). Revisa el papel y el folio antes de reimprimir.");
      }
      setNotice("Enviadas las dos copias térmicas de " + receptionFolio(reception.receipt_number) + ", sin orden de abrir el cajón.");
    } catch (e) {
      if (errorText(e).includes("incierta")) {
        setError(errorText(e));
      } else {
        setError("El puente térmico no está actualizado o no responde. Usa «PDF dos copias» e imprime manualmente; revisa la configuración del cajón en el driver.");
      }
    } finally { setPrinting(false); }
  }

  const canWork = !loading && identity !== null;
  return (
    <main className={styles.shell}>
      <div className={styles.wrap}>
        <header className={styles.header}>
          <div>
            <div className={styles.kicker}>UP AND DOWN · POS / TALLER</div>
            <h1>Recepción de equipos</h1>
            <p>Recepción, preparación y entrega con cobro posterior desde el POS. Registrar no genera venta ni afecta existencias.</p>
          </div>
          <a href="/pos" className={styles.back}>← Volver al POS</a>
        </header>
        {loading && <div className={styles.success}>Validando sesión de empleado y terminal...</div>}
        {error && <div className={styles.alert} role="alert">{error}</div>}
        {notice && <div className={styles.success} role="status">{notice}</div>}
        {canWork && (
          <div className={styles.grid}>
            <section className={styles.panel}>
              <h2>Nueva recepción</h2>
              <p className={styles.muted}>Recibe un equipo por folio. Registra las condiciones originales antes de entregar el comprobante.</p>
              <form onSubmit={register} className={styles.fields}>
                <div className={styles.pair}>
                  <div className={styles.field}><label htmlFor="reception-client">Cliente</label>
                    <input id="reception-client" required minLength={2} maxLength={140} value={form.customer_name}
                      onChange={(e) => update("customer_name", e.target.value)} placeholder="Nombre completo" /></div>
                  <div className={styles.field}><label htmlFor="reception-phone">Teléfono / WhatsApp</label>
                    <input id="reception-phone" required minLength={7} maxLength={30} type="tel" value={form.customer_phone}
                      onChange={(e) => update("customer_phone", e.target.value)} placeholder="624 000 0000" /></div>
                </div>
                <div className={styles.field}><label htmlFor="reception-equipment">Equipo recibido</label>
                  <input id="reception-equipment" required minLength={3} maxLength={240}
                    value={form.equipment_description} onChange={(e) => update("equipment_description", e.target.value)}
                    placeholder="Ej. Driver TaylorMade, modelo, número o características" /></div>
                <div className={styles.field}><label htmlFor="reception-service">Servicio solicitado</label>
                  <select id="reception-service" required value={form.service_product_id}
                    onChange={(e) => update("service_product_id", e.target.value)}>
                    <option value="">Selecciona un servicio del POS</option>
                    {services.map(s => <option key={s.id} value={s.id}>{s.name} · {s.sku}</option>)}
                  </select>
                  {services.length === 0 && <small>No hay servicios activos. Pide al administrador crear un servicio en Admin → POS → Promociones y servicios → Alta de servicio (precio libre).</small>}
                </div>
                <div className={styles.field}><label htmlFor="reception-work">Qué trabajo se realizará</label>
                  <textarea id="reception-work" required minLength={5} maxLength={1500} rows={3}
                    value={form.work_description} onChange={(e) => update("work_description", e.target.value)}
                    placeholder="Ej. Retirar grip desgastado, instalar uno nuevo y revisar el ajuste." /></div>
                <div className={styles.field}><label htmlFor="reception-condition">Condición del equipo al recibirlo</label>
                  <textarea id="reception-condition" required minLength={3} maxLength={1000} rows={2}
                    value={form.condition_notes} onChange={(e) => update("condition_notes", e.target.value)}
                    placeholder="Rayones, daños existentes, desgaste, funcionamiento, etc." /></div>
                <div className={styles.field}><label htmlFor="reception-accessories">Accesorios entregados (opcional)</label>
                  <input id="reception-accessories" maxLength={400} value={form.accessories}
                    onChange={(e) => update("accessories", e.target.value)}
                    placeholder="Ej. Funda, tornillo, llave. Si no trae nada, escribir «Ninguno»." /></div>
                <div className={styles.actions}>
                  <button className={styles.primary} disabled={busy || !services.length}>
                    {busy ? "Registrando..." : "Registrar recepción"}
                  </button>
                </div>
              </form>
              <p className={styles.footnote}>Recibe: #{identity.employee_number} {identity.employee_name} · {identity.terminal_name}. No hace falta turno de caja abierto. Las recepciones guardadas no se editan silenciosamente.</p>
              {selected && (
                <div className={styles.saved}>
                  <strong>{receptionFolio(selected.receipt_number)}</strong>
                  <small>{selected.customer_name} · {selected.equipment_description}</small>
                  <small><strong style={{fontSize:13,display:"inline"}}>
                    {selected.status === "delivered" ? "ENTREGADO Y COBRADO" : selected.status === "ready" ? "LISTO PARA ENTREGAR" : "RECIBIDO · PENDIENTE"}
                  </strong> · Precio del servicio pendiente hasta cobrar en caja.</small>
                  {selected.status === "delivered" && selected.checkout_sale_id &&
                    <small>Venta vinculada: {selected.checkout_sale_id}</small>}
                  <div className={styles.actions}>
                    {selected.status === "received" &&
                      <button type="button" className={styles.primary} disabled={busy}
                        onClick={() => void markReady(selected)}>✓ Listo para entregar</button>}
                    {selected.status === "ready" &&
                      <a href={"/pos?recepcion=" + encodeURIComponent(receptionFolio(selected.receipt_number))}
                         className={styles.primary} style={{textDecoration:"none",display:"inline-flex",alignItems:"center"}}>
                        Escanear y cobrar en POS
                      </a>}
                    <button type="button" className={styles.primary} disabled={printing} onClick={() => void printThermal(selected)}>
                      {printing ? "Enviando..." : "Imprimir 2 tickets térmicos"}
                    </button>
                    <button type="button" className={styles.secondary} onClick={() => pdf(selected, true)}>PDF dos copias</button>
                    <button type="button" className={styles.secondary} onClick={() => pdf(selected, false)}>Descargar PDF</button>
                  </div>
                </div>
              )}
            </section>
            <aside className={styles.panel}>
              <h2>Consultar recepciones</h2>
              <p className={styles.muted}>Busca el folio, nombre, teléfono o equipo. Marca listo, cobra desde el POS o reimprime sin duplicar.</p>
              <form onSubmit={searchHistory} className={styles.actions}>
                <input aria-label="Buscar recepciones" className={styles.search} maxLength={80}
                  value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Ej. SR-000128" />
                <button className={styles.secondary} disabled={busy} type="submit">Buscar</button>
              </form>
              <div className={styles.list}>
                {receptions.map(r => (
                  <button type="button" key={r.id} className={styles.item} onClick={() => { setSelected(r); setNotice("Recepción " + receptionFolio(r.receipt_number) + " seleccionada para reimpresión."); }}>
                    <span className={styles.itemLine}><strong>{r.customer_name}</strong><span className={styles.folio}>{receptionFolio(r.receipt_number)}</span></span>
                    <small>{r.equipment_description} · {r.service_name}</small>
                    <small>{receptionDate(r.received_at)} · {r.status==="delivered"?"Entregado y cobrado":r.status==="ready"?"Listo para entregar":"Recibido"}</small>
                  </button>
                ))}
                {!receptions.length && <div className={styles.empty}>No hay recepciones para mostrar.</div>}
              </div>
            </aside>
          </div>
        )}
      </div>
    </main>
  );
}
