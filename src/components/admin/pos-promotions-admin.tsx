"use client";
import { FormEvent, useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";

type Promotion={id:string;name:string;target_type:"code"|"category";category_id:string|null;code:string|null;discount_percent:number;start_date:string;end_date:string;active:boolean};
type Category={id:string;name:string};
type Form={name:string;target_type:"code"|"category";category_id:string;code:string;discount_percent:string;start_date:string;end_date:string;active:boolean};
const initial:Form={name:"",target_type:"category",category_id:"",code:"",discount_percent:"10",start_date:"",end_date:"",active:true};
export default function PosPromotionsAdmin(){
 const db=useMemo(()=>createClient(),[]);
 const [items,setItems]=useState<Promotion[]>([]);
 const [categories,setCategories]=useState<Category[]>([]);
 const [form,setForm]=useState<Form>(initial);
 const [editing,setEditing]=useState<string|null>(null);
 const [busy,setBusy]=useState(false);
 const [message,setMessage]=useState("");
 async function refresh(){
  const [promos,cats]=await Promise.all([
   db.rpc("pos22_list_promotions"),
   db.from("categories").select("id,name").eq("is_active",true).order("name")
  ]);
  if(promos.error)throw promos.error;
  if(cats.error)throw cats.error;
  setItems((promos.data||[]) as Promotion[]);
  setCategories((cats.data||[]) as Category[]);
 }
 useEffect(()=>{let alive=true;Promise.all([
   db.rpc("pos22_list_promotions"),
   db.from("categories").select("id,name").eq("is_active",true).order("name")
 ]).then(([p,c])=>{if(!alive)return;if(p.error||c.error){setMessage((p.error||c.error)?.message||"Error");return;}setItems((p.data||[]) as Promotion[]);setCategories((c.data||[]) as Category[]);});return()=>{alive=false;};},[db]);
 function edit(p:Promotion){setEditing(p.id);setForm({name:p.name,target_type:p.target_type,category_id:p.category_id||"",code:p.code||"",discount_percent:String(p.discount_percent),start_date:p.start_date,end_date:p.end_date,active:p.active});}
 async function save(e:FormEvent){e.preventDefault();setBusy(true);setMessage("");
  try{
   const {error}=await db.rpc("pos22_manage_promotion",{
    p_action:editing?"update":"create",p_id:editing,
    p_name:form.name.trim(),p_target_type:form.target_type,
    p_category_id:form.target_type==="category"?form.category_id:null,
    p_code:form.target_type==="code"?form.code.trim():null,
    p_discount_percent:Number(form.discount_percent),
    p_start_date:form.start_date,p_end_date:form.end_date,p_active:form.active
   });if(error)throw error;await refresh();setEditing(null);setForm(initial);setMessage("Promoción guardada.");
  }catch(e){setMessage(e instanceof Error?e.message:String(e));}finally{setBusy(false);}
 }
 async function deactivate(id:string){setBusy(true);setMessage("");try{
  const {error}=await db.rpc("pos22_manage_promotion",{p_action:"deactivate",p_id:id});if(error)throw error;
  await refresh();setMessage("Promoción desactivada.");
 }catch(e){setMessage(e instanceof Error?e.message:String(e));}finally{setBusy(false);}}
 const inp={padding:"10px 12px",border:"1px solid #cbd5cf",borderRadius:9,width:"100%",background:"white"};
 return <div style={{maxWidth:1100,margin:"0 auto",fontFamily:"Arial,sans-serif",color:"#143e35"}}>
  <header style={{marginBottom:22}}><small style={{letterSpacing:2,fontWeight:800}}>POS / CAJA</small><h1 style={{fontSize:32,margin:"8px 0"}}>Promociones programadas</h1><p>Configura descuentos automáticos por categoría o código para un periodo definido.</p></header>
  <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(300px,1fr))",gap:22,alignItems:"start"}}>
   <form onSubmit={save} style={{background:"#fff",padding:22,borderRadius:16,display:"grid",gap:12,boxShadow:"0 2px 18px #143e3510"}}>
    <h2 style={{fontSize:18,margin:0}}>{editing?"Editar promoción":"Nueva promoción"}</h2>
    <label>Nombre<input style={inp} required minLength={3} maxLength={120} value={form.name} onChange={e=>setForm(f=>({...f,name:e.target.value}))} placeholder="Wedges · diciembre"/></label>
    <label>Aplicar a<select style={inp} value={form.target_type} onChange={e=>setForm(f=>({...f,target_type:e.target.value as Form["target_type"],category_id:"",code:""}))}><option value="category">Categoría completa</option><option value="code">SKU o UPC específico</option></select></label>
    {form.target_type==="category"
      ?<label>Categoría<select required style={inp} value={form.category_id} onChange={e=>setForm(f=>({...f,category_id:e.target.value}))}><option value="">Seleccionar categoría</option>{categories.map(c=><option key={c.id} value={c.id}>{c.name}</option>)}</select></label>
      :<label>Código SKU o UPC<input required style={inp} value={form.code} onChange={e=>setForm(f=>({...f,code:e.target.value}))} placeholder="WED-0012 / 200000..."/></label>}
    <label>Descuento (%)<input style={inp} type="number" required min="0.01" max="100" step="0.01" value={form.discount_percent} onChange={e=>setForm(f=>({...f,discount_percent:e.target.value}))}/></label>
    <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12}}>
      <label>Desde<input style={inp} type="date" required value={form.start_date} onChange={e=>setForm(f=>({...f,start_date:e.target.value}))}/></label>
      <label>Hasta (incluido)<input style={inp} type="date" required min={form.start_date} value={form.end_date} onChange={e=>setForm(f=>({...f,end_date:e.target.value}))}/></label>
    </div>
    <label style={{display:"flex",gap:8,alignItems:"center"}}><input type="checkbox" checked={form.active} onChange={e=>setForm(f=>({...f,active:e.target.checked}))}/> Promoción activa</label>
    <button disabled={busy} type="submit" style={{border:0,borderRadius:10,padding:13,background:"#143e35",color:"white",fontWeight:800}}>{busy?"Guardando…":"Guardar promoción"}</button>
    {editing&&<button type="button" onClick={()=>{setEditing(null);setForm(initial);}}>Cancelar edición</button>}
    {message&&<p role="status">{message}</p>}
   </form>
   <section style={{background:"white",borderRadius:16,padding:22}}>
    <h2 style={{fontSize:18,marginTop:0}}>Calendario de promociones</h2>
    <p style={{fontSize:12,color:"#68736e"}}>Las promociones se registran aquí. La aplicación automática en el cobro se habilitará junto con el motor POS 2.2.</p>
    {items.length===0?<p>No hay promociones configuradas.</p>:items.map(p=><article key={p.id} style={{padding:"14px 0",borderBottom:"1px solid #e1e6e2"}}>
      <div style={{display:"flex",justifyContent:"space-between",gap:8}}><strong>{p.name}</strong><strong style={{color:"#217851"}}>{p.discount_percent}%</strong></div>
      <small>{p.target_type==="category"?categories.find(c=>c.id===p.category_id)?.name||"Categoría":p.code} · {p.start_date} al {p.end_date} · {p.active?"Activa":"Inactiva"}</small>
      <div style={{display:"flex",gap:12,marginTop:9}}><button type="button" disabled={busy} onClick={()=>edit(p)}>Editar</button>{p.active&&<button type="button" disabled={busy} onClick={()=>deactivate(p.id)}>Desactivar</button>}</div>
     </article>)}
   </section>
  </div>
 </div>;
}
