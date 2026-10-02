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
    if(existing){existing.textContent=message;existing.classList.toggle("u-error",error);existing.classList.add("u-show");setTimeout(()=>existing.classList.remove("u-show"),4200);return;}
    console[error?"error":"log"](message);
  }
  function jpegFile(blob,file){
    const base=(file.name||"foto").replace(/\.(heic|heif)$/i,"");
    return new File([blob],`${base}.jpg`,{type:"image/jpeg",lastModified:file.lastModified||Date.now()});
  }
  async function canvasToJpeg(source,file){
    const width=source.naturalWidth||source.videoWidth||source.width;
    const height=source.naturalHeight||source.videoHeight||source.height;
    if(!width||!height) throw new Error("El navegador no pudo leer esta foto HEIC.");
    const max=3200,scale=Math.min(1,max/Math.max(width,height));
    const canvas=document.createElement("canvas");
    canvas.width=Math.max(1,Math.round(width*scale));canvas.height=Math.max(1,Math.round(height*scale));
    const ctx=canvas.getContext("2d",{alpha:false});
    ctx.fillStyle="#fff";ctx.fillRect(0,0,canvas.width,canvas.height);ctx.drawImage(source,0,0,canvas.width,canvas.height);
    const blob=await new Promise(resolve=>canvas.toBlob(resolve,"image/jpeg",0.9));
    if(!blob) throw new Error("No se pudo convertir la foto a JPG.");
    return jpegFile(blob,file);
  }
  async function browserDecode(file){
    if("createImageBitmap" in window){
      try{const bitmap=await createImageBitmap(file);try{return await canvasToJpeg(bitmap,file);}finally{bitmap.close?.();}}catch{}
    }
    const url=URL.createObjectURL(file);
    try{
      const img=new Image();img.decoding="async";
      await new Promise((resolve,reject)=>{img.onload=resolve;img.onerror=()=>reject(new Error("Formato HEIC no decodificable por este navegador."));img.src=url;});
      return await canvasToJpeg(img,file);
    }finally{URL.revokeObjectURL(url);}
  }
  function loadHeic2Any(){
    if(window.heic2any) return Promise.resolve(window.heic2any);
    if(heicLoader) return heicLoader;
    heicLoader=new Promise((resolve,reject)=>{
      const s=document.createElement("script");s.src="https://cdn.jsdelivr.net/npm/heic2any@0.0.4/dist/heic2any.min.js";s.async=true;
      s.onload=()=>window.heic2any?resolve(window.heic2any):reject(new Error("Conversor HEIC no disponible."));
      s.onerror=()=>reject(new Error("Conversor HEIC no disponible."));document.head.appendChild(s);
    });
    return heicLoader;
  }
  async function libraryDecode(file){
    const convert=await loadHeic2Any();
    let blob=await convert({blob:file,toType:"image/jpeg",quality:0.9});if(Array.isArray(blob))blob=blob[0];
    if(!blob) throw new Error("Conversión HEIC vacía.");return jpegFile(blob,file);
  }
  async function convertHeic(file){
    // Prefer the browser/OS decoder first. Modern Safari/iOS and some Chromium builds
    // understand HEIC variants that libheif/heic2any rejects (ERR_LIBHEIF format not supported).
    try{return await browserDecode(file);}catch(browserError){
      try{return await libraryDecode(file);}catch(libraryError){
        console.warn("HEIC decode failed",{browserError,libraryError});
        throw new Error("Esta variante HEIC no pudo convertirse aquí. En iPhone abre la foto, toca Compartir y elige Guardar en Archivos/una copia compatible, o envíala como JPG. El producto no se guardará hasta reemplazar solo esta foto.");
      }
    }
  }
  async function normalizeFiles(files){const out=[];for(const file of files)out.push(isHeic(file)?await convertHeic(file):file);return out;}
  function installHeicInput(){
    const input=document.getElementById("udImage");if(!input||input.dataset.heicHotfix==="2")return;
    input.dataset.heicHotfix="2";
    input.setAttribute("accept","image/*,.heic,.heif,image/heic,image/heif,image/heic-sequence,image/heif-sequence");
    input.addEventListener("change",async event=>{
      if(input.dataset.heicDispatch==="1")return;
      const files=[...(input.files||[])];if(!files.some(isHeic))return;
      event.stopImmediatePropagation();event.preventDefault();
      try{
        toast("Preparando foto HEIC…");const normalized=await normalizeFiles(files);
        const dt=new DataTransfer();normalized.forEach(file=>dt.items.add(file));input.files=dt.files;
        input.dataset.heicDispatch="1";input.dispatchEvent(new Event("change",{bubbles:true}));delete input.dataset.heicDispatch;
        toast("Foto convertida a JPG y lista para guardar.");
      }catch(error){input.value="";toast(error?.message||"No fue posible convertir la foto HEIC.",true);}
    },true);
  }

  function getDb(){if(!window.supabase?.createClient)return null;try{return window.supabase.createClient(window.__UPDOWN_SUPABASE_URL__,window.__UPDOWN_SUPABASE_PUBLISHABLE_KEY__);}catch{return null;}}
  async function syncMissingInventoryVariants(){
    const db=getDb();if(!db)return;
    const {data:products,error:pErr}=await db.from("products").select("id,name,sku,stock,price,sale_price,status");if(pErr){console.warn("Inventory sync products",pErr.message);return;}
    const {data:variants,error:vErr}=await db.from("product_variants").select("id,product_id");if(vErr){console.warn("Inventory sync variants",vErr.message);return;}
    const has=new Set((variants||[]).map(v=>v.product_id));let created=0;
    for(const product of products||[]){
      if(has.has(product.id))continue;
      const {data,error}=await db.rpc("admin_inventory_save_variant",{p_product_id:product.id,p_variant_id:null,p_title:"Única",p_sku:null,p_barcode:null,p_attributes:{},p_price:product.price??null,p_sale_price:product.sale_price??null,p_low_stock_threshold:2,p_is_active:product.status!=="inactive"});
      if(error){console.warn(`Inventory sync ${product.name}`,error.message);continue;}
      const variantId=data?.variant_id,stock=Number(product.stock||0);
      if(variantId&&stock!==0){const {error:moveError}=await db.rpc("admin_inventory_adjust",{p_variant_id:variantId,p_quantity_change:stock,p_reason:"Existencia inicial migrada desde alta de producto",p_movement_type:"adjustment"});if(moveError)console.warn(`Initial stock ${product.name}`,moveError.message);}
      created++;
    }
    if(created)toast(`${created} producto${created===1?"":"s"} sincronizado${created===1?"":"s"} con Inventario.`);
  }
  function installProductSync(){const form=document.getElementById("udProductForm");if(!form||form.dataset.inventoryHotfix==="1")return;form.dataset.inventoryHotfix="1";form.addEventListener("submit",()=>{setTimeout(syncMissingInventoryVariants,1800);setTimeout(syncMissingInventoryVariants,4200);});}
  function boot(){installHeicInput();installProductSync();syncMissingInventoryVariants();}
  boot();const observer=new MutationObserver(()=>{installHeicInput();installProductSync();});observer.observe(document.documentElement,{childList:true,subtree:true});
})();
