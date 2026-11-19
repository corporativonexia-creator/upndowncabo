"use client";

import {useMemo,useState} from "react";
import {createClient} from "@/lib/supabase/client";
import {readAllPages,type PosProduct,type PosVariant} from "@/lib/pos/catalog";
import {reconcileInventoryPos,type InventoryReconciliationResult,type InventorySnapshotRow,type ReconciliationFinding} from "@/lib/admin/inventory-reconciliation";

const LIMIT=30;

function Findings({title,rows}:{title:string;rows:ReconciliationFinding[]}){
  return <details className="inv-reconcile-details"><summary>{title} ({rows.length})</summary>
    {!rows.length?<p>Sin diferencias visibles.</p>:<>
      <ul>{rows.slice(0,LIMIT).map((item,index)=><li key={`${item.id}-${index}`}>
        <b>{item.name}</b> · <code>{item.sku}</code><small>{item.reason}</small>
      </li>)}</ul>
      {rows.length>LIMIT&&<p>Se muestran las primeras {LIMIT} referencias. No se ha descartado ninguna del conteo.</p>}
    </>}
    <style jsx>{`
      .inv-reconcile-details{border:1px solid #e3ece5;border-radius:12px;padding:12px;min-width:0}
      summary{font-size:12px;font-weight:800;cursor:pointer}
      ul{padding-left:17px;margin:12px 0}li{font-size:11px;line-height:1.5;margin:9px 0}
      small{display:block;color:#698074}p{font-size:11px;color:#698074}
    `}</style>
  </details>;
}

export default function InventoryReconciliation(){
  const db=useMemo(()=>createClient(),[]);
  const [open,setOpen]=useState(false),[loading,setLoading]=useState(false);
  const [report,setReport]=useState<InventoryReconciliationResult|null>(null),[error,setError]=useState("");

  async function inspect(){
    setLoading(true);setError("");
    try{
      // Completely read-only and on demand. Pagination mirrors POS and avoids
      // mistaking the first PostgREST page for a complete comparison.
      const [{data,error:catalogError},parents,variants]=await Promise.all([
        db.rpc("admin_inventory_catalog"),
        readAllPages<PosProduct>((from,to)=>db.from("products")
          .select("id,name,sku,barcode,brand,model,price,sale_price,currency,stock,cover_image_url,status,pos_visible,category_id,is_service")
          .order("id").range(from,to)),
        readAllPages<PosVariant>((from,to)=>db.from("product_variants")
          .select("id,product_id,sku,barcode,title,attributes,price,sale_price,stock,is_active")
          .order("id").range(from,to)),
      ]);
      if(catalogError)throw catalogError;
      if(!Array.isArray(data?.rows))throw Error("El catálogo de inventario no devolvió una lista verificable.");
      setReport(reconcileInventoryPos(data.rows as InventorySnapshotRow[],parents,variants));
    }catch(cause){
      setReport(null);
      // Supabase PostgREST errors are plain objects, not Error instances.
      const message=cause instanceof Error?cause.message:
        cause&&typeof cause==="object"&&"message" in cause&&typeof cause.message==="string"?cause.message:"";
      setError(message||"No se pudo completar la comparación. Revisa permisos y conexión.");
    }finally{setLoading(false);}
  }

  return <section className="inv-reconcile" aria-label="Conciliación de inventario y POS">
    <div className="inv-reconcile-header"><div><strong>Conciliación de catálogo</strong><p>Compara las variantes visibles de Inventario con los artículos que el código del POS ofrecería para venta.</p></div>
      <button type="button" disabled={loading} onClick={()=>{if(open){setOpen(false);}else{setOpen(true);void inspect();}}}>{loading?"Consultando…":open?"Cerrar conciliación":"Conciliar con POS"}</button>
    </div>
    {open&&<div className="inv-reconcile-body">
      <p className="inv-reconcile-caution">Diagnóstico de solo lectura. Es una proyección de las reglas de catálogo, no una sesión POS activa. Las políticas RLS y cambios entre consultas pueden limitar la comparación; un resultado vacío no prueba inexistencia de registros.</p>
      {error&&<p role="alert" className="inv-reconcile-error">{error}</p>}
      {loading&&<p role="status">Leyendo páginas de productos, variantes e inventario…</p>}
      {report&&!loading&&<>
        <div className="inv-reconcile-stats">
          <div><small>Variantes en inventario</small><b>{report.inventoryVariants}</b></div>
          <div><small>Productos padre en inventario</small><b>{report.inventoryParents}</b></div>
          <div><small>Artículos POS proyectados</small><b>{report.projectedPosItems}</b></div>
          <div><small>Productos padre en POS</small><b>{report.projectedPosParents}</b></div>
          <div><small>Variantes coincidentes</small><b>{report.matchingVariants}</b></div>
        </div>
        <div className="inv-reconcile-findings">
          <Findings title="Solo en inventario" rows={report.onlyInventory}/>
          <Findings title="Solo en proyección POS" rows={report.onlyPos}/>
          <Findings title="Existencias diferentes" rows={report.stockDifferences.map(item=>({...item,reason:`Inventario ${item.inventoryStock} · POS ${item.posStock}`}))}/>
        </div>
        {!!report.duplicateInventoryIds.length&&<p role="alert" className="inv-reconcile-error">La respuesta de inventario repite {report.duplicateInventoryIds.length} identificadores de variante. Revisa el origen antes de interpretar los totales.</p>}
        <div className="inv-reconcile-footer"><span>No se registra ni ajusta ninguna existencia, venta, precio, SKU o UPC.</span><button type="button" onClick={()=>{void inspect();}}>↻ Volver a comparar</button></div>
      </>}
    </div>}
    <style jsx>{`
      .inv-reconcile{margin:0 0 18px;padding:17px 20px;border:1px solid #dce8df;border-radius:18px;background:#fff;color:#123d32;box-shadow:0 8px 24px rgba(18,61,50,.04)}
      .inv-reconcile-header{display:flex;align-items:center;justify-content:space-between;gap:20px}.inv-reconcile-header strong{font-size:15px}.inv-reconcile-header p{margin:5px 0 0;font-size:11px;color:#617369}
      button{border:1px solid #123d32;background:#123d32;color:#fff;padding:10px 15px;border-radius:12px;font-weight:800;font-size:11px;cursor:pointer;white-space:nowrap}button:disabled{opacity:.55;cursor:wait}
      .inv-reconcile-body{margin-top:15px;border-top:1px solid #e5ede8;padding-top:15px}.inv-reconcile-caution{padding:11px;background:#f6f8f6;border-radius:10px;font-size:11px;line-height:1.5;color:#506a5d}.inv-reconcile-error{color:#963b2b;font-size:12px}
      .inv-reconcile-stats{display:grid;grid-template-columns:repeat(5,minmax(0,1fr));gap:9px;margin:14px 0}.inv-reconcile-stats>div{padding:12px;border:1px solid #e3ece5;border-radius:12px;background:#f6f8f6}.inv-reconcile-stats small{display:block;color:#5b7366;font-size:10px}.inv-reconcile-stats b{display:block;margin-top:7px;font-size:22px}
      .inv-reconcile-findings{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:12px}.inv-reconcile-details{border:1px solid #e3ece5;border-radius:12px;padding:12px;min-width:0}.inv-reconcile-details summary{font-size:12px;font-weight:800;cursor:pointer}.inv-reconcile-details ul{padding-left:17px;margin:12px 0}.inv-reconcile-details li{font-size:11px;line-height:1.5;margin:9px 0}.inv-reconcile-details small{display:block;color:#698074}.inv-reconcile-details p{font-size:11px;color:#698074}.inv-reconcile-footer{display:flex;align-items:center;justify-content:space-between;gap:12px;margin-top:14px}.inv-reconcile-footer span{font-size:10px;color:#698074}.inv-reconcile-footer button{background:#fff;color:#123d32}
      @media(max-width:850px){.inv-reconcile-header,.inv-reconcile-footer{align-items:flex-start;flex-direction:column}.inv-reconcile-stats{grid-template-columns:repeat(2,minmax(0,1fr))}.inv-reconcile-findings{grid-template-columns:1fr}.inv-reconcile-header button{width:100%}}
    `}</style>
  </section>;
}
