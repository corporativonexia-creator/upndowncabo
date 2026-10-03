(function(){
  "use strict";
  const MOBILE="(max-width: 760px)";
  let observer=null;
  function mobile(){return window.matchMedia(MOBILE).matches}
  function root(){return document.getElementById("updown-store")}
  function icon(type){
    if(type==="search")return '<svg viewBox="0 0 24 24"><circle cx="11" cy="11" r="6.5"></circle><path d="m16 16 4 4"></path></svg>';
    if(type==="cart")return '<svg viewBox="0 0 24 24"><path d="M3 4h2l2.1 10.2a2 2 0 0 0 2 1.6h7.8a2 2 0 0 0 2-1.6L20 8H6.2"></path><circle cx="10" cy="20" r="1"></circle><circle cx="18" cy="20" r="1"></circle></svg>';
    return '<svg viewBox="0 0 24 24"><path d="M5 7h14M5 12h14M5 17h14"></path></svg>';
  }
  function installStyles(){
    if(document.getElementById("ud-mobile-premium-style"))return;
    const s=document.createElement("style");s.id="ud-mobile-premium-style";s.textContent=`
      @media(max-width:760px){
        #updown-store .uds-announcement{display:none!important;height:0!important;min-height:0!important;padding:0!important;margin:0!important;border:0!important;overflow:hidden!important}
        #updown-store .uds-header{position:sticky!important;top:0!important;z-index:900!important;width:100%!important;height:58px!important;min-height:58px!important;margin:0!important;padding:0!important;background:#0b493d!important;border:0!important;box-shadow:none!important}
        #updown-store .uds-header .uds-topbar{display:flex!important;align-items:center!important;justify-content:space-between!important;width:100%!important;max-width:none!important;height:58px!important;min-height:58px!important;margin:0!important;padding:7px 12px!important;background:#0b493d!important;border:0!important;box-shadow:none!important}
        #updown-store .uds-header .uds-topbar>.uds-menu-btn,#updown-store .uds-header .uds-topbar>.uds-logo,#updown-store .uds-header .uds-topbar>.uds-desktop-nav,#updown-store .uds-header .uds-topbar>.uds-top-actions,#updown-store .uds-mobile-quick-actions{display:none!important}
        #updown-store .udm-header{display:flex!important;align-items:center;justify-content:space-between;width:100%;height:44px}
        #updown-store .udm-mark{display:flex;align-items:center;width:74px;height:32px;color:#fff;text-decoration:none}
        #updown-store .udm-mark svg{display:block;width:74px;height:28px;overflow:visible}
        #updown-store .udm-mark svg path{fill:currentColor!important}
        #updown-store .udm-actions{display:flex;align-items:center;gap:7px}
        #updown-store .udm-btn{position:relative;display:grid;place-items:center;width:40px;height:40px;padding:0;border:0;border-radius:50%;background:transparent;color:#fff}
        #updown-store .udm-btn:active{background:rgba(255,255,255,.12)}
        #updown-store .udm-btn svg{width:22px;height:22px;fill:none;stroke:currentColor;stroke-width:1.7;stroke-linecap:round;stroke-linejoin:round}
        #updown-store .udm-count{position:absolute;right:0;top:0;display:grid;place-items:center;min-width:16px;height:16px;padding:0 3px;border-radius:999px;background:#c9a65f;color:#0b493d;border:2px solid #0b493d;font:800 8px/1 Inter,sans-serif}
        #updown-store .udm-search{position:fixed;inset:0;z-index:1100;display:none;background:#0d0f0f;color:#fff;padding:max(24px,env(safe-area-inset-top)) 22px 28px;overflow:auto}
        #updown-store .udm-search.is-open{display:block}
        #updown-store .udm-search-top{display:flex;align-items:center;gap:12px;margin-top:34px}
        #updown-store .udm-search-icon{width:28px;height:28px;flex:0 0 28px;opacity:.75}
        #updown-store .udm-search-icon svg{width:100%;height:100%;fill:none;stroke:currentColor;stroke-width:1.7}
        #updown-store .udm-input{min-width:0;flex:1;border:0;border-bottom:1px solid rgba(255,255,255,.16);border-radius:0;background:transparent;color:#fff;padding:8px 0 12px;outline:none;font:600 30px/1.15 Inter,sans-serif}
        #updown-store .udm-input::placeholder{color:#7f8084}
        #updown-store .udm-close{position:absolute;right:18px;top:max(18px,env(safe-area-inset-top));width:42px;height:42px;border:0;background:transparent;color:#ddd;font-size:34px;font-weight:200;line-height:1}
        #updown-store .udm-label{margin:62px 0 18px;color:#777;font:500 17px/1.2 Inter,sans-serif}
        #updown-store .udm-results{display:grid;gap:2px}
        #updown-store .udm-result{display:flex;align-items:center;gap:14px;width:100%;padding:13px 0;border:0;background:transparent;color:#eee;text-align:left;font:600 18px/1.25 Inter,sans-serif}
        #updown-store .udm-result:before{content:'→';color:#7d8082;font-size:22px;font-weight:400}
        #updown-store .udm-empty{padding:14px 0;color:#777;font:500 16px/1.45 Inter,sans-serif}
        #updown-store .uds-mobile-dock,#updown-store .uds-mobile-bottom-nav,#updown-store .uds-bottom-nav,#updown-store .uds-bottom-dock,#updown-store .uds-floating-nav,#updown-store .uds-mobile-nav-fixed,#updown-store #udsMobileDock,#updown-store #udsBottomNav,#updown-store #udsMobileBottomNav,#updown-store .uds-dock{display:none!important;visibility:hidden!important;pointer-events:none!important}
        #updown-store{padding-bottom:0!important}
        #updown-store .uds-hero{margin-top:0!important}
      }
    `;document.head.appendChild(s);
  }
  function cartCount(){try{const c=JSON.parse(localStorage.getItem("upDownCart")||"[]");return Array.isArray(c)?c.reduce((n,x)=>n+Number(x.quantity||0),0):0}catch(e){return 0}}
  function updateCount(){const n=document.getElementById("udmCount");if(n)n.textContent=String(cartCount())}
  function candidates(q){const r=root();if(!r)return[];const needle=q.trim().toLowerCase();if(!needle)return[];const nodes=[...r.querySelectorAll("#udsCatalog article, #udsCatalog .uds-product-card, #udsCatalog .uds-card, #udsNew article")];const seen=new Set(),out=[];for(const node of nodes){const text=(node.textContent||"").replace(/\s+/g," ").trim();if(!text||!text.toLowerCase().includes(needle))continue;const title=node.querySelector("h2,h3,h4,strong")?.textContent?.trim()||text.slice(0,90);if(seen.has(title))continue;seen.add(title);out.push({title,node});if(out.length>=6)break}return out}
  function renderResults(){const input=document.getElementById("udmInput"),box=document.getElementById("udmResults"),label=document.getElementById("udmLabel");if(!input||!box||!label)return;const q=input.value.trim();label.textContent=q?"Sugerencias":"Búsquedas rápidas";box.innerHTML="";if(!q){["Drivers","Maderas","Hierros","Putters","TaylorMade","Callaway"].forEach(v=>addResult(box,v,()=>{input.value=v;syncSearch(v);renderResults()}));return}const found=candidates(q);if(!found.length){box.innerHTML='<div class="udm-empty">No encontramos coincidencias todavía. Presiona Enter para ver el catálogo filtrado.</div>';return}found.forEach(x=>addResult(box,x.title,()=>{closeSearch();const trigger=x.node.querySelector("button,a");if(trigger)trigger.click();else x.node.click()}))}
  function addResult(box,label,fn){const b=document.createElement("button");b.type="button";b.className="udm-result";b.textContent=label;b.onclick=fn;box.appendChild(b)}
  function openSearch(){const p=document.getElementById("udmSearch");if(!p)return;p.classList.add("is-open");document.body.style.overflow="hidden";setTimeout(()=>document.getElementById("udmInput")?.focus(),60);renderResults()}
  function closeSearch(){document.getElementById("udmSearch")?.classList.remove("is-open");document.body.style.overflow=""}
  function syncSearch(q){["udsSearch","udsCatalogSearch"].forEach(id=>{const t=document.getElementById(id);if(t){t.value=q;t.dispatchEvent(new Event("input",{bubbles:true}))}})}
  function clickOriginal(selectors){for(const selector of selectors){const target=document.querySelector(selector);if(target&&target.offsetParent!==null){target.click();return true}}for(const selector of selectors){const target=document.querySelector(selector);if(target){target.click();return true}}return false}
  function openCart(){if(!clickOriginal(["#udsCartButton","[data-action='cart']","[aria-label*='Carrito']","[aria-label*='Cart']"]))console.warn("[UPDOWN mobile] cart trigger not found")}
  function openMenu(){if(!clickOriginal(["#udsMenuButton","#udsMobileMenuButton","[data-action='menu']"]))console.warn("[UPDOWN mobile] menu trigger not found")}
  function install(){
    if(!mobile())return;const r=root(),top=r?.querySelector(".uds-header .uds-topbar");if(!r||!top)return;r.querySelector(".uds-announcement")?.remove();
    if(!top.querySelector(".udm-header")){
      const original=top.querySelector(".uds-original-vector-logo svg");const h=document.createElement("div");h.className="udm-header";
      h.innerHTML=`<a class="udm-mark" href="#udsHome" aria-label="UP AND DOWN inicio">${original?original.outerHTML:""}</a><div class="udm-actions"><button class="udm-btn" id="udmSearchBtn" aria-label="Buscar">${icon("search")}</button><button class="udm-btn" id="udmCartBtn" aria-label="Carrito">${icon("cart")}<span class="udm-count" id="udmCount">0</span></button><button class="udm-btn" id="udmMenuBtn" aria-label="Menú">${icon("menu")}</button></div>`;top.appendChild(h);
      h.querySelector("#udmSearchBtn").addEventListener("click",e=>{e.preventDefault();e.stopPropagation();openSearch()});
      h.querySelector("#udmCartBtn").addEventListener("click",e=>{e.preventDefault();e.stopPropagation();openCart()});
      h.querySelector("#udmMenuBtn").addEventListener("click",e=>{e.preventDefault();e.stopPropagation();openMenu()});
    }
    if(!document.getElementById("udmSearch")){
      const p=document.createElement("section");p.id="udmSearch";p.className="udm-search";p.innerHTML=`<button class="udm-close" id="udmClose" aria-label="Cerrar">×</button><div class="udm-search-top"><span class="udm-search-icon">${icon("search")}</span><input id="udmInput" class="udm-input" type="search" autocomplete="off" placeholder="Buscar"></div><div class="udm-label" id="udmLabel">Búsquedas rápidas</div><div class="udm-results" id="udmResults"></div>`;r.appendChild(p);p.querySelector("#udmClose").onclick=closeSearch;const i=p.querySelector("#udmInput");i.addEventListener("input",()=>{syncSearch(i.value);renderResults()});i.addEventListener("keydown",e=>{if(e.key==="Enter"){syncSearch(i.value);closeSearch();document.getElementById("udsCatalog")?.scrollIntoView({behavior:"smooth",block:"start"})}})
    }
    ["udsDockShop","udsDockSearch","udsDockAdvisor","udsDockCart"].forEach(id=>document.getElementById(id)?.closest("nav,div")?.classList.add("uds-dock"));updateCount();
  }
  function boot(){installStyles();install();observer?.disconnect();observer=new MutationObserver(()=>{install();updateCount()});const r=root();if(r)observer.observe(r,{childList:true,subtree:true})}
  if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",boot);else boot();window.addEventListener("resize",install);window.addEventListener("storage",updateCount);
})();
