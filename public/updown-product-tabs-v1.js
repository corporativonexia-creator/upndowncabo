(()=>{
"use strict";
if(window.__UPDOWN_PRODUCT_TABS_V1__)return;window.__UPDOWN_PRODUCT_TABS_V1__=true;
const $=s=>document.querySelector(s);
function boot(){
 const root=$("#updown-admin");if(!root)return false;
 const grid=$("#updown-admin .u-grid"), form=$("#udProductForm"), list=$("#udList");
 if(!grid||!form||!list||$("#udProductWorkspaceTabs"))return false;
 const formPanel=form.closest(".u-panel"), listPanel=list.closest(".u-panel");if(!formPanel||!listPanel)return false;
 const tabs=document.createElement("div");tabs.id="udProductWorkspaceTabs";tabs.className="ud-product-workspace-tabs";
 tabs.innerHTML='<button type="button" data-view="catalog" class="is-active">Catálogo</button><button type="button" data-view="form">Alta de producto</button>';
 grid.parentElement?.insertBefore(tabs,grid);
 const style=document.createElement("style");style.textContent=`#updown-admin .ud-product-workspace-tabs{display:flex;gap:8px;margin:0 0 16px;padding:5px;width:max-content;max-width:100%;background:#e9eeeb;border:1px solid rgba(20,62,53,.10);border-radius:15px}#updown-admin .ud-product-workspace-tabs button{border:0;background:transparent;color:#48645b;padding:10px 18px;border-radius:11px;font-weight:800;cursor:pointer}#updown-admin .ud-product-workspace-tabs button.is-active{background:#fff;color:#143e35;box-shadow:0 5px 16px rgba(20,62,53,.10)}#updown-admin .u-grid.ud-catalog-only{grid-template-columns:1fr}#updown-admin .u-grid.ud-form-only{grid-template-columns:minmax(0,760px);justify-content:center}#updown-admin .u-grid.ud-catalog-only ${formPanel.id?'#'+formPanel.id:'.u-panel:first-child'},#updown-admin .u-grid.ud-form-only ${listPanel.id?'#'+listPanel.id:'.u-panel:last-child'}{display:none!important}@media(max-width:760px){#updown-admin .ud-product-workspace-tabs{width:100%}#updown-admin .ud-product-workspace-tabs button{flex:1;padding:10px 8px}}`;document.head.appendChild(style);
 function show(view){grid.classList.toggle("ud-catalog-only",view==="catalog");grid.classList.toggle("ud-form-only",view==="form");formPanel.style.display=view==="form"?"":"none";listPanel.style.display=view==="catalog"?"":"none";tabs.querySelectorAll("button").forEach(b=>b.classList.toggle("is-active",b.dataset.view===view));if(view==="form")setTimeout(()=>$("#udName")?.focus(),80)}
 tabs.addEventListener("click",e=>{const b=e.target.closest("button[data-view]");if(b)show(b.dataset.view)});
 document.addEventListener("click",e=>{if(e.target.closest?.("#udNew")){show("form");setTimeout(()=>window.scrollTo({top:0,behavior:"smooth"}),20)}if(e.target.closest?.("#udCancel"))show("catalog");if(e.target.closest?.(".ud-edit"))show("form")},true);
 show("catalog");return true;
}
let n=0;const t=setInterval(()=>{if(boot()||++n>100)clearInterval(t)},250);
})();