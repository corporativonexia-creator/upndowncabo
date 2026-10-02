(()=>{
"use strict";
if(window.__UPDOWN_POS_SCANNER_V1__)return;window.__UPDOWN_POS_SCANNER_V1__=true;
if(location.pathname!=="/pos")return;
let buffer="",last=0;
function setReactInput(input,value){const setter=Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,"value")?.set;setter?.call(input,value);input.dispatchEvent(new Event("input",{bubbles:true}));input.dispatchEvent(new Event("change",{bubbles:true}))}
async function fetchJson(url,key){const r=await fetch(url,{headers:{apikey:key,Authorization:`Bearer ${key}`}});if(!r.ok)throw new Error(`HTTP ${r.status}`);return r.json()}
async function addBarcode(code){const url=window.__UPDOWN_SUPABASE_URL__,key=window.__UPDOWN_SUPABASE_PUBLISHABLE_KEY__;if(!url||!key)return;try{
 let product=null;
 // Los EAN internos viven en product_variants. Primero resolvemos variante -> producto.
 const variants=await fetchJson(`${url}/rest/v1/product_variants?barcode=eq.${encodeURIComponent(code)}&select=product_id,sku,title&limit=2`,key);
 if(Array.isArray(variants)&&variants.length===1){const products=await fetchJson(`${url}/rest/v1/products?id=eq.${encodeURIComponent(variants[0].product_id)}&status=eq.active&select=id,sku,name&limit=1`,key);if(Array.isArray(products)&&products.length===1)product={...products[0],variant_sku:variants[0].sku};}
 // Compatibilidad con productos antiguos cuyo barcode todavía está en products.
 if(!product){const products=await fetchJson(`${url}/rest/v1/products?barcode=eq.${encodeURIComponent(code)}&status=eq.active&select=id,sku,name&limit=2`,key);if(Array.isArray(products)&&products.length===1)product=products[0];}
 if(!product){window.dispatchEvent(new CustomEvent("updown:barcode-miss",{detail:{barcode:code}}));return}
 const search=document.querySelector('.pos-search[placeholder*="Buscar producto"]');if(!search)return;
 // El catálogo del POS todavía se presenta por producto; nombre es la llave más segura
 // cuando el SKU operativo está en product_variants.
 setReactInput(search,product.sku||product.name);
 setTimeout(()=>{const buttons=[...document.querySelectorAll(".pos-products .pos-add:not(:disabled)")];if(buttons.length===1){buttons[0].click();setReactInput(search,"")}},160)
 }catch(e){console.warn("Barcode scanner",e)}}
document.addEventListener("keydown",e=>{const now=Date.now();if(now-last>120)buffer="";last=now;if(e.key==="Enter"){const code=buffer.trim();buffer="";if(/^\d{6,18}$/.test(code)){e.preventDefault();void addBarcode(code)}return}if(e.key.length===1&&!e.ctrlKey&&!e.altKey&&!e.metaKey)buffer+=e.key},true);
})();
