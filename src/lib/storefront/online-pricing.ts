/** POS 2.2 scheduled campaigns, shared by public cards, detail and related products. */
export type PublicCampaign = {
  id:string;title:string;target_type:"category"|"sku"|"barcode";
  target_value:string;discount_percent:number|string;
};
export type StorefrontPriceInput={
  price:number; salePrice?:number|null; campaignPercent?:number|null;
};
export function onlinePrice({price,salePrice,campaignPercent}:StorefrontPriceInput){
  const regular=Number(price);
  if(!Number.isFinite(regular)||regular<0)throw Error("INVALID_REGULAR_PRICE");
  const special=salePrice==null?null:Number(salePrice);
  const base=special!==null&&Number.isFinite(special)&&special>=0&&special<regular?special:regular;
  const percent=Number(campaignPercent||0);
  if(!Number.isFinite(percent)||percent<0||percent>=100)throw Error("INVALID_CAMPAIGN_PERCENT");
  const final=Math.round((base*(1-percent/100)+Number.EPSILON)*100)/100;
  return {price:final,comparePrice:final<regular?regular:null,campaignPercent:percent};
}
export function matchOnlineCampaign(
  campaigns:PublicCampaign[],p:{categoryId?:string|null;sku?:string|null;parentSku?:string|null;barcode?:string|null;parentBarcode?:string|null}
):PublicCampaign|null{
  return campaigns.filter(pr=>{
    const value=String(pr.target_value||"").trim();
    if(pr.target_type==="category")return p.categoryId===value;
    if(pr.target_type==="sku")return [p.sku,p.parentSku].some(v=>String(v||"").trim().toUpperCase()===value.toUpperCase());
    if(pr.target_type==="barcode")return [p.barcode,p.parentBarcode].some(v=>String(v||"").trim()===value);
    return false;
  }).sort((a,b)=>Number(b.discount_percent)-Number(a.discount_percent)||String(a.id).localeCompare(String(b.id)))[0]||null;
}
