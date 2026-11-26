"use client";

import { FormEvent, useEffect, useMemo, useRef, useState } from "react";
import { createClient } from "@supabase/supabase-js";
import {
  buildReceptionPdf, receptionDate, receptionFileName, receptionFolio, receptionSearchTerm, receptionPrintView,
  type ServiceReception,
} from "@/lib/pos/reception-receipt";
import styles from "./receptions.module.css";
import ConsignmentWorkspace from "./consignment-workspace";
import { MAX_RECEPTION_LINES, receptionChargeGroups, receptionLineAmount, receptionLineStatuses, type ReceptionServiceInput, type ReceptionServiceLine, type ServiceLineStatus } from "@/lib/pos/multiservicio";

type ServiceOption = { id: string; name: string; sku: string };
type Identity = { employee_number: string; employee_name: string; terminal_name: string; employee_role?:string };
type ReceptionFilter = "all" | ServiceReception["status"];
type ReceptionForm={customer_name:string;customer_phone:string};
type EquipmentDraft={
  key:number;equipment_description:string;condition_notes:string;accessories:string;
  services:{service_product_id:string;work_description:string;quantity:number}[];
};
const blank:ReceptionForm={customer_name:"",customer_phone:""};
const blankEquipment=(key:number):EquipmentDraft=>({key,equipment_description:"",condition_notes:"",accessories:"",
  services:[{service_product_id:"",work_description:"",quantity:1}]});
const DEVICE_KEY = "updown-pos-device-token-v1";

function errorText(error: unknown) {
  if (error && typeof error === "object" && "message" in error) {
    return String(error.message);
  }
  return error instanceof Error ? error.message : String(error);
}

export default function ServiceRecepcionesPage({ embedded = false, onReturnToPos, onCheckoutFolio, focusReception }: {
  embedded?: boolean;
  onReturnToPos?: () => void;
  onCheckoutFolio?: (folio: string) => void;
  focusReception?: { reception:ServiceReception } | null;
} = {}) {
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
  const [workspaceMode, setWorkspaceMode] = useState<"service" | "consignment">(() =>
    typeof window !== "undefined" && new URLSearchParams(window.location.search).get("modo") === "consignacion"
      ? "consignment" : "service");
  const [identity, setIdentity] = useState<Identity | null>(null);
  const [services, setServices] = useState<ServiceOption[]>([]);
  const [receptions, setReceptions] = useState<ServiceReception[]>([]);
  const [form, setForm] = useState<ReceptionForm>(blank);
  const [equipment,setEquipment]=useState<EquipmentDraft[]>(()=>[blankEquipment(1)]);
  const [lineEdits,setLineEdits]=useState<Record<number,{price:string;status:ServiceLineStatus}>>({});
  const [lineSaving,setLineSaving]=useState(false);
  const [appendDraft,setAppendDraft]=useState({equipment_key:0,service_product_id:"",quantity:1,work_description:""});
  const appendRequest=useRef<string|null>(null);
  const [selected, setSelected] = useState<ServiceReception | null>(null);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<ReceptionFilter>("all");
  const [searching, setSearching] = useState(false);
  const [historyError, setHistoryError] = useState("");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [printing, setPrinting] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const requestId = useRef<string | null>(null);
  const selectedDetailRef = useRef<HTMLElement | null>(null);
  const historySequence = useRef(0);
  const searchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => () => {
    historySequence.current += 1;
    if (searchTimer.current !== null) clearTimeout(searchTimer.current);
  }, []);

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
    // Reception RPCs are granted only to authenticated employees. A deep link
    // from ADMIN has a different auth session from the POS terminal.
    void db.auth.getUser().then(({ data: { user }, error: sessionError }) => {
      if (sessionError || !user) throw new Error("SESSION_REQUIRED");
      return Promise.all([
        db.rpc("pos_reception_access", { p_device_token: device }),
        db.from("products").select("id,name,sku").eq("is_service", true)
          .eq("status", "active").eq("pos_visible", true).order("name"),
        db.rpc("pos_reception_recent", { p_device_token: device, p_search: "" }),
      ]);
    }).then(([who, svc, history]) => {
      if (who.error) throw who.error;
      if (svc.error) throw svc.error;
      if (history.error) throw history.error;
      if (!cancelled) {
        setIdentity(who.data as Identity);
        setServices((svc.data || []) as ServiceOption[]);
        setReceptions(Array.isArray(history.data) ? history.data as ServiceReception[] : []);
      }
    }).catch((e) => {
      if (!cancelled) setError(errorText(e) === "SESSION_REQUIRED"
        ? "Necesitas iniciar sesión como empleado en esta terminal POS antes de abrir Recepción de equipos. El acceso de administrador no sustituye la sesión del POS."
        : "No se pudo validar la recepción: " + errorText(e) + ". Comprueba la sesión de empleado y la activación de la terminal.");
    }).finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [db]);

  function update<K extends keyof ReceptionForm>(key: K, value: ReceptionForm[K]) {
    setForm((current) => ({ ...current, [key]: value }));
    requestId.current = null;
  }

  function editEquipment(fn:(prev:EquipmentDraft[])=>EquipmentDraft[]){
    setEquipment(fn);requestId.current=null;
  }
  function editLine(index:number,line:ReceptionServiceLine,patch:Partial<{price:string;status:ServiceLineStatus}>){
    setLineEdits(old=>({...old,[index]:{...(old[index]??{price:line.price_cents===null?"":String(line.price_cents/100),status:line.status}),...patch}}));
  }
  async function saveLine(reception:ServiceReception,index:number){
    const edit=lineEdits[index];if(!edit||busy||lineSaving||!token)return;
    const cents=edit.price.trim()===""?null:Math.round(Number(edit.price)*100);
    if(cents!==null&&(!Number.isSafeInteger(cents)||cents<=0||cents>9999999900)){setError("Captura un precio válido o déjalo pendiente.");return;}
    setLineSaving(true);setError("");setNotice("");
    try{
      const {data,error}=await db.rpc("pos_reception_update_multi_line",{
        p_device_token:token,p_reception_id:reception.id,p_revision:reception.order_revision??0,
        p_line_index:index,p_price_cents:cents,p_status:edit.status});
      if(error)throw error;
      setSelected(data as ServiceReception);setLineEdits(old=>{const next={...old};delete next[index];return next;});
      setNotice("Servicio actualizado.");
      try{await refreshHistory(search.trim());}catch{/* persisted */}
    }catch(e){setError("No se pudo actualizar el servicio: "+errorText(e));}
    finally{setLineSaving(false);}
  }
  function changeAppend(patch:Partial<typeof appendDraft>){
    appendRequest.current=null;setAppendDraft(old=>({...old,...patch}));
  }
  async function appendService(reception:ServiceReception){
    if(busy||lineSaving||!token||Object.keys(lineEdits).length)return;
    const equipmentKey=appendDraft.equipment_key||(reception.order_lines?.[0]?.equipment_key??1);
    if(!appendDraft.service_product_id||!Number.isInteger(appendDraft.quantity)||appendDraft.quantity<1||appendDraft.quantity>100||appendDraft.work_description.trim().length<5){
      setError("Selecciona el servicio, cantidad y describe el trabajo adicional.");return;
    }
    setLineSaving(true);setError("");setNotice("");
    try{
      if(!appendRequest.current)appendRequest.current=crypto.randomUUID();
      const {data,error}=await db.rpc("pos_reception_append_service",{p_device_token:token,p_reception_id:reception.id,
        p_revision:reception.order_revision??0,p_request_id:appendRequest.current,p_equipment_key:equipmentKey,
        p_service_product_id:appendDraft.service_product_id,p_quantity:appendDraft.quantity,p_work_description:appendDraft.work_description.trim()});
      if(error)throw error;
      setSelected(data as ServiceReception);setLineEdits({});changeAppend({equipment_key:0,service_product_id:"",quantity:1,work_description:""});
      setNotice("Servicio agregado al mismo folio. Pendiente de cotización y autorización.");
      try{await refreshHistory(search.trim());}catch{/* already persisted */}
    }catch(e){setError("No se pudo agregar el servicio: "+errorText(e)+". Consulta el folio si hay duda sobre el guardado.");}
    finally{setLineSaving(false);}
  }
  useEffect(()=>{
    if(!focusReception)return;
    const r=focusReception.reception;
    let cancelled=false;
    void Promise.resolve().then(()=>{
      if(cancelled)return;
      historySequence.current+=1;
      if(searchTimer.current!==null)clearTimeout(searchTimer.current);
      searchTimer.current=null;
      appendRequest.current=null;
      setSelected(r);setLineEdits({});setAppendDraft({equipment_key:0,service_product_id:"",quantity:1,work_description:""});
      setSearch(receptionFolio(r.receipt_number));setSearching(false);setWorkspaceMode("service");
      window.requestAnimationFrame(()=>selectedDetailRef.current?.scrollIntoView({block:"nearest"}));
    });
    return ()=>{cancelled=true;};
  },[focusReception]);
  function revealSelection() {
    window.requestAnimationFrame(() => selectedDetailRef.current?.scrollIntoView({
      behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth",
      block: "nearest",
    }));
  }

  function invalidateHistorySearch() {
    historySequence.current += 1;
    if (searchTimer.current !== null) clearTimeout(searchTimer.current);
    searchTimer.current = null;
    return historySequence.current;
  }

  async function readHistory(query: string, sequence: number) {
    const { data, error: historyError } = await db.rpc("pos_reception_recent", {
      p_device_token: token, p_search: receptionSearchTerm(query),
    });
    if (sequence !== historySequence.current) return;
    if (historyError) throw historyError;
    const rows = Array.isArray(data) ? data as ServiceReception[] : [];
    setReceptions(rows);
    // Keep the selected receipt current when it is included in the new authorized read.
    setSelected(previous => rows.find(row => row.id === previous?.id) || previous);
  }

  async function refreshHistory(query = "") {
    const sequence = invalidateHistorySearch();
    try { await readHistory(query, sequence); }
    finally { if (sequence === historySequence.current) setSearching(false); }
  }

  function changeHistorySearch(value: string) {
    setSearch(value);
    const sequence = invalidateHistorySearch();
    setHistoryError("");
    setSearching(true);
    searchTimer.current = setTimeout(() => {
      searchTimer.current = null;
      void readHistory(value.trim(), sequence)
        .catch(e => {
          if (sequence === historySequence.current) setHistoryError("No se pudo consultar el historial: " + errorText(e));
        })
        .finally(() => { if (sequence === historySequence.current) setSearching(false); });
    }, 300);
  }

  async function searchHistory(e: FormEvent) {
    e.preventDefault();
    setSearching(true); setHistoryError("");
    try { await refreshHistory(search.trim()); }
    catch (e) { setHistoryError("No se pudo consultar el historial: " + errorText(e)); }
  }

  async function register(e: FormEvent) {
    e.preventDefault();
    if (!identity || !token || busy) return;
    const lines:ReceptionServiceInput[]=equipment.flatMap(eq=>eq.services.map(s=>({
      equipment_key:eq.key,equipment_description:eq.equipment_description.trim(),
      condition_notes:eq.condition_notes.trim(),accessories:eq.accessories.trim()||"No especificados",
      service_product_id:s.service_product_id,work_description:s.work_description.trim(),quantity:s.quantity,
    })));
    if(!lines.length||lines.length>MAX_RECEPTION_LINES||lines.some(l=>!l.service_product_id||!Number.isInteger(l.quantity)||l.quantity<1||l.quantity>100)){
      setError("Selecciona todos los servicios y revisa las cantidades.");return;
    }
    setBusy(true); setError(""); setNotice("");
    try {
      if (!requestId.current) requestId.current = crypto.randomUUID();
      const payload = {
        p_device_token: token, p_request_id: requestId.current,
        p_customer_name: form.customer_name.trim(), p_customer_phone: form.customer_phone.trim(),
        p_lines:lines,
      };
      const {data,error:saveError}=await db.rpc("pos_reception_create_multi",payload);
      if (saveError) throw saveError;
      const saved = data as ServiceReception;
      setSelected(saved);
      revealSelection();
      setForm(blank); setEquipment([blankEquipment(1)]); setLineEdits({}); changeAppend({equipment_key:0,service_product_id:"",quantity:1,work_description:""});
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
        body: JSON.stringify({ reception: receptionPrintView(reception) }),
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
  const historyCounts = useMemo(() => ({
    all: receptions.length,
    received: receptions.filter(row => row.status === "received").length,
    ready: receptions.filter(row => row.status === "ready").length,
    delivered: receptions.filter(row => row.status === "delivered").length,
  }), [receptions]);
  const visibleReceptions = useMemo(() => statusFilter === "all" ? receptions :
    receptions.filter(row => row.status === statusFilter), [receptions, statusFilter]);
  if (workspaceMode === "consignment") return (
    <main className={`${styles.shell}${embedded ? ` ${styles.embedded}` : ""}`}>
      <div className={styles.wrap}>
        <ConsignmentWorkspace db={db} onReturnToService={() => setWorkspaceMode("service")} />
      </div>
    </main>
  );
  return (
    <main className={`${styles.shell}${embedded ? ` ${styles.embedded}` : ""}`}>
      <div className={styles.wrap}>
        <header className={styles.header}>
          <div>
            <div className={styles.kicker}>UP AND DOWN · POS / TALLER</div>
            <h1>Recepción de equipos</h1>
            <p>Recepción, preparación y entrega con cobro posterior desde el POS. Registrar no genera venta ni afecta existencias.</p>
          </div>
          {embedded && onReturnToPos
            ? <button type="button" className={styles.back} onClick={onReturnToPos}>← Volver al POS</button>
            : <a href="/pos" className={styles.back}>← Iniciar sesión / volver al POS</a>}
        </header>
        <nav className={styles.filterGroup} aria-label="Tipo de recepción" style={{ marginBottom: 21 }}>
          <button className={`${styles.filterButton} ${styles.filterActive}`} aria-current="page" type="button">🔧 Equipo para servicio</button>
          <button className={styles.filterButton} type="button" onClick={() => setWorkspaceMode("consignment")}>🏷️ Recibir a consignación</button>
        </nav>
        {loading && <div className={styles.success}>Validando sesión de empleado y terminal...</div>}
        {error && <div className={styles.alert} role="alert">{error}</div>}
        {notice && <div className={styles.success} role="status">{notice}</div>}
        {canWork && (
          <div className={styles.grid}>
            <section className={styles.panel}>
              <h2>Nueva recepción</h2>
              <p className={styles.muted}>Recibe uno o varios equipos en un solo folio. Agrega todos los servicios solicitados.</p>
              <form onSubmit={register} className={styles.fields}>
                <div className={styles.pair}>
                  <div className={styles.field}><label htmlFor="reception-client">Cliente</label>
                    <input id="reception-client" required minLength={2} maxLength={140} value={form.customer_name}
                      onChange={(e) => update("customer_name", e.target.value)} placeholder="Nombre completo" /></div>
                  <div className={styles.field}><label htmlFor="reception-phone">Teléfono / WhatsApp</label>
                    <input id="reception-phone" required minLength={7} maxLength={30} type="tel" value={form.customer_phone}
                      onChange={(e) => update("customer_phone", e.target.value)} placeholder="624 000 0000" /></div>
                </div>
                <fieldset disabled={busy} style={{border:0,padding:0,margin:0,minWidth:0}}>
                  {equipment.map((eq,ei)=><fieldset key={eq.key} style={{border:"1px solid #d4e4d8",borderRadius:12,padding:12,margin:"0 0 12px",minWidth:0}}>
                    <legend><strong>Equipo {ei+1}</strong></legend>
                    <div className={styles.fields}>
                    {(["equipment_description","condition_notes","accessories"] as const).map((key,i)=><div className={styles.field} key={key}>
                      <label htmlFor={key+eq.key}>{["Equipo recibido","Condición al recibir","Accesorios (opcional)"][i]}</label>
                      <input id={key+eq.key} required={i!==2} minLength={i===2?0:3} maxLength={i===2?120:240}
                        value={eq[key]} onChange={e=>editEquipment(old=>old.map(x=>x.key===eq.key?{...x,[key]:e.target.value}:x))}/>
                    </div>)}
                    {eq.services.map((line,si)=><div key={si} className={styles.fields} style={{borderTop:"1px solid #e2e8e3",paddingTop:8}}>
                      <div className={styles.field}><label htmlFor={"service-"+eq.key+"-"+si}>Servicio {si+1}</label>
                        <select id={"service-"+eq.key+"-"+si} required value={line.service_product_id}
                          onChange={e=>editEquipment(old=>old.map(x=>x.key===eq.key?{...x,services:x.services.map((s,j)=>j===si?{...s,service_product_id:e.target.value}:s)}:x))}>
                          <option value="">Selecciona un servicio del POS</option>
                          {services.map(s=><option key={s.id} value={s.id}>{s.name} · {s.sku}</option>)}
                        </select></div>
                      <div className={styles.field}><label htmlFor={"qty-"+eq.key+"-"+si}>Cantidad</label>
                        <input id={"qty-"+eq.key+"-"+si} type="number" min={1} max={100} step={1} required value={line.quantity||""}
                          onChange={e=>editEquipment(old=>old.map(x=>x.key===eq.key?{...x,services:x.services.map((s,j)=>j===si?{...s,quantity:Number(e.target.value)}:s)}:x))}/></div>
                      <div className={styles.field}><label htmlFor={"work-"+eq.key+"-"+si}>Trabajo solicitado</label>
                        <textarea id={"work-"+eq.key+"-"+si} required minLength={5} maxLength={240} rows={2} value={line.work_description}
                          onChange={e=>editEquipment(old=>old.map(x=>x.key===eq.key?{...x,services:x.services.map((s,j)=>j===si?{...s,work_description:e.target.value}:s)}:x))}/></div>
                      {eq.services.length>1&&<button className={styles.secondary} type="button" onClick={()=>editEquipment(old=>old.map(x=>x.key===eq.key?{...x,services:x.services.filter((_,j)=>j!==si)}:x))}>Quitar servicio</button>}
                    </div>)}
                    <button className={styles.secondary} type="button" disabled={equipment.reduce((n,x)=>n+x.services.length,0)>=MAX_RECEPTION_LINES}
                      onClick={()=>editEquipment(old=>old.map(x=>x.key===eq.key?{...x,services:[...x.services,{service_product_id:"",work_description:"",quantity:1}]}:x))}>+ Agregar servicio</button>
                    {equipment.length>1&&<button className={styles.secondary} type="button" onClick={()=>editEquipment(old=>old.filter(x=>x.key!==eq.key))}>Quitar equipo</button>}
                    </div>
                  </fieldset>)}
                  <button className={styles.secondary} type="button" disabled={equipment.reduce((n,x)=>n+x.services.length,0)>=MAX_RECEPTION_LINES}
                    onClick={()=>editEquipment(old=>[...old,blankEquipment(Math.max(...old.map(x=>x.key))+1)])}>+ Agregar otro equipo</button>
                  {!services.length&&<small>No hay servicios activos en el catálogo POS.</small>}
                  <p className={styles.muted}>{equipment.length} equipo(s) · {equipment.reduce((n,x)=>n+x.services.length,0)} servicio(s) · Precio por cotizar</p>
                </fieldset>
                <div className={styles.actions}>
                  <button className={styles.primary} disabled={busy || !services.length}>
                    {busy ? "Registrando..." : "Registrar recepción"}
                  </button>
                </div>
              </form>
              <p className={styles.footnote}>Recibe: #{identity.employee_number} {identity.employee_name} · {identity.terminal_name}. No hace falta turno de caja abierto. Las recepciones guardadas no se editan silenciosamente.</p>
            </section>
            <aside className={styles.panel}>
              <h2>Consultar recepciones</h2>
              <p className={styles.muted}>Busca por folio, cliente, teléfono o equipo mientras escribes. Selecciona un resultado para consultar o reimprimir.</p>
              <form onSubmit={searchHistory} className={styles.actions}>
                <input aria-label="Buscar recepciones" className={styles.search} maxLength={80}
                  value={search} onChange={(e) => changeHistorySearch(e.target.value)} placeholder="Folio, nombre, teléfono o equipo" />
                <button className={styles.secondary} disabled={searching} type="submit">Buscar</button>
                {search && <button className={styles.secondary} type="button" onClick={() => changeHistorySearch("")}>Limpiar</button>}
              </form>
              {searching && <p role="status" className={styles.historyStatus}>Actualizando recepciones…</p>}
              {historyError && <p role="alert" className={styles.alert}>{historyError} La lista anterior permanece visible; vuelve a intentar la consulta.</p>}
              <div className={styles.filterGroup} role="group" aria-label="Filtrar por estado en resultados">
                {([
                  ["all", "Todas"], ["received", "Recibidas"],
                  ["ready", "Listas"], ["delivered", "Entregadas"],
                ] as const).map(([key, label]) => (
                  <button key={key} type="button" aria-pressed={statusFilter === key}
                    className={`${styles.filterButton} ${statusFilter === key ? styles.filterActive : ""}`}
                    onClick={() => setStatusFilter(key)}>{label} <span>{historyCounts[key]}</span></button>
                ))}
              </div>
              <p className={styles.filterHint}>Estados de los {historyCounts.all} resultados cargados; el filtro no cambia datos.</p>
              {selected && (
                <section ref={selectedDetailRef} className={styles.saved} aria-label="Detalle de recepción">
                  <div className={styles.selectedHeading}>
                    <div>
                      <span className={styles.selectedLabel}>Recepción seleccionada</span>
                      <strong>{receptionFolio(selected.receipt_number)}</strong>
                    </div>
                    <span className={`${styles.statusTag} ${selected.status === "ready" ? styles.statusReady : selected.status === "delivered" ? styles.statusDelivered : ""}`}>
                      {selected.status === "delivered" ? "Entregado y cobrado" : selected.status === "ready" ? "Listo para entregar" : "Recibido"}
                    </span>
                  </div>
                  <p className={styles.selectedSummary}>{selected.customer_name} · {selected.order_lines?.length ? new Set(selected.order_lines.map(l=>l.equipment_key)).size+" equipo(s)" : selected.equipment_description}</p>
                  <p className={styles.selectedSummary}>{selected.status === "delivered" ?
                    "Entrega registrada en POS. Este folio no sustituye el comprobante de pago." :
                    "El servicio se cobra posteriormente en caja."}</p>
                  {selected.status === "delivered" && selected.checkout_sale_id &&
                    <small>Venta vinculada: {selected.checkout_sale_id}</small>}
                  <details className={styles.selectedDetails}>
                    <summary>Ver datos originales del equipo y servicio</summary>
                    <dl>
                      <div><dt>Recibido</dt><dd>{receptionDate(selected.received_at)}</dd></div>
                      <div><dt>Teléfono</dt><dd>{selected.customer_phone}</dd></div>
                      {!selected.order_lines?.length && <><div><dt>Servicio</dt><dd>{selected.service_name}</dd></div>
                      <div><dt>Trabajo solicitado</dt><dd>{selected.work_description}</dd></div>
                      <div><dt>Condición al recibir</dt><dd>{selected.condition_notes}</dd></div>
                      <div><dt>Accesorios</dt><dd>{selected.accessories}</dd></div></>}
                      <div><dt>Recibió</dt><dd>#{selected.employee_number} {selected.employee_name} · {selected.terminal_name}</dd></div>
                    </dl>
                  </details>
                  {selected.order_lines?.map((line,i)=>{
                    const edit=lineEdits[i];
                    const canQuote=identity?.employee_role==="pos_admin"||identity?.employee_role==="supervisor";
                    return <div key={i} className={styles.fields} style={{borderTop:"1px solid #d4e4d8",paddingTop:8,marginTop:10}}>
                      <strong>Equipo {line.equipment_key} · {line.equipment_description}</strong>
                      <span>{line.service_name} × {line.quantity} · {receptionLineAmount(line)} · {receptionLineStatuses[line.status]}</span>
                      <small>{line.work_description} · Condición: {line.condition_notes} · Accesorios: {line.accessories}</small>
                      {selected.status==="received"&&line.status!=="cancelled"&&<div className={styles.fields}>
                        <div className={styles.field}><label htmlFor={"price-"+i}>Precio unitario (MXN, vacío = por cotizar)</label>
                          <input id={"price-"+i} type="number" min="0.01" max="99999999" step="0.01" disabled={lineSaving||!canQuote}
                            value={edit?.price??(line.price_cents===null?"":String(line.price_cents/100))}
                            onChange={e=>editLine(i,line,{price:e.target.value})}/></div>
                        <div className={styles.field}><label htmlFor={"state-"+i}>Estado del trabajo</label>
                          <select id={"state-"+i} disabled={lineSaving} value={edit?.status??line.status} onChange={e=>editLine(i,line,{status:e.target.value as ServiceLineStatus})}>
                            {Object.entries(receptionLineStatuses).map(([value,label])=><option key={value} value={value} disabled={!canQuote&&(value==="approved"||value==="cancelled")&&value!==line.status}>{label}</option>)}
                          </select></div>
                        <button type="button" className={styles.secondary} disabled={!edit||lineSaving||busy} onClick={()=>void saveLine(selected,i)}>Guardar servicio</button>
                      </div>}
                    </div>;
                  })}
                  {!!selected.order_lines?.length&&<p><strong>Total cotizado:</strong> {new Intl.NumberFormat("es-MX",{style:"currency",currency:"MXN"}).format(selected.order_lines.reduce((n,l)=>n+(l.status==="cancelled"?0:(l.price_cents??0)*l.quantity),0)/100)}
                    {selected.order_lines.some(l=>l.status!=="cancelled"&&l.price_cents===null)?" + servicios por cotizar":""}</p>}
                  {selected.status!=="delivered"&&(selected.order_lines?.length??1)<MAX_RECEPTION_LINES&&<fieldset disabled={busy||lineSaving||Object.keys(lineEdits).length>0} className={styles.fields} style={{border:"1px solid #d4e4d8",borderRadius:12,padding:12,minWidth:0,margin:"12px 0"}}>
                    <legend><strong>+ Agregar servicio a esta recepción</strong></legend>
                    {selected.status==="ready"&&<small>Al agregar un servicio, el folio volverá a estar pendiente de entrega.</small>}
                    {!selected.order_lines?.length&&<small>El servicio original también quedará pendiente de cotizar y autorizar.</small>}
                    <div className={styles.field}><label htmlFor="append-equipment">Equipo</label>
                      <select id="append-equipment" value={appendDraft.equipment_key||(selected.order_lines?.[0]?.equipment_key??1)} onChange={e=>changeAppend({equipment_key:Number(e.target.value)})}>
                      {(selected.order_lines?.length?[...new Map(selected.order_lines.map(l=>[l.equipment_key,l.equipment_description])).entries()]:[[1,selected.equipment_description]] as [number,string][]).map(([key,description])=><option key={key} value={key}>Equipo {key} · {description}</option>)}
                      </select></div>
                    <div className={styles.field}><label htmlFor="append-service">Servicio adicional</label><select id="append-service" value={appendDraft.service_product_id} onChange={e=>changeAppend({service_product_id:e.target.value})}>
                      <option value="">Selecciona un servicio</option>{services.map(s=><option key={s.id} value={s.id}>{s.name} · {s.sku}</option>)}</select></div>
                    <div className={styles.field}><label htmlFor="append-quantity">Cantidad adicional</label><input id="append-quantity" type="number" min={1} max={100} step={1} value={appendDraft.quantity||""} onChange={e=>changeAppend({quantity:Number(e.target.value)})}/></div>
                    <div className={styles.field}><label htmlFor="append-work">Trabajo adicional solicitado</label><textarea id="append-work" maxLength={240} rows={2} value={appendDraft.work_description} onChange={e=>changeAppend({work_description:e.target.value})}/></div>
                    <button type="button" className={styles.secondary} disabled={!appendDraft.service_product_id||appendDraft.work_description.trim().length<5} onClick={()=>void appendService(selected)}>Vincular servicio al folio</button>
                  </fieldset>}
                  <div className={styles.actions}>
                    {selected.status === "received" &&
                      <button type="button" className={styles.primary} disabled={busy||lineSaving||Object.keys(lineEdits).length>0||!!(selected.order_lines?.length&&(()=>{try{receptionChargeGroups(selected.order_lines??[]);return false;}catch{return true;}})())}
                        onClick={() => void markReady(selected)}>✓ Listo para entregar</button>}
                    {selected.status === "ready" && (embedded && onCheckoutFolio
                      ? <button type="button" className={styles.primary}
                          onClick={() => onCheckoutFolio(receptionFolio(selected.receipt_number))}>Escanear y cobrar en POS</button>
                      : <a href={"/pos?recepcion=" + encodeURIComponent(receptionFolio(selected.receipt_number))}
                           className={styles.primary} style={{textDecoration:"none",display:"inline-flex",alignItems:"center"}}>
                          Escanear y cobrar en POS
                        </a>)}
                    <button type="button" className={styles.primary} disabled={printing} onClick={() => void printThermal(selected)}>
                      {printing ? "Enviando..." : "Imprimir 2 tickets térmicos"}
                    </button>
                    <button type="button" className={styles.secondary} onClick={() => pdf(selected, true)}>PDF dos copias</button>
                    <button type="button" className={styles.secondary} onClick={() => pdf(selected, false)}>Descargar PDF</button>
                  </div>
                </section>
              )}
              <div className={styles.list} aria-busy={searching}>
                {visibleReceptions.map(r => (
                  <button type="button" key={r.id} aria-pressed={selected?.id === r.id}
                    className={`${styles.item} ${selected?.id === r.id ? styles.itemActive : ""}`}
                    disabled={busy||lineSaving} onClick={() => { setSelected(r); setLineEdits({}); changeAppend({equipment_key:0,service_product_id:"",quantity:1,work_description:""}); setNotice("Recepción " + receptionFolio(r.receipt_number) + " seleccionada para reimpresión."); revealSelection(); }}>
                    <span className={styles.itemLine}><strong>{r.customer_name}</strong><span className={styles.folio}>{receptionFolio(r.receipt_number)}</span></span>
                    <small>{r.order_lines?.length ? new Set(r.order_lines.map(l=>l.equipment_key)).size+" equipo(s) · "+r.order_lines.length+" servicio(s)" : r.equipment_description+" · "+r.service_name}</small>
                    <small>{receptionDate(r.received_at)} · <span className={`${styles.statusTag} ${r.status === "ready" ? styles.statusReady : r.status === "delivered" ? styles.statusDelivered : ""}`}>
                      {r.status==="delivered"?"Entregado y cobrado":r.status==="ready"?"Listo para entregar":"Recibido"}
                    </span></small>
                  </button>
                ))}
                {!visibleReceptions.length && <div className={styles.empty}>
                  {receptions.length ? "No hay recepciones de este estado entre los resultados cargados." : "No hay recepciones para mostrar."}
                </div>}
              </div>
            </aside>
          </div>
        )}
      </div>
    </main>
  );
}
