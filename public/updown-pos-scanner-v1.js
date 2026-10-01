(()=>{
"use strict";
if(window.__UPDOWN_POS_SCANNER_V1__)return;window.__UPDOWN_POS_SCANNER_V1__=true;
if(location.pathname!=="/pos")return;
let buffer="",last=0;
function setReactInput(input,value){const setter=Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,"value")?.set;setter?.call(input,value);input.dispatchEvent(new Event("input",{bubbles:true}));input.dispatchEvent(new Event("change",{bubbles:true}))}
async function addBarcode(code){const url=window.__UPDOWN_SUPABASE_URL__,key=window.__UPDOWN_SUPABASE_PUBLISHABLE_KEY__;if(!url||!key)return;try{const r=await fetch(`${url}/rest/v1/products?barcode=eq.${encodeURIComponent(code)}&status=eq.active&select=id,sku,name&limit=2`,{headers:{apikey:key,Authorization:`Bearer ${key}`}});if(!r.ok)return;const rows=await r.json();if(!Array.isArray(rows)||rows.length!==1){window.dispatchEvent(new CustomEvent("updown:barcode-miss",{detail:{barcode:code}}));return}const search=document.querySelector('.pos-search[placeholder*="Buscar producto"]');if(!search)return;setReactInput(search,rows[0].sku||rows[0].name);setTimeout(()=>{const buttons=[...document.querySelectorAll(".pos-products .pos-add:not(:disabled)")];if(buttons.length===1){buttons[0].click();setReactInput(search,"")}},120)}catch(e){console.warn("Barcode scanner",e)}}
document.addEventListener("keydown",e=>{const now=Date.now();if(now-last>120)buffer="";last=now;if(e.key==="Enter"){const code=buffer.trim();buffer="";if(/^\d{6,18}$/.test(code)){e.preventDefault();void addBarcode(code)}return}if(e.key.length===1&&!e.ctrlKey&&!e.altKey&&!e.metaKey)buffer+=e.key},true);
})();
