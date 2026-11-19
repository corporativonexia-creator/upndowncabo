import {buildPosCatalog, type PosProduct, type PosVariant} from "@/lib/pos/catalog";

export type InventorySnapshotRow = {
  product_id: string;
  product_name: string;
  variant_id: string | null;
  variant_title: string;
  sku: string | null;
  stock: number | null;
};

export type ReconciliationFinding = {
  id: string;
  name: string;
  sku: string;
  reason: string;
};

export type InventoryReconciliationResult = {
  inventoryVariants: number;
  inventoryParents: number;
  projectedPosItems: number;
  projectedPosParents: number;
  matchingVariants: number;
  onlyInventory: ReconciliationFinding[];
  onlyPos: ReconciliationFinding[];
  stockDifferences: Array<ReconciliationFinding & {inventoryStock:number;posStock:number}>;
  duplicateInventoryIds: string[];
};

/** Compares visible read snapshots only. It does not infer missing data from RLS-limited reads. */
export function reconcileInventoryPos(
  inventory: InventorySnapshotRow[],
  allParents: PosProduct[],
  allVariants: PosVariant[],
): InventoryReconciliationResult {
  // Match the actual POS query: status='active' AND pos_visible=true, not the
  // looser visibility default used inside buildPosCatalog for compatibility.
  const eligibleParents=allParents.filter(p=>p.status==="active"&&p.pos_visible===true);
  const projected=buildPosCatalog(eligibleParents,allVariants);
  const parentsById=new Map(allParents.map(p=>[p.id,p]));
  const variantsById=new Map(allVariants.map(v=>[v.id,v]));
  const inventoryByVariant=new Map<string,InventorySnapshotRow>();
  const duplicateInventoryIds:string[]=[];
  for(const row of inventory){
    if(!row.variant_id)continue;
    if(inventoryByVariant.has(row.variant_id))duplicateInventoryIds.push(row.variant_id);
    else inventoryByVariant.set(row.variant_id,row);
  }
  const posVariants=new Map(projected.filter(p=>p.variant_id).map(p=>[p.variant_id!,p]));
  const onlyPos:ReconciliationFinding[]=[];
  const stockDifferences:InventoryReconciliationResult["stockDifferences"]=[];
  for(const item of projected){
    const found=item.variant_id?inventoryByVariant.get(item.variant_id):undefined;
    if(!found){
      onlyPos.push({id:item.variant_id||item.id,name:item.name,sku:item.sku||"—",
        reason:item.variant_id?"Variante del POS no presente en el catálogo de inventario":"Artículo POS sin variantes (producto independiente o servicio)"});
      continue;
    }
    const inventoryStock=Number(found.stock),posStock=Number(item.stock);
    if(found.stock!=null&&item.stock!=null&&Number.isFinite(inventoryStock)&&Number.isFinite(posStock)&&inventoryStock!==posStock){
      stockDifferences.push({id:item.variant_id!,name:item.name,sku:item.sku||"—",
        reason:"Existencias distintas entre lecturas",inventoryStock,posStock});
    }
  }
  const onlyInventory:ReconciliationFinding[]=[];
  for(const row of inventory){
    if(row.variant_id&&posVariants.has(row.variant_id))continue;
    const parent=parentsById.get(row.product_id);
    const variant=row.variant_id?variantsById.get(row.variant_id):undefined;
    let reason="Verificar composición de catálogo y permisos";
    if(!parent)reason="Producto padre no visible en la consulta";
    else if(parent.status!=="active")reason="Producto padre no activo";
    else if(parent.pos_visible!==true)reason="Producto oculto en POS";
    else if(variant?.is_active===false)reason="Variante inactiva para POS";
    else if(row.variant_id&&!variant)reason="Variante no visible en la consulta";
    onlyInventory.push({id:row.variant_id||row.product_id,name:[row.product_name,row.variant_title].filter(Boolean).join(" · "),sku:row.sku||"—",reason});
  }
  return {
    inventoryVariants:inventory.length,
    inventoryParents:new Set(inventory.map(r=>r.product_id)).size,
    projectedPosItems:projected.length,
    projectedPosParents:new Set(projected.map(p=>p.parent_id||p.id)).size,
    matchingVariants:[...posVariants.keys()].filter(id=>inventoryByVariant.has(id)).length,
    onlyInventory,onlyPos,stockDifferences,duplicateInventoryIds,
  };
}
