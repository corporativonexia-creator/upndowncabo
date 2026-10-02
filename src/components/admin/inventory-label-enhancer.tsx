"use client";

import {useEffect} from "react";
import {createClient} from "@/lib/supabase/client";

const L=["0001101","0011001","0010011","0111101","0100011","0110001","0101111","0111011","0110111","0001011"];
const G=["0100111","0110011","0011011","0100001","0011101","0111001","0000101","0010001","0001001","0010111"];
const R=["1110010","1100110","1101100","1000010","1011100","1001110","1010000","1000100","1001000","1110100"];
const PARITY=["LLLLLL","LLGLGG","LLGGLG","LLGGGL","LGLLGG","LGGLLG","LGGGLL","LGLGLG","LGLGGL","LGGLGL"];

function esc(v:string){return String(v||"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;","\"":"&quot;","'":"&#039;"}[c]||c))}
function validEan13(value:string){if(!/^\d{13}$/.test(value))return false;const d=value.split("").map(Number);const sum=d.slice(0,12).reduce((a,n,i)=>a+n*(i%2?3:1),0);return (10-sum%10)%10===d[12]}
function ean13Svg(value:string){const d=value.split("").map(Number),p=PARITY[d[0]];let bits="101";for(let i=1;i<=6;i++)bits+=(p[i-1]==="L"?L:G)[d[i]];bits+="01010";for(let i=7;i<=12;i++)bits+=R[d[i]];bits+="101";const module=.42,left=4,w=bits.length*module+left*2;let bars="";for(let i=0;i<bits.length;i++)if(bits[i]==="1"){const guard=i<3||(i>=45&&i<50)||i>=92;bars+=`<rect x="${left+i*module}" y="1" width="${module+.02}" height="${guard?14.4:12.5}"/>`}return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} 18.5"><rect width="100%" height="100%" fill="white"/><g fill="black">${bars}</g><text x="${w/2}" y="18" text-anchor="middle" font-family="Arial,sans-serif" font-size="3" letter-spacing=".42">${value}</text></svg>`}
function logoSvg(){return `<svg class="brand-logo" viewBox="0 0 320 74" xmlns="http://www.w3.org/2000/svg" aria-label="Up And Down"><g fill="none" stroke="#000" stroke-width="3.2" stroke-linecap="round"><path d="M78 23c34 0 50-13 82-13 35 0 52 18 84 18 17 0 30-5 41-10"/><path d="M196 10V1"/></g><path d="M196 1c10 0 15 8 27 4-6 9-16 11-27 6z" fill="#000"/><text x="160" y="55" text-anchor="middle" font-family="Georgia,Times New Roman,serif" font-size="23" letter-spacing="8">UP AND DOWN</text><text x="160" y="70" text-anchor="middle" font-family="Georgia,Times New Roman,serif" font-size="8.5" letter-spacing="4">CABO GOLF SHOP BY COQUE</text></svg>`}
function money(value:number){return new Intl.NumberFormat("es-MX",{style:"currency",currency:"MXN",minimumFractionDigits:0,maximumFractionDigits:0}).format(value)}

export default function InventoryLabelEnhancer(){
 useEffect(()=>{
  const db=createClient();
  const handler=async(e:MouseEvent)=>{
   const target=e.target as HTMLElement|null;
   const btn=target?.closest?.("button.label-btn") as HTMLButtonElement|null;
   if(!btn)return;
   e.preventDefault();e.stopPropagation();e.stopImmediatePropagation();
   const tr=btn.closest("tr");if(!tr)return;
   const cells=tr.querySelectorAll("td");
   const productName=(cells[0]?.querySelector("b")?.textContent||cells[0]?.textContent||"").trim();
   const variant=(cells[1]?.childNodes?.[0]?.textContent||"").trim();
   const sku=(cells[2]?.textContent||"").trim();
   const barcode=(cells[3]?.textContent||"").trim();
   if(!validEan13(barcode)){alert("Este SKU necesita un código EAN-13 válido antes de imprimir.");return}
   let price=0;
   const {data:variantData}=await db.from("product_variants").select("product_id").eq("sku",sku).maybeSingle();
   if(variantData?.product_id){const {data:p}=await db.from("products").select("price,sale_price").eq("id",variantData.product_id).maybeSingle();if(p)price=Number(p.sale_price||p.price||0)}
   if(!price){const {data:p}=await db.from("products").select("price,sale_price").eq("sku",sku).maybeSingle();if(p)price=Number(p.sale_price||p.price||0)}
   if(!price){alert("No pude obtener el precio de este producto. Revisa que tenga precio de venta registrado antes de imprimir.");return}
   const suggested=Math.max(1,Number(cells[4]?.textContent||1)||1);
   const raw=window.prompt("¿Cuántas etiquetas deseas imprimir?",String(suggested));if(raw===null)return;
   const qty=Math.max(1,Math.min(500,Math.floor(Number(raw)||1))),barcodeSvg=ean13Svg(barcode);
   const showVariant=variant&&!/^(principal|única|unica)$/i.test(variant);
   const labels=Array.from({length:qty},()=>`<section class="label">${logoSvg()}<div class="product-line"><div class="name">${esc(productName)}</div><div class="price">${esc(money(price))}</div></div>${showVariant?`<div class="variant">${esc(variant)}</div>`:""}<div class="barcode">${barcodeSvg}</div><div class="sku">SKU ${esc(sku)}</div></section>`).join("");
   const win=window.open("","_blank","width=700,height=700");if(!win){alert("Permite ventanas emergentes para imprimir etiquetas.");return}
   win.document.write(`<!doctype html><html><head><meta charset="utf-8"><title>Etiquetas ${esc(sku)}</title><style>@page{size:50mm 30mm;margin:0}*{box-sizing:border-box}html,body{margin:0;padding:0;background:#fff;font-family:Arial,sans-serif}.label{width:50mm;height:30mm;padding:1mm 2mm .8mm;overflow:hidden;page-break-after:always;break-after:page;text-align:center;color:#000}.label:last-child{page-break-after:auto}.brand-logo{display:block;width:38mm;height:8mm;margin:0 auto .2mm}.product-line{display:flex;align-items:baseline;justify-content:center;gap:1.4mm;max-width:46mm}.name{font-size:6.8pt;font-weight:700;line-height:1;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:28mm}.price{font-size:9.5pt;font-weight:900;line-height:1;white-space:nowrap}.variant{font-size:5.4pt;line-height:1;margin-top:.35mm;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.barcode{height:11.7mm;margin:.3mm auto 0;display:flex;align-items:center;justify-content:center}.barcode svg{width:43mm;height:11.7mm;display:block}.sku{font-size:5pt;line-height:1;margin-top:-.15mm}@media screen{body{background:#eee;padding:10px}.label{background:#fff;margin:0 auto 10px;box-shadow:0 2px 10px #999}}@media print{body{background:#fff}.label{margin:0;box-shadow:none}}</style></head><body>${labels}<script>window.onload=()=>setTimeout(()=>window.print(),250)<\/script></body></html>`);win.document.close();
  };
  document.addEventListener("click",handler,true);return()=>document.removeEventListener("click",handler,true);
 },[]);
 return null;
}
