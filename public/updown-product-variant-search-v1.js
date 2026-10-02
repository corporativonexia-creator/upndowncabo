(()=>{
"use strict";
if(window.__UPDOWN_PRODUCT_VARIANT_SEARCH_V1__)return;window.__UPDOWN_PRODUCT_VARIANT_SEARCH_V1__=true;
const norm=v=>String(v||"").normalize("NFD").replace(/[\u0300-\u036f]/g,"").toLowerCase().trim();
function getDb(){if(!window.supabase?.createClient)return null;try{return window.supabase.createClient(window.__UPDOWN_SUPABASE_URL__,window.__UPDOWN_SUPABASE_PUBLISHABLE_KEY__);}catch{return null;}}
let rows=[],busy=false;
async function load(){if(busy)return;busy=true;try{const db=getDb();if(!db)return;const {data,error}=await db.from("product_variants").select("product_id,title,sku,barcode,attributes,products(name,sku,barcode,brand,model)");if(error)throw error;rows=data||[];enrich();}catch(error){console.warn("Variant catalog search",error?.message||error);}finally{busy=false;}}
function enrich(){const list=document.getElementById("udList");if(!list||!rows.length)return;const cards=[...list.querySelectorAll(".u-item")];cards.forEach(card=>{const text=norm(card.innerText||card.textContent||"");const matched=rows.filter(row=>{const p=row.products||{};return (p.sku&&text.includes(norm(p.sku)))||(p.name&&text.includes(norm(p.name)));});if(!matched.length)return;const extra=matched.map(row=>[row.title,row.sku,row.barcode,JSON.stringify(row.attributes||{})].filter(Boolean).join(" ")).join(" ");card.dataset.barcode=extra;card.dataset.variantSearch=extra;});const input=document.getElementById("udCatalogSearch");if(input){input.dispatchEvent(new Event("input",{bubbles:true}));}}
function boot(){const list=document.getElementById("udList");if(!list)return false;load();const observer=new MutationObserver(()=>setTimeout(enrich,40));observer.observe(list,{childList:true,subtree:true});return true;}
let n=0;const timer=setInterval(()=>{if(boot()||++n>100)clearInterval(timer)},250);
})();
