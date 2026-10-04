(()=>{
"use strict";
if(window.__UPDOWN_ADMIN_NAV_V2__)return;window.__UPDOWN_ADMIN_NAV_V2__=true;
const norm=v=>String(v||"").normalize("NFD").replace(/[\u0300-\u036f]/g,"").toLowerCase().trim();
function mount(){
  const root=document.querySelector('#updown-admin');
  const nav=root?.querySelector('.u-admin-nav');
  if(!root||!nav)return false;

  // Inventario debe vivir inmediatamente después de Productos.
  let inventory=document.getElementById('udInventoryMainNav');
  if(!inventory){
    inventory=document.createElement('a');
    inventory.id='udInventoryMainNav';
    inventory.href='/admin/inventario';
    inventory.className='u-tab';
    inventory.textContent='Inventario';
  }

  // El CTA superior duplicaba la pestaña "Alta de producto".
  const newProduct=document.getElementById('udNew');
  if(newProduct)newProduct.style.display='none';

  // Keep the legacy link as a fallback until the real seller tab is mounted.
  const affiliates=document.getElementById('udAffiliatesLink') || [...nav.children].find(el=>norm(el.textContent).includes('afiliad'));
  if(affiliates){
    affiliates.textContent='Afiliados';
    affiliates.setAttribute('href','/admin-afiliados');
    affiliates.removeAttribute('target');
    affiliates.removeAttribute('rel');
  }

  const items=[...nav.children];
  const pick=(test)=>items.find(el=>test(norm(el.textContent)));
  const products=pick(t=>t==='productos');
  const pos=pick(t=>t.includes('pos')||t.includes('caja'));
  const orders=pick(t=>t==='pedidos');
  const sellers=pick(t=>t==='vendedores');
  if(sellers&&affiliates)affiliates.remove();
  const classes=pick(t=>t==='clases');
  const content=pick(t=>t==='contenido');
  const store=pick(t=>t.startsWith('tienda'));
  const sellerPortal=pick(t=>t.includes('panel vendedor'));

  const desired=[products,inventory,pos,orders,sellers,sellers?null:affiliates,classes,content,store,sellerPortal].filter(Boolean);
  desired.forEach(el=>nav.appendChild(el));
  // Conserva cualquier módulo futuro/no reconocido al final, sin eliminar funcionalidad.
  [...nav.children].filter(el=>!desired.includes(el)).forEach(el=>nav.appendChild(el));
  return true;
}
let n=0;const t=setInterval(()=>{if(mount()&&++n>8)clearInterval(t);else if(++n>100)clearInterval(t)},250);
if(document.readyState!=='loading')mount();else document.addEventListener('DOMContentLoaded',mount);
})();
