"use client";

import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import styles from "./pos22-campaigns-admin.module.css";

type Category={id:string;name:string};
type Scope="category"|"sku"|"barcode";
type Campaign={
  id:string;title:string;target_type:Scope;target_value:string;
  discount_percent:number|string;starts_on:string;ends_on:string;
  enabled:boolean;created_at:string;
};
type Service={
  id:string;name:string;sku:string;barcode:string|null;
  category_id:string|null;pos_visible:boolean;status:string;
};
function dateInCabo() {
  return new Intl.DateTimeFormat("sv-SE",{timeZone:"America/Mazatlan",year:"numeric",month:"2-digit",day:"2-digit"}).format(new Date());
}
function messageFor(error:unknown){
  if(error&&typeof error==="object"&&"message" in error)return String(error.message);
  return error instanceof Error?error.message:String(error);
}
export default function Pos22CampaignsAdmin() {
  const db=useMemo(()=>createClient(),[]);
  const [categories,setCategories]=useState<Category[]>([]);
  const [campaigns,setCampaigns]=useState<Campaign[]>([]);
  const [services,setServices]=useState<Service[]>([]);
  const [busy,setBusy]=useState(false);
  const [loading,setLoading]=useState(true);
  const [error,setError]=useState("");
  const [success,setSuccess]=useState("");
  const [editingId,setEditingId]=useState<string|null>(null);
  const [title,setTitle]=useState("");
  const [scope,setScope]=useState<Scope>("category");
  const [target,setTarget]=useState("");
  const [percent,setPercent]=useState("10");
  const [start,setStart]=useState(dateInCabo());
  const [end,setEnd]=useState(dateInCabo());
  const [serviceName,setServiceName]=useState("");
  const [serviceCategory,setServiceCategory]=useState("");

  const refresh=useCallback(async()=>{
    const [cats,promos,items]=await Promise.all([
      db.from("categories").select("id,name").eq("is_active",true).order("sort_order"),
      db.from("pos22_promotions").select("*").order("starts_on",{ascending:false}).limit(200),
      db.from("products").select("id,name,sku,barcode,category_id,pos_visible,status")
        .eq("is_service",true).order("created_at",{ascending:false}).limit(150),
    ]);
    if(cats.error)throw cats.error;
    if(promos.error)throw promos.error;
    if(items.error)throw items.error;
    setCategories((cats.data||[]) as Category[]);
    setCampaigns((promos.data||[]) as Campaign[]);
    setServices((items.data||[]) as Service[]);
    setServiceCategory(value=>value||(cats.data?.[0]?.id||""));
  },[db]);
  useEffect(()=>{
    let cancelled=false;
    void Promise.resolve().then(refresh).catch(e=>{if(!cancelled)setError(messageFor(e))})
      .finally(()=>{if(!cancelled)setLoading(false)});
    return ()=>{cancelled=true};
  },[refresh]);

  function clearForm(){
    setEditingId(null);setTitle("");setScope("category");setTarget("");
    setPercent("10");setStart(dateInCabo());setEnd(dateInCabo());
  }
  function editCampaign(c:Campaign){
    setEditingId(c.id);setTitle(c.title);setScope(c.target_type);
    setTarget(c.target_value);setPercent(String(c.discount_percent));
    setStart(c.starts_on);setEnd(c.ends_on);
    window.scrollTo({top:0,behavior:"smooth"});
  }
  async function saveCampaign(e:FormEvent<HTMLFormElement>){
    e.preventDefault();
    const value=Number(percent);
    if(!title.trim()||!target.trim()||!Number.isFinite(value)||value<=0||value>=100){
      setError("Completa nombre, producto/categoría y porcentaje válido (mayor a 0 y menor a 100).");return;
    }
    if(start>end){setError("La fecha de término debe ser igual o posterior al inicio.");return;}
    setBusy(true);setError("");setSuccess("");
    try {
      const payload={
        title:title.trim(),target_type:scope,target_value:target.trim(),
        discount_percent:value,starts_on:start,ends_on:end,updated_at:new Date().toISOString()
      };
      const {error:e}=editingId
        ? await db.from("pos22_promotions").update(payload).eq("id",editingId)
        : await db.from("pos22_promotions").insert({...payload,enabled:true});
      if(e)throw e;
      await refresh();
      setSuccess(editingId?"Campaña actualizada.":"Campaña programada correctamente.");
      clearForm();
    } catch(e){setError(messageFor(e))}
    finally{setBusy(false)}
  }
  async function toggleCampaign(c:Campaign){
    setBusy(true);setError("");setSuccess("");
    try {
      const {error:e}=await db.from("pos22_promotions")
        .update({enabled:!c.enabled,updated_at:new Date().toISOString()}).eq("id",c.id);
      if(e)throw e;
      await refresh();
      setSuccess(c.enabled?"Campaña pausada.":"Campaña activada.");
    }catch(e){setError(messageFor(e))}
    finally{setBusy(false)}
  }
  async function createService(e:FormEvent<HTMLFormElement>){
    e.preventDefault();
    if(serviceName.trim().length<2||!serviceCategory)return;
    setBusy(true);setError("");setSuccess("");
    try {
      const {data,error:e}=await db.rpc("pos22_admin_create_service",{
        p_name:serviceName.trim(),p_category_id:serviceCategory
      });
      if(e)throw e;
      await refresh();
      setServiceName("");
      setSuccess("Servicio registrado. Código "+String(data?.sku||"")+
        " · UPC "+String(data?.barcode||"")+". Se cobrará con precio libre desde el POS.");
    }catch(e){setError(messageFor(e))}
    finally{setBusy(false)}
  }
  async function toggleService(service:Service){
    setBusy(true);setError("");setSuccess("");
    try{
      const {error:e}=await db.from("products")
        .update({pos_visible:!service.pos_visible}).eq("id",service.id).eq("is_service",true);
      if(e)throw e;
      await refresh();
      setSuccess(service.pos_visible?"Servicio ocultado del POS.":"Servicio habilitado en POS.");
    }catch(e){setError(messageFor(e))}
    finally{setBusy(false)}
  }
  const now=dateInCabo();
  const categoryName=(id:string|null)=>categories.find(c=>c.id===id)?.name||"Categoría";
  const scopeText=(c:Campaign)=>c.target_type==="category"
    ? "Categoría: "+categoryName(c.target_value)
    : c.target_type==="sku"?"SKU: "+c.target_value:"UPC: "+c.target_value;
  const status=(c:Campaign)=>!c.enabled?"Pausada":now<c.starts_on?"Programada":now>c.ends_on?"Terminada":"Activa";

  return <main className={styles.page}>
    <div className={styles.container}>
      <header className={styles.header}>
        <div>
          <div className={styles.eyebrow}>UP AND DOWN CABO · ADMINISTRACIÓN POS</div>
          <h1>Promociones y servicios</h1>
          <p>Configura campañas automáticas y servicios a precio libre, sin alterar el inventario.</p>
        </div>
        <div className={styles.links}>
          <Link href="/admin">← Panel administrativo</Link>
          <Link href="/pos">Abrir POS ↗</Link>
        </div>
      </header>

      {error&&<div className={styles.error} role="alert">{error}</div>}
      {success&&<div className={styles.success} role="status">{success}</div>}
      {loading?<p>Cargando configuración…</p>:<>
        <div className={styles.columns}>
          <section className={styles.card}>
            <div className={styles.eyebrow}>01 · CAMPAÑAS</div>
            <h2>{editingId?"Editar campaña":"Programar promoción"}</h2>
            <p>Porcentaje automático al escanear un producto, SKU, UPC o categoría en sus fechas.</p>
            <form className={styles.form} onSubmit={saveCampaign}>
              <label>Nombre de la campaña
                <input required minLength={3} maxLength={120} value={title}
                  onChange={e=>setTitle(e.target.value)} placeholder="Ej. Wedges Navidad"/>
              </label>
              <label>Aplicar promoción a
                <select value={scope} onChange={e=>{setScope(e.target.value as Scope);setTarget("")}}>
                  <option value="category">Toda una categoría</option>
                  <option value="sku">Un producto por SKU</option>
                  <option value="barcode">Un producto por UPC / código de barras</option>
                </select>
              </label>
              {scope==="category"
                ? <label>Categoría
                    <select required value={target} onChange={e=>setTarget(e.target.value)}>
                      <option value="">Selecciona categoría…</option>
                      {categories.map(c=><option key={c.id} value={c.id}>{c.name}</option>)}
                    </select>
                  </label>
                : <label>{scope==="sku"?"SKU del producto":"UPC / código de barras"}
                    <input required value={target} onChange={e=>setTarget(e.target.value)}
                      placeholder={scope==="sku"?"Ej. WED-0012":"Escanea o escribe el código"}/>
                  </label>
              }
              <label>Descuento porcentual
                <div className={styles.percent}>
                  <input type="number" inputMode="decimal" min="0.01" max="99.99" step="0.01"
                    required value={percent} onChange={e=>setPercent(e.target.value)}/>
                  <span>%</span>
                </div>
              </label>
              <div className={styles.dates}>
                <label>Desde<input type="date" required value={start} onChange={e=>setStart(e.target.value)}/></label>
                <label>Hasta (inclusive)<input type="date" required min={start} value={end} onChange={e=>setEnd(e.target.value)}/></label>
              </div>
              <small>Horario de Los Cabos. Si varias campañas coinciden en un artículo, se aplica solo la de mayor porcentaje.</small>
              <div className={styles.actions}>
                <button className={styles.primary} type="submit" disabled={busy}>{busy?"Guardando…":editingId?"Guardar cambios":"Programar campaña"}</button>
                {editingId&&<button type="button" onClick={clearForm}>Cancelar edición</button>}
              </div>
            </form>
          </section>
          <section className={styles.card}>
            <div className={styles.eyebrow}>02 · SERVICIOS</div>
            <h2>Alta de servicio</h2>
            <p>El alta no lleva precio fijo ni existencias. Cajero, supervisor y administrador capturan su importe al cobrar.</p>
            <form className={styles.form} onSubmit={createService}>
              <label>Nombre / tipo de servicio
                <input required minLength={2} maxLength={180} value={serviceName}
                  onChange={e=>setServiceName(e.target.value)}
                  placeholder="Ej. Reparación especial de equipo"/>
              </label>
              <label>Categoría contable
                <select required value={serviceCategory} onChange={e=>setServiceCategory(e.target.value)}>
                  <option value="">Seleccionar categoría…</option>
                  {categories.map(c=><option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </label>
              <p className={styles.notice}>El SKU y el código EAN-13 se generan con la secuencia existente. Los servicios no modifican stock en ventas, anulaciones o devoluciones.</p>
              <button className={styles.primary} type="submit" disabled={busy}>{busy?"Procesando…":"Crear servicio"}</button>
            </form>
            <h3>Servicios registrados · {services.length}</h3>
            <div className={styles.items}>
              {services.map(service=><div className={styles.listRow} key={service.id}>
                <div><strong>{service.name}</strong><small>{categoryName(service.category_id)} · {service.sku} · {service.barcode||"Sin UPC"}</small></div>
                <button type="button" disabled={busy} onClick={()=>void toggleService(service)}>
                  {service.pos_visible?"Ocultar":"Activar"}
                </button>
              </div>)}
              {!services.length&&<p>No hay servicios dados de alta.</p>}
            </div>
          </section>
        </div>

        <section className={styles.card}>
          <div className={styles.sectionHead}>
            <div><div className={styles.eyebrow}>CALENDARIO COMERCIAL</div><h2>Promociones creadas · {campaigns.length}</h2></div>
            <button disabled={busy} onClick={()=>void refresh()}>Actualizar</button>
          </div>
          <div className={styles.items}>
            {campaigns.map(c=><div className={styles.campaignRow} key={c.id}>
              <div><strong>{c.title}</strong><small>{scopeText(c)} · {c.starts_on} al {c.ends_on}</small></div>
              <span className={styles.status} data-status={status(c)}>{status(c)}</span>
              <strong className={styles.discount}>−{Number(c.discount_percent)}%</strong>
              <div className={styles.actions}>
                <button disabled={busy} onClick={()=>editCampaign(c)}>Editar</button>
                <button disabled={busy} onClick={()=>void toggleCampaign(c)}>{c.enabled?"Pausar":"Activar"}</button>
              </div>
            </div>)}
            {!campaigns.length&&<p>No hay campañas. Crea la primera promoción arriba.</p>}
          </div>
        </section>
      </>}
    </div>
  </main>;
}
