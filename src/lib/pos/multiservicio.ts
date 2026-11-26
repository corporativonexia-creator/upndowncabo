export type ServiceLineStatus = "pending" | "approved" | "in_progress" | "finished" | "cancelled";
export type ReceptionServiceLine = {
  equipment_key: number; equipment_description: string; condition_notes: string; accessories: string;
  service_product_id: string; service_name: string; work_description: string;
  quantity: number; price_cents: number | null; status: ServiceLineStatus;
};
export type ReceptionServiceInput = Omit<ReceptionServiceLine,"service_name"|"price_cents"|"status">;
export const MAX_RECEPTION_LINES=20;
export const receptionLineStatuses={pending:"Pendiente / por cotizar",approved:"Autorizado por cliente",in_progress:"En proceso",finished:"Terminado",cancelled:"Cancelado"} as const;
export function receptionChargeGroups(lines:readonly ReceptionServiceLine[]){
  const groups=new Map<string,{productId:string;cents:number}>();
  for(const line of lines){
    if(line.status==="cancelled")continue;
    if(line.status!=="finished"||!Number.isSafeInteger(line.price_cents)||(line.price_cents??0)<=0||
       !Number.isSafeInteger(line.quantity)||line.quantity<1)throw Error("Todos los servicios deben estar terminados y cotizados.");
    const cents=(groups.get(line.service_product_id)?.cents??0)+line.price_cents!*line.quantity;
    if(!Number.isSafeInteger(cents)||cents>9999999900)throw Error("Importe de servicio fuera de rango.");
    groups.set(line.service_product_id,{productId:line.service_product_id,cents});
  }
  if(!groups.size)throw Error("La orden no tiene servicios para cobrar.");
  return [...groups.values()];
}
export function receptionLineAmount(line:ReceptionServiceLine){
  return line.price_cents===null?"Por cotizar":new Intl.NumberFormat("es-MX",{style:"currency",currency:"MXN"}).format(line.price_cents*line.quantity/100);
}
export function receptionPrintFields(lines:readonly ReceptionServiceLine[]){
  const equipment=[...new Map(lines.map(l=>[l.equipment_key,l])).values()];
  const label=(l:ReceptionServiceLine)=>"Equipo "+l.equipment_key;
  const join=(v:string[])=>v.join(" | ");
  return {
    equipment_description:join(equipment.map(l=>label(l)+": "+l.equipment_description)),
    service_name:join(lines.map(l=>label(l)+": "+l.service_name+" x"+l.quantity+" ("+(l.status==="cancelled"?"Cancelado":receptionLineAmount(l))+")")),
    work_description:join(lines.map(l=>label(l)+" / "+l.service_name+": "+l.work_description)),
    condition_notes:join(equipment.map(l=>label(l)+": "+l.condition_notes)),
    accessories:join(equipment.map(l=>label(l)+": "+l.accessories)),
  };
}
