(()=>{
  "use strict";
  if(window.__UPDOWN_HEIC_INVENTORY_HOTFIX__) return;
  window.__UPDOWN_HEIC_INVENTORY_HOTFIX__=true;

  const HEIC_RE=/\.(heic|heif)$/i;
  const HEIC_TYPES=new Set(["image/heic","image/heif","image/heic-sequence","image/heif-sequence"]);
  let heicLoader=null;

  function isHeic(file){return !!file&&(HEIC_TYPES.has(String(file.type||"").toLowerCase())||HEIC_RE.test(file.name||""));}
  function toast(message,error=false){
    const existing=document.getElementById("udToast");
    if(existing){existing.textContent=message;existing.classList.toggle("u-error",error);existing.classList.add("u-show");setTimeout(()=>existing.classList.remove("u-show"),3200);return;}
    console[error?"error":"log"](message);
  }
  function loadHeic2Any(){
    if(window.heic2any) return Promise.resolve(window.heic2any);
    if(heicLoader) return heicLoader;
    heicLoader=new Promise((resolve,reject)=>{
      const s=document.createElement("script");
      s.src="https://cdn.jsdelivr.net/npm/heic2any@0.0.4/dist/heic2any.min.js";
      s.async=true;
      s.onload=()=>window.heic2any?resolve(window.heic2any):reject(new Error("No se pudo iniciar el conversor HEIC."));
      s.onerror=()=>reject(new Error("No se pudo cargar el conversor HEIC."));
      document.head.appendChild(s);
    });
    return heicLoader;
  }
  async function convertHeic(file){
    const convert=await loadHeic2Any();
    let blob=await convert({blob:file,toType:"image/jpeg",quality:0.92});
    if(Array.isArray(blob)) blob=blob[0];
    const base=(file.name||"foto").replace(/\.(heic|heif)$/i,"");
    return new File([blob],`${base}.jpg`,{type:"image/jpeg",lastModified:file.lastModified||Date.now()});
  }
  async function normalizeFiles(files){
    const out=[];
    for(const file of files){out.push(isHeic(file)?await convertHeic(file):file);}
    return out;
  }
  function installHeicInput(){
    const input=document.getElementById("udImage");
    if(!input||input.dataset.heicHotfix==="1") return;
    input.dataset.heicHotfix="1";
    input.setAttribute("accept","image/jpeg,image/png,image/webp,image/avif,image/heic,image/heif,.jpg,.jpeg,.png,.webp,.avif,.heic,.heif");
    input.addEventListener("change",async event=>{
      if(input.dataset.heicDispatch==="1") return;
      const files=[...(input.files||[])];
      if(!files.some(isHeic)) return;
      event.stopImmediatePropagation();
      try{
        toast("Convirtiendo foto HEIC…");
        const normalized=await normalizeFiles(files);
        const dt=new DataTransfer();normalized.forEach(file=>dt.items.add(file));
        input.files=dt.files;
        input.dataset.heicDispatch="1";
        input.dispatchEvent(new Event("change",{bubbles:true}));
        delete input.dataset.heicDispatch;
        toast("Foto HEIC lista para guardar.");
      }catch(error){
        input.value="";
        toast(error?.message||"No fue posible convertir la foto HEIC.",true);
      }
    },true);
  }

  function getDb(){
    if(!window.supabase?.createClient) return null;
    try{return window.supabase.createClient(window.__UPDOWN_SUPABASE_URL__,window.__UPDOWN_SUPABASE_PUBLISHABLE_KEY__);}catch{return null;}
  }
  async function syncMissingInventoryVariants(){
    const db=getDb();if(!db)return;
    const {data:products,error:pErr}=await db.from("products").select("id,name,sku,stock,price,sale_price,status");
    if(pErr){console.warn("Inventory sync products",pErr.message);return;}
    const {data:variants,error:vErr}=await db.from("product_variants").select("id,product_id");
    if(vErr){console.warn("Inventory sync variants",vErr.message);return;}
    const has=new Set((variants||[]).map(v=>v.product_id));
    let created=0;
    for(const product of products||[]){
      if(has.has(product.id)) continue;
      const {data,error}=await db.rpc("admin_inventory_save_variant",{
        p_product_id:product.id,p_variant_id:null,p_title:"Única",p_sku:null,p_barcode:null,p_attributes:{},
        p_price:product.price??null,p_sale_price:product.sale_price??null,p_low_stock_threshold:2,p_is_active:product.status!=="inactive"
      });
      if(error){console.warn(`Inventory sync ${product.name}`,error.message);continue;}
      const variantId=data?.variant_id;
      const stock=Number(product.stock||0);
      if(variantId&&stock!==0){
        const {error:moveError}=await db.rpc("admin_inventory_adjust",{p_variant_id:variantId,p_quantity_change:stock,p_reason:"Existencia inicial migrada desde alta de producto",p_movement_type:"adjustment"});
        if(moveError) console.warn(`Initial stock ${product.name}`,moveError.message);
      }
      created++;
    }
    if(created) toast(`${created} producto${created===1?"":"s"} sincronizado${created===1?"":"s"} con Inventario.`);
  }

  function installProductSync(){
    const form=document.getElementById("udProductForm");
    if(!form||form.dataset.inventoryHotfix==="1") return;
    form.dataset.inventoryHotfix="1";
    form.addEventListener("submit",()=>{setTimeout(syncMissingInventoryVariants,1800);setTimeout(syncMissingInventoryVariants,4200);});
  }
  function boot(){installHeicInput();installProductSync();syncMissingInventoryVariants();}
  boot();
  const observer=new MutationObserver(()=>{installHeicInput();installProductSync();});
  observer.observe(document.documentElement,{childList:true,subtree:true});
})();
