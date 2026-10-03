(function(){
  "use strict";

  const ROOT_ID="updown-store";
  const COURSE_BATCH=3;
  let visibleCourses=COURSE_BATCH;
  let courseObserver=null;

  function root(){return document.getElementById(ROOT_ID)}
  function isEnglish(){return document.documentElement.lang==="en"}

  function installStyles(){
    if(document.getElementById("updown-h60-styles"))return;
    const style=document.createElement("style");
    style.id="updown-h60-styles";
    style.textContent=`
      /* H62 · responsive header: desktop y mobile no comparten geometría */
      #updown-store .uds-announcement{display:none!important;height:0!important;min-height:0!important;padding:0!important;margin:0!important;overflow:hidden!important}
      #updown-store .uds-header{position:relative!important;z-index:80!important;width:100%!important;max-width:none!important;margin:0!important;padding:0!important;background:#0b493d!important;border:0!important;border-radius:0!important;box-shadow:none!important;color:#fff!important}
      #updown-store .uds-header .uds-topbar{box-sizing:border-box!important;background:#0b493d!important;border:0!important;border-radius:0!important;box-shadow:none!important}
      #updown-store .uds-header .uds-logo,#updown-store .uds-header .uds-logo-copy,#updown-store .uds-header .uds-logo-copy strong,#updown-store .uds-header .uds-logo-copy span,#updown-store .uds-header .uds-original-vector-logo,#updown-store .uds-header .uds-nav-link{color:#fff!important}
      #updown-store .uds-header .uds-logo{margin:0!important;padding:0!important;text-decoration:none!important}
      #updown-store .uds-header .uds-original-vector-logo svg{display:block!important;width:100%!important;height:100%!important;overflow:visible!important}
      #updown-store .uds-header .uds-original-vector-logo svg path{fill:currentColor!important}
      #updown-store .uds-header .uds-logo-copy{margin:0!important;padding:0!important}
      #updown-store .uds-header .uds-logo-copy strong,#updown-store .uds-header .uds-logo-copy span{display:block!important;margin:0!important;padding:0!important}
      #updown-store .uds-header .uds-icon-btn{flex:0 0 auto!important}
      #updown-store .uds-course-more-wrap{display:flex;justify-content:center;padding-top:24px}
      #updown-store .uds-course-more{appearance:none;border:1px solid rgba(11,73,61,.22);background:#fff;color:#0b493d;min-height:44px;padding:0 24px;border-radius:999px;font:700 12px/1 system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;letter-spacing:.08em;text-transform:uppercase;cursor:pointer}
      #updown-store .uds-course-more:hover{background:#0b493d;color:#fff}
      #updown-store .uds-mobile-quick-actions,#updown-store .uds-mobile-search-panel{display:none}

      @media (min-width:761px){
        #updown-store .uds-header{min-height:78px!important}
        #updown-store .uds-header .uds-topbar{width:100%!important;max-width:1440px!important;min-height:78px!important;margin:0 auto!important;padding:10px clamp(22px,3vw,48px)!important;display:grid!important;grid-template-columns:minmax(250px,320px) minmax(0,1fr) auto!important;align-items:center!important;gap:clamp(16px,2vw,30px)!important}
        #updown-store .uds-header .uds-menu-btn{display:none!important}
        #updown-store .uds-header .uds-logo{display:grid!important;grid-template-columns:108px minmax(0,1fr)!important;align-items:center!important;gap:13px!important;width:100%!important;min-width:0!important}
        #updown-store .uds-header .uds-original-vector-logo{display:block!important;width:108px!important;height:42px!important}
        #updown-store .uds-header .uds-logo-copy{display:flex!important;flex-direction:column!important;justify-content:center!important;min-width:0!important;white-space:nowrap!important}
        #updown-store .uds-header .uds-logo-copy strong{font-size:17px!important;line-height:1.05!important;letter-spacing:.17em!important;font-weight:600!important}
        #updown-store .uds-header .uds-logo-copy span{margin-top:5px!important;font-size:6.5px!important;line-height:1!important;letter-spacing:.17em!important;font-weight:600!important}
        #updown-store .uds-header .uds-desktop-nav{display:flex!important;align-items:center!important;justify-content:center!important;gap:clamp(12px,1.35vw,21px)!important;min-width:0!important;white-space:nowrap!important}
        #updown-store .uds-header .uds-nav-link{font-size:10.5px!important;line-height:1!important;font-weight:700!important;letter-spacing:.035em!important}
        #updown-store .uds-header .uds-nav-ghin-icon{flex:0 0 auto!important}
        #updown-store .uds-header .uds-top-actions{display:flex!important;align-items:center!important;justify-content:flex-end!important;gap:8px!important;white-space:nowrap!important}
      }

      @media (max-width:760px){
        #updown-store .uds-header{min-height:58px!important;height:58px!important;position:sticky!important;top:0!important;z-index:500!important}
        #updown-store .uds-header .uds-topbar{width:100%!important;max-width:none!important;height:58px!important;min-height:58px!important;margin:0!important;padding:7px 10px 7px 12px!important;display:grid!important;grid-template-columns:minmax(0,1fr) auto!important;align-items:center!important;gap:8px!important}
        #updown-store .uds-header .uds-logo{grid-column:1!important;grid-row:1!important;display:grid!important;grid-template-columns:58px minmax(0,1fr)!important;align-items:center!important;gap:7px!important;width:min(205px,100%)!important;min-width:0!important;overflow:visible!important}
        #updown-store .uds-header .uds-original-vector-logo{display:block!important;width:58px!important;height:26px!important}
        #updown-store .uds-header .uds-logo-copy{display:flex!important;flex-direction:column!important;justify-content:center!important;min-width:0!important;white-space:nowrap!important;overflow:hidden!important}
        #updown-store .uds-header .uds-logo-copy strong{font-size:11px!important;line-height:1!important;letter-spacing:.09em!important;font-weight:600!important}
        #updown-store .uds-header .uds-logo-copy span{margin-top:4px!important;font-size:4.6px!important;line-height:1!important;letter-spacing:.09em!important;font-weight:600!important}
        #updown-store .uds-header .uds-desktop-nav,#updown-store .uds-header .uds-top-actions,#updown-store .uds-header>.uds-topbar>.uds-menu-btn{display:none!important}
        #updown-store .uds-mobile-quick-actions{grid-column:2!important;grid-row:1!important;display:flex!important;align-items:center!important;justify-content:flex-end!important;gap:6px!important}
        #updown-store .uds-mobile-quick-btn{position:relative!important;display:inline-flex!important;align-items:center!important;justify-content:center!important;width:38px!important;height:38px!important;min-width:38px!important;padding:0!important;border:1px solid rgba(255,255,255,.18)!important;border-radius:50%!important;background:rgba(255,255,255,.98)!important;color:#0b493d!important;box-shadow:0 3px 14px rgba(0,0,0,.08)!important}
        #updown-store .uds-mobile-quick-btn svg{width:18px!important;height:18px!important;fill:none!important;stroke:currentColor!important;stroke-width:1.8!important}
        #updown-store .uds-mobile-cart-count{position:absolute;right:-3px;top:-3px;display:grid;place-items:center;min-width:17px;height:17px;padding:0 4px;border-radius:999px;background:#c8a86b;color:#0b493d;font-size:8px;font-weight:800;border:2px solid #0b493d}
        #updown-store .uds-mobile-search-panel{display:block;position:fixed;z-index:520;left:0;right:0;top:58px;padding:10px 12px 14px;background:rgba(11,73,61,.98);transform:translateY(-130%);opacity:0;pointer-events:none;transition:transform .22s ease,opacity .18s ease;box-shadow:0 16px 32px rgba(4,28,23,.22)}
        #updown-store .uds-mobile-search-panel.is-open{transform:translateY(0);opacity:1;pointer-events:auto}
        #updown-store .uds-mobile-search-wrap{display:flex;align-items:center;gap:8px;max-width:680px;margin:auto}
        #updown-store .uds-mobile-search-input{width:100%;height:44px;border:0;border-radius:14px;padding:0 15px;background:#fff;color:#17201d;outline:none;font-size:16px;box-shadow:inset 0 0 0 1px rgba(11,73,61,.08)}
        #updown-store .uds-mobile-search-close{display:inline-flex;align-items:center;justify-content:center;width:44px;height:44px;flex:0 0 44px;border:0;border-radius:50%;background:rgba(255,255,255,.13);color:#fff;font-size:22px;line-height:1}
        #updown-store .uds-hero{margin-top:0!important}
        #updown-store .uds-course-more-wrap{padding-top:18px}
        #updown-store .uds-course-more{width:100%;max-width:280px}
      }
    `;
    document.head.appendChild(style);
  }

  function updateMobileCartCount(){
    const count=document.getElementById("udsMobileCartCount"); if(!count)return;
    try{const cart=JSON.parse(localStorage.getItem("upDownCart")||"[]");count.textContent=String(Array.isArray(cart)?cart.reduce((sum,item)=>sum+Number(item.quantity||0),0):0)}catch(e){count.textContent="0"}
  }

  function installMobileHeader(){
    const r=root(); const topbar=r?.querySelector(".uds-header .uds-topbar"); if(!r||!topbar||topbar.querySelector(".uds-mobile-quick-actions"))return;
    const actions=document.createElement("div"); actions.className="uds-mobile-quick-actions";
    actions.innerHTML=`<button type="button" class="uds-mobile-quick-btn" id="udsMobileSearchButton" aria-label="Buscar productos"><svg viewBox="0 0 24 24"><circle cx="11" cy="11" r="6.5"></circle><path d="m16 16 4 4"></path></svg></button><button type="button" class="uds-mobile-quick-btn" id="udsMobileCartButton" aria-label="Abrir carrito"><svg viewBox="0 0 24 24"><path d="M3 4h2l2.1 10.2a2 2 0 0 0 2 1.6h7.8a2 2 0 0 0 2-1.6L20 8H6.2"></path><circle cx="10" cy="20" r="1"></circle><circle cx="18" cy="20" r="1"></circle></svg><span class="uds-mobile-cart-count" id="udsMobileCartCount">0</span></button><button type="button" class="uds-mobile-quick-btn" id="udsMobileMenuButton" aria-label="Abrir menú"><svg viewBox="0 0 24 24"><path d="M5 7h14M5 12h14M5 17h14"></path></svg></button>`;
    topbar.appendChild(actions);

    const panel=document.createElement("div"); panel.className="uds-mobile-search-panel"; panel.id="udsMobileSearchPanel"; panel.innerHTML=`<div class="uds-mobile-search-wrap"><input type="search" class="uds-mobile-search-input" id="udsMobileSearchInput" placeholder="${isEnglish()?"Search products, brands or models…":"Buscar productos, marcas o modelos…"}" aria-label="${isEnglish()?"Search products":"Buscar productos"}"><button type="button" class="uds-mobile-search-close" id="udsMobileSearchClose" aria-label="${isEnglish()?"Close search":"Cerrar búsqueda"}">×</button></div>`;
    r.querySelector(".uds-header")?.insertAdjacentElement("afterend",panel);

    const input=panel.querySelector("#udsMobileSearchInput");
    actions.querySelector("#udsMobileSearchButton").onclick=()=>{panel.classList.toggle("is-open");if(panel.classList.contains("is-open"))setTimeout(()=>input?.focus(),80)};
    panel.querySelector("#udsMobileSearchClose").onclick=()=>panel.classList.remove("is-open");
    actions.querySelector("#udsMobileCartButton").onclick=()=>{document.getElementById("udsFloatingCart")?.click()||document.getElementById("udsCartButton")?.click()};
    actions.querySelector("#udsMobileMenuButton").onclick=()=>document.getElementById("udsMenuButton")?.click();
    input?.addEventListener("input",()=>{const q=String(input.value||"");["udsSearch","udsCatalogSearch"].forEach(id=>{const target=document.getElementById(id);if(target){target.value=q;target.dispatchEvent(new Event("input",{bubbles:true}))}})});
    input?.addEventListener("keydown",e=>{if(e.key==="Enter"){document.getElementById("udsCatalog")?.scrollIntoView({behavior:"smooth",block:"start"});panel.classList.remove("is-open");input.blur()}});
    updateMobileCartCount();
    window.addEventListener("storage",updateMobileCartCount);
    document.addEventListener("click",e=>{if(e.target.closest?.(".uds-add,.uds-minus,.uds-plus,.uds-remove"))setTimeout(updateMobileCartCount,50)});
  }

  function updateNavigationCopy(){
    const r=root(); if(!r)return;
    const courses=r.querySelector('[data-nav-key="courses"]');
    const journal=r.querySelector('[data-nav-key="journal"]');
    if(courses)courses.textContent=isEnglish()?"Golf in Cabo":"Golf en Cabo";
    if(journal)journal.textContent=isEnglish()?"News":"Noticias";
    const nav=r.querySelector(".uds-desktop-nav");
    if(nav&&!nav.querySelector('[data-nav-key="about"]')){
      const link=document.createElement("a"); link.className="uds-nav-link"; link.dataset.navKey="about"; link.href="#udsAbout"; link.textContent=isEnglish()?"About us":"Quiénes somos"; nav.appendChild(link);
    }
    const mobileInput=document.getElementById("udsMobileSearchInput"); if(mobileInput)mobileInput.placeholder=isEnglish()?"Search products, brands or models…":"Buscar productos, marcas o modelos…";
  }

  function ensureCourseMoreButton(){
    const section=document.getElementById("udsCourses"); const grid=section?.querySelector(".uds-course-grid"); if(!section||!grid)return null;
    let wrap=section.querySelector(".uds-course-more-wrap"); let button=section.querySelector("#udsCourseMore");
    if(!wrap){wrap=document.createElement("div");wrap.className="uds-course-more-wrap";grid.insertAdjacentElement("afterend",wrap)}
    if(!button){button=document.createElement("button");button.id="udsCourseMore";button.type="button";button.className="uds-course-more";wrap.appendChild(button)}
    return button;
  }

  function renderCoursePage(reset){
    const grid=document.querySelector("#udsCourses .uds-course-grid"); if(!grid)return;
    const cards=[...grid.querySelectorAll(":scope > .uds-course")];
    if(reset)visibleCourses=COURSE_BATCH;
    visibleCourses=Math.max(COURSE_BATCH,Math.min(visibleCourses,cards.length||COURSE_BATCH));
    cards.forEach((card,index)=>{card.hidden=index>=visibleCourses});
    const button=ensureCourseMoreButton(); if(!button)return;
    const hasMore=cards.length>visibleCourses;
    button.hidden=!hasMore; button.classList.toggle("uds-hidden",!hasMore); button.textContent=isEnglish()?"View more courses":"Ver más campos"; button.setAttribute("aria-expanded",String(!hasMore));
    button.onclick=()=>{visibleCourses=Math.min(visibleCourses+COURSE_BATCH,cards.length);renderCoursePage(false)};
  }

  function watchCourses(){
    const grid=document.querySelector("#udsCourses .uds-course-grid"); if(!grid)return;
    courseObserver?.disconnect(); courseObserver=new MutationObserver(()=>renderCoursePage(true)); courseObserver.observe(grid,{childList:true}); renderCoursePage(true);
  }

  function watchLanguage(){
    const observer=new MutationObserver(()=>{updateNavigationCopy();renderCoursePage(false)});
    observer.observe(document.documentElement,{attributes:true,attributeFilter:["lang"]});
  }

  function boot(){installStyles();installMobileHeader();updateNavigationCopy();watchCourses();watchLanguage()}
  if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",boot,{once:true}); else boot();
})();
