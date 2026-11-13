import { createClient } from "@/lib/supabase/server";
import { productKeyFor, type ShareableProduct } from "./product-share";
import { onlinePrice,matchOnlineCampaign,type PublicCampaign } from "./online-pricing";

/** Visible, purchasable relations. Each card is a product or an exact live variant. */
export type RelatedProduct = {
  id: string;
  key: string;
  name: string;
  brand: string | null;
  price: number;
  comparePrice?: number|null;
  campaignPercent?: number;
  currency: string;
  stock: number;
  image: string | null;
  relation: string;
};

type ProductRow = {
  id: string; name: string; category_id: string | null; brand: string | null; sku:string|null;barcode:string|null;
  model: string | null; price: number | null; sale_price: number | null;
  currency: string | null; stock: number | null; cover_image_url: string | null;
  product_images: Array<{ image_url: string; is_primary: boolean; sort_order: number }> | null;
};
type VariantRow = {
  id: string; product_id: string; title: string | null; sku: string | null; barcode:string|null;
  price: number | null; sale_price: number | null; stock: number | null;
  attributes: Record<string, unknown> | null;
};

function photo(value: unknown): string | null {
  if (typeof value !== "string" || !value.trim()) return null;
  try { const url = new URL(value); return url.protocol === "https:" ? url.toString() : null; }
  catch { return null; }
}
function amount(value: unknown, fallback = 0) {
  const n = Number(value ?? fallback);
  return Number.isFinite(n) ? n : fallback;
}

/**
 * Related selection: active inventory in the same product category, followed
 * by the same brand. Matching active variants are shown as individual cards.
 * No writes, no stock mutation and no unlisted/draft products.
 */
export async function findRelatedProducts(current: ShareableProduct): Promise<RelatedProduct[]> {
  const db = await createClient();
  // The product page already validated this category and brand. Reuse them.
  const categoryId = current.categoryId;
  const brand = current.brand;

  const projection = "id,name,category_id,brand,model,sku,barcode,price,sale_price,currency,stock,cover_image_url,product_images(image_url,is_primary,sort_order)";
  const empty = {data: [] as ProductRow[], error: null};
  const [inCategory, byBrand, campaignsResult] = await Promise.all([
    categoryId
      ? db.from("products").select(projection).eq("status","active").eq("online_visible",true)
          .eq("category_id",categoryId).order("created_at",{ascending:false}).limit(90)
      : Promise.resolve(empty),
    brand
      ? db.from("products").select(projection).eq("status","active").eq("online_visible",true)
          .ilike("brand",brand).order("created_at",{ascending:false}).limit(35)
      : Promise.resolve(empty),
    db.rpc("pos22_public_active_promotions"),
  ]);
  if (campaignsResult.error)throw new Error("No se pudieron validar las promociones activas.");
  const campaigns=(Array.isArray(campaignsResult.data)?campaignsResult.data:[]) as PublicCampaign[];
  if (inCategory.error && byBrand.error) return [];

  const parents = new Map<string,ProductRow>();
  for (const row of [...(inCategory.data || []),...(byBrand.data || [])] as ProductRow[]) {
    parents.set(row.id,row);
  }
  // Include siblings even if the category list was truncated.
  if (!parents.has(current.parentId)) {
    const sameParent=await db.from("products").select(projection)
      .eq("id",current.parentId).eq("status","active").eq("online_visible",true).maybeSingle();
    if(sameParent.data) parents.set(sameParent.data.id,sameParent.data as ProductRow);
  }

  const parentIds=[...parents.keys()];
  if (!parentIds.length) return [];
  const variantsByParent = new Map<string,VariantRow[]>();
  // Bounded API calls avoid a large PostgREST IN clause and its default row cap.
  // Stage 9: bounded concurrency, not one network roundtrip per group.
  // Three requests at a time is enough without overloading the database.
  const batches: string[][]=[];
  for(let i=0;i<parentIds.length;i+=35)batches.push(parentIds.slice(i,i+35));
  for(let i=0;i<batches.length;i+=3){
    const results=await Promise.all(batches.slice(i,i+3).map(ids=>
      db.from("product_variants")
        .select("id,product_id,title,sku,barcode,price,sale_price,stock,attributes")
        .in("product_id",ids).eq("is_active",true).order("id",{ascending:true}).limit(700)
    ));
    for(const result of results){
      if(result.error)continue;
      for(const variant of (result.data||[]) as VariantRow[]){
        const entries=variantsByParent.get(variant.product_id)||[];
        entries.push(variant);
        variantsByParent.set(variant.product_id,entries);
      }
    }
  }

  const normalized=(value: string | null | undefined)=>String(value||"").trim().toLowerCase();
  const rows: Array<{ product: RelatedProduct; score: number }> = [];
  for(const parent of parents.values()) {
    const images=(parent.product_images || []).slice().sort((a,b)=>
      Number(Boolean(b.is_primary))-Number(Boolean(a.is_primary)) ||
      amount(a.sort_order)-amount(b.sort_order));
    const mainImage=photo(parent.cover_image_url) || images.map(i=>photo(i.image_url)).find(Boolean) || null;
    const siblings=variantsByParent.get(parent.id) || [];
    const similarBrand=Boolean(current.brand) && normalized(parent.brand)===normalized(current.brand);
    const similarModel=Boolean(current.model) && normalized(parent.model)===normalized(current.model);
    const sameParent=parent.id===current.parentId;
    const score=(sameParent?100:0)+(similarModel?20:0)+(similarBrand?10:0)+5;
    const relation=sameParent?"Otra configuración":similarModel?"Mismo modelo":similarBrand?"Misma marca":"Misma categoría";
    if(siblings.length) {
      for(const variant of siblings){
        if(variant.id===current.variantId) continue;
        const title=String(variant.title||variant.sku||"").trim();
        const displayName=title && !/^(principal|única|unica)$/i.test(title)
          ? parent.name+" · "+title : parent.name;
        const list=amount(variant.price,parent.price ?? 0);
        const special=variant.sale_price ?? (variant.price==null?parent.sale_price:null);
        const campaign=matchOnlineCampaign(campaigns,{categoryId:parent.category_id,sku:variant.sku,parentSku:parent.sku,barcode:variant.barcode,parentBarcode:parent.barcode});
        const pricing=onlinePrice({price:list,salePrice:special,campaignPercent:Number(campaign?.discount_percent||0)});
        const price=pricing.price;
        if(price<=0) continue;
        const attrs=variant.attributes||{};
        rows.push({score,product:{
          id:"variant:"+variant.id,
          key:productKeyFor({id:parent.id,variant_id:variant.id,name:displayName}),
          name:displayName,brand:parent.brand,price,comparePrice:pricing.comparePrice,campaignPercent:pricing.campaignPercent,currency:parent.currency||"MXN",
          stock:Math.max(0,amount(variant.stock)),relation,
          image:photo(attrs.image_url)||photo(attrs.photo_url)||mainImage,
        }});
      }
    } else if(parent.id!==current.parentId){
      const list=amount(parent.price);
      const special=parent.sale_price;
      const campaign=matchOnlineCampaign(campaigns,{categoryId:parent.category_id,sku:parent.sku,barcode:parent.barcode});
      const pricing=onlinePrice({price:list,salePrice:special,campaignPercent:Number(campaign?.discount_percent||0)});
      const price=pricing.price;
      if(price<=0)continue;
      rows.push({score,product:{
        id:parent.id,key:productKeyFor({id:parent.id,name:parent.name}),
        name:parent.name,brand:parent.brand,price,comparePrice:pricing.comparePrice,campaignPercent:pricing.campaignPercent,currency:parent.currency||"MXN",
        stock:Math.max(0,amount(parent.stock)),relation,image:mainImage,
      }});
    }
  }
  return rows.sort((a,b)=>b.score-a.score || b.product.stock-a.product.stock)
    .slice(0,96).map(row=>row.product);
}
