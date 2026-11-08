/* UpNDown Web 2.0 / Stage 7 — presentation-only services. /vista-previa */
(function(){
  "use strict";
  if(typeof window.__UPDOWN_STAGE7_SERVICES_TEARDOWN__==="function"){
    window.__UPDOWN_STAGE7_SERVICES_TEARDOWN__();
  }

  const root=document.getElementById("updown-store");
  if(!root?.classList.contains("uds-preview"))return;

  const lang=()=>document.documentElement.lang.toLowerCase().startsWith("en")?"en":"es";
  const byKind=(kind)=>root.querySelector('#udsServices [data-service-kind="'+kind+'"]');

  const copies={
    repair:{
      es:{eyebrow:"Cuidado y reparación de equipo",title:"Reparación y mantenimiento",
        description:"Preparamos y cuidamos tu equipo de golf para la próxima ronda. Los trabajos están sujetos a evaluación, disponibilidad y cotización.",
        items:["Cambio de grips","Cambio de varilla","Limpieza profunda"],
        action:"Consultar reparación o mantenimiento",
        note:"Revisamos cada pieza y confirmamos las opciones antes de iniciar cualquier trabajo."},
      en:{eyebrow:"Equipment care and repair",title:"Repair and maintenance",
        description:"Care and service for your golf equipment. Work is subject to inspection, availability, and a quote.",
        items:["Grip replacement","Shaft replacement","Deep cleaning"],
        action:"Ask about repair or maintenance",
        note:"We inspect each club and confirm the available options before starting."}
    },
    trade:{
      es:{eyebrow:"Valoración presencial",title:"Intercambios y consignación",
        description:"Podemos revisar tu equipo para explorar alternativas de intercambio o consignación, sujetas a evaluación y aceptación.",
        items:["Intercambia tu equipo como parte de pago","Consignación de equipo sujeto a valoración","Condiciones acordadas antes de cualquier operación"],
        action:"Consultar intercambio o consignación",
        note:"La aceptación, valoración y condiciones se confirman directamente con el equipo de la tienda."},
      en:{eyebrow:"In-store assessment",title:"Trade-ins and consignment",
        description:"Bring your equipment for evaluation of potential trade-in or consignment options, subject to approval.",
        items:["Trade equipment toward a purchase","Consignment subject to evaluation","Terms agreed before proceeding"],
        action:"Ask about trade-ins or consignment",
        note:"Acceptance, valuation, and terms are confirmed with the store."}
    },
    "putter-restoration":{
      es:{eyebrow:"PRÓXIMAMENTE",title:"Ajuste de lie y loft",
        description:"Estamos preparando el servicio de ajuste de lie y loft para palos de golf.",
        items:["Servicio aún no disponible para solicitar o agendar"],
        note:"Publicaremos más información cuando se encuentre disponible."},
      en:{eyebrow:"COMING SOON",title:"Lie and loft adjustment",
        description:"We are preparing a lie and loft adjustment service for golf clubs.",
        items:["This service is not available to request or book yet"],
        note:"More information will be available once the service launches."}
    }
  };

  function setCard(key){
    const card=byKind(key);
    if(!card)return;
    const data=copies[key]?.[lang()];
    if(!data)return;
    const head=card.querySelector(".uds-service-head");
    const title=card.querySelector(".uds-service-title h3");
    const eyebrow=card.querySelector(".uds-service-title small");
    const body=card.querySelector(".uds-service-body");
    if(!head||!title||!eyebrow||!body)return;

    title.textContent=data.title;
    eyebrow.textContent=data.eyebrow;
    eyebrow.hidden=false;
    card.classList.add("uds-preview-service-compact");
    const comingSoon=key==="putter-restoration";
    card.classList.toggle("uds-preview-service-coming",comingSoon);

    // Old mobile shortcuts still target /putter/i; keep a hidden text alias,
    // without exposing a misleading restoration service to shoppers.
    if(comingSoon){
      const alias=document.createElement("span");
      alias.hidden=true;
      alias.setAttribute("aria-hidden","true");
      alias.textContent=" putter restoration";
      title.appendChild(alias);
      head.querySelector(".uds-service-photo")?.remove();
      card.classList.remove("has-service-photo");
    }

    // Reuse the already-resolved WhatsApp anchor, preserving attribution.
    // For a coming-soon service there must be no booking/contact CTA.
    const action=comingSoon?null:body.querySelector(".uds-service-actions");
    body.replaceChildren();
    const description=document.createElement("p");
    description.textContent=data.description;
    body.appendChild(description);
    const points=document.createElement("div");
    points.className="uds-service-points";
    data.items.forEach(label=>{
      const point=document.createElement("div");
      point.className="uds-service-point";
      point.textContent=label;
      points.appendChild(point);
    });
    body.appendChild(points);
    if(action){
      const link=action.querySelector("a");
      if(link){
        link.textContent=data.action;
        body.appendChild(action);
      }
    }
    const note=document.createElement("div");
    note.className="uds-service-note";
    note.textContent=data.note;
    body.appendChild(note);
    if(comingSoon){
      head.setAttribute("aria-label",data.title+" · "+data.eyebrow);
    }
  }

  function apply(){
    if(!root.isConnected)return;
    const arrivals=root.querySelector("#udsNew");
    const section=root.querySelector("#udsServices");
    const catalog=root.querySelector("#udsCatalog");
    const grid=section?.querySelector(".uds-services-grid");
    if(!arrivals||!section||!catalog||!grid)return;

    // Preserve every existing DOM node and the protected classes lead form.
    if(arrivals.nextElementSibling!==section)arrivals.insertAdjacentElement("afterend",section);
    const intro=section.querySelector(".uds-section-intro");
    if(intro){
      intro.textContent=lang()==="en"
        ?"Equipment care, trade-ins, consignment and guidance in one place."
        :"Cuidado de equipo, intercambios, consignación y asesoría en un solo lugar.";
    }

    for(const kind of ["repair","trade","putter-restoration"])setCard(kind);
    const repair=byKind("repair");
    const maintenance=byKind("maintenance");
    if(maintenance){
      const merge=Boolean(repair?.isConnected);
      maintenance.classList.toggle("uds-preview-service-merged",merge);
      maintenance.setAttribute("aria-hidden",String(merge));
      if(merge){
        maintenance.classList.remove("is-open");
        maintenance.querySelector(".uds-service-head")?.setAttribute("aria-expanded","false");
      }
    }

    // Commercial order; keep all admin-created and third-party services.
    const prioritized=["repair","trade","putter-restoration","classes","ghin"];
    const extraCards=[...grid.querySelectorAll(":scope > [data-service-card]")]
      .filter(card=>!prioritized.includes(card.dataset.serviceKind));
    for(const kind of prioritized){
      const card=byKind(kind);
      if(card&&card.parentElement===grid)grid.appendChild(card);
    }
    // Custom admin-managed services stay visible after the main grouped cards.
    // The hidden maintenance node remains connected for legacy integrations.
    for(const card of extraCards)grid.appendChild(card);
    root.classList.add("uds-preview-services-stage7");
  }

  function updateMobileServiceMenu(){
    const menu=document.getElementById("udsMobileMenu53");
    if(!menu)return;
    for(const btn of menu.querySelectorAll(".uds53-group .uds53-sub > button")){
      const label=(btn.textContent||"").trim().toLowerCase();
      if(["reparación","repair"].includes(label)){
        btn.textContent=lang()==="en"?"Repair and maintenance":"Reparación y mantenimiento";
      }else if(["intercambios","trade-ins"].includes(label)){
        btn.textContent=lang()==="en"?"Trade-ins and consignment":"Intercambios y consignación";
      }else if(["mantenimiento","maintenance"].includes(label)){
        btn.hidden=true;
      }else if(["restauración de putters","putter restoration"].includes(label)){
        btn.textContent=lang()==="en"?"Lie and loft · Coming soon":"Ajuste de lie y loft · Próximamente";
      }
    }
  }
  function onMobileMenuClick(event){
    if(event.target.closest("#udsMenuButton, #udsDockMenu")){
      requestAnimationFrame(updateMobileServiceMenu);
    }
  }
  root.addEventListener("click",onMobileMenuClick,true);

  const onReady=()=>apply();
  window.addEventListener("updown:services-ready",onReady);
  window.addEventListener("updown:language-change",onReady);
  const dispose=()=>{
    window.removeEventListener("updown:services-ready",onReady);
    window.removeEventListener("updown:language-change",onReady);
    root.removeEventListener("click",onMobileMenuClick,true);
    window.removeEventListener("updown:preview-services-dispose",dispose);
    if(window.__UPDOWN_STAGE7_SERVICES_TEARDOWN__===dispose){
      window.__UPDOWN_STAGE7_SERVICES_TEARDOWN__=null;
    }
  };
  window.__UPDOWN_STAGE7_SERVICES_TEARDOWN__=dispose;
  window.addEventListener("updown:preview-services-dispose",dispose,{once:true});
  apply();
})();
