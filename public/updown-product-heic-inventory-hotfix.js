(()=>{
  "use strict";
  if(window.__UPDOWN_HEIC_INVENTORY_HOTFIX__) return;
  window.__UPDOWN_HEIC_INVENTORY_HOTFIX__=true;

  const HEIC_RE=/\.(heic|heif)$/i;
  const HEIC_TYPES=new Set(["image/heic","image/heif","image/heic-sequence","image/heif-sequence"]);
  let heicLoader=null;

  function isHeic(file){return !!file&&(HEIC_TYPES.has(String(file.type||"").toLowerCase())||HEIC_RE.test(file.name||""));}
  function toast(message,error=false){const el=document.getElementById("udToast");if(el){el.textContent=message;el.classList.toggle("u-error",error);el.classList.add("u-show");setTimeout(()=>el.classList.remove("u-show"),4200);return;}console[error?"error":"log"](message);}
  function jpegFile(blob,file){const base=(file.name||"foto").replace(/\.(heic|heif)$/i,"");return new File([blob],`${base}.jpg`,{type:"image/jpeg",lastModified:file.lastModified||Date.now()});}
  async function canvasToJpeg(source,file){const width=source.naturalWidth||source.videoWidth||source.width,height=source.naturalHeight||source.videoHeight||source.height;if(!width||!height)throw new Error("El navegador no pudo leer esta foto HEIC.");const max=3200,scale=Math.min(1,max/Math.max(width,height)),canvas=document.createElement("canvas");canvas.width=Math.max(1,Math.round(width*scale));canvas.height=Math.max(1,Math.round(height*scale));const ctx=canvas.getContext("2d",{alpha:false});ctx.fillStyle="#fff";ctx.fillRect(0,0,canvas.width,canvas.height);ctx.drawImage(source,0,0,canvas.width,canvas.height);const blob=await new Promise(resolve=>canvas.toBlob(resolve,"image/jpeg",0.9));if(!blob)throw new Error("No se pudo convertir la foto a JPG.");return jpegFile(blob,file);}
  async function browserDecode(file){if("createImageBitmap" in window){try{const bitmap=await createImageBitmap(file);try{return await canvasToJpeg(bitmap,file);}finally{bitmap.close?.();}}catch{}}const url=URL.createObjectURL(file);try{const img=new Image();img.decoding="async";await new Promise((resolve,reject)=>{img.onload=resolve;img.onerror=()=>reject(new Error("HEIC no nativo"));img.src=url;});return await canvasToJpeg(img,file);}finally{URL.revokeObjectURL(url);}}

  function loadHeicTo(){
    if(window.HeicTo) return Promise.resolve(window.HeicTo);
    if(heicLoader) return heicLoader;
    heicLoader=new Promise((resolve,reject)=>{
      const s=document.createElement("script");
      s.src="https://cdn.jsdelivr.net/npm/heic-to@1.6.5/dist/iife/heic-to.js";
      s.async=true;
      s.onload=()=>window.HeicTo?resolve(window.HeicTo):reject(new Error("No se pudo iniciar el decodificador HEIC."));
      s.onerror=()=>reject(new Error("No se pudo cargar el decodificador HEIC."));
      document.head.appendChild(s);
    });
    return heicLoader;
  }
  async function wasmDecode(file){
    const converter=await loadHeicTo();
    const blob=await converter({blob:file,type:"image/jpeg",quality:0.9});
    if(!(blob instanceof Blob)||!blob.size) throw new Error("El decodificador no produjo una imagen válida.");
    return jpegFile(blob,file);
  }
  async function convertHeic(file){
    try{return await browserDecode(file);}catch(nativeError){
      try{return await wasmDecode(file);}catch(wasmError){
        console.warn("HEIC decode failed",{nativeError,wasmError});
        throw new Error("No pudimos procesar esta foto HEIC. Intenta nuevamente o selecciona otra foto; no se guardó ningún archivo incompleto.");
      }
    }
  }
  async function normalizeFiles(files){const out=[];for(const file of files)out.push(isHeic(file)?await convertHeic(file):file);return out;}
  function installHeicInput(){const input=document.getElementById("udImage");if(!input||input.dataset.heicHotfix==="3")return;input.dataset.heicHotfix="3";input.setAttribute("accept","image/*,.heic,.heif,image/heic,image/heif,image/heic-sequence,image/heif-sequence");input.addEventListener("change",async event=>{if(input.dataset.heicDispatch==="1")return;const files=[...(input.files||[])];if(!files.some(isHeic))return;event.stopImmediatePropagation();event.preventDefault();try{toast("Procesando foto HEIC…");const normalized=await normalizeFiles(files),dt=new DataTransfer();normalized.forEach(file=>dt.items.add(file));input.files=dt.files;input.dataset.heicDispatch="1";input.dispatchEvent(new Event("change",{bubbles:true}));delete input.dataset.heicDispatch;toast("Foto HEIC convertida a JPG y lista.");}catch(error){input.value="";toast(error?.message||"No fue posible procesar la foto HEIC.",true);}},true);}

  // A10.3: this runtime only converts photos. Inventory reconciliation is
  // explicitly requested from /admin/inventario and never writes stock.
  installHeicInput();
  const observer=new MutationObserver(installHeicInput);
  observer.observe(document.documentElement,{childList:true,subtree:true});
})();
