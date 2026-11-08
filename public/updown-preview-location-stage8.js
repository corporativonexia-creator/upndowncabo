/* UpNDown Web 2.0 / Stage 8 — local store location, preview only. */
(function(){
  "use strict";
  if(typeof window.__UPDOWN_PREVIEW_LOCATION_DISPOSE__==="function"){
    window.__UPDOWN_PREVIEW_LOCATION_DISPOSE__();
  }
  const root=document.getElementById("updown-store");
  if(!root?.classList.contains("uds-preview"))return;
  const mapsUrl="https://maps.app.goo.gl/C3v3f8djdNrtRrmC7";
  const address="Plaza Alba 206, El Tezal, 23454 Cabo San Lucas, B.C.S.";
  const number="+52 624 355 4700";
  const locale=()=>document.documentElement.lang.toLowerCase().startsWith("en")?"en":"es";
  const copies={
    es:{
      kicker:"TE ESPERAMOS EN CABO SAN LUCAS",
      title:"Visítanos en UP AND DOWN",
      intro:"El equipo ideal también se encuentra en persona. Ven a conocer la tienda y recibe orientación para tu próxima ronda.",
      addressTitle:"Dónde estamos",
      directionsTitle:"Cómo encontrarnos",
      directions:"Accede por la lateral, entre Plaza Patio La Luna y Galerías El Triunfo. En la primera cuadra, gira a la izquierda. Estamos casi frente a MASXMENOSCABO, en Plaza Alba 206.",
      hoursTitle:"Horario temporal de apertura",
      hours:"Lunes a domingo · 12:00 p. m. a 8:00 p. m.",
      hoursNote:"Atención por WhatsApp las 24 horas, los 7 días de la semana.",
      map:"Cómo llegar en Google Maps",
      chat:"Escríbenos por WhatsApp",
      contactTitle:"Contacto directo",
      footerDirections:"Cómo llegar · Plaza Alba 206",
      footerHours:"Horario: todos los días de 12 p. m. a 8 p. m.",
      accessible:"Abrir ubicación de UP AND DOWN Cabo en Google Maps"
    },
    en:{
      kicker:"VISIT US IN CABO SAN LUCAS",
      title:"Visit UP AND DOWN",
      intro:"Great equipment deserves a personal look. Explore our store and get advice for your next round.",
      addressTitle:"Find our store",
      directionsTitle:"Directions",
      directions:"Use the frontage road between Plaza Patio La Luna and Galerías El Triunfo. Turn left at the first block. We're almost opposite MASXMENOSCABO, in Plaza Alba 206.",
      hoursTitle:"Temporary opening hours",
      hours:"Monday–Sunday · 12:00 p.m. to 8:00 p.m.",
      hoursNote:"WhatsApp assistance available 24/7.",
      map:"Directions in Google Maps",
      chat:"Message us on WhatsApp",
      contactTitle:"Direct contact",
      footerDirections:"Directions · Plaza Alba 206",
      footerHours:"Hours: daily, 12 p.m.–8 p.m.",
      accessible:"Open UP AND DOWN Cabo's location in Google Maps"
    }
  };
  function whatsappUrl(){
    const msg=locale()==="en"
      ?"Hello UP AND DOWN Cabo! I saw your store online and would like to know how to get to Plaza Alba 206 in El Tezal, and ask about your golf equipment. Thank you!"
      :"¡Hola! Vi la tienda UP AND DOWN Cabo en su página web. Me gustaría saber cómo llegar a Plaza Alba 206, en El Tezal, y recibir información sobre sus equipos de golf. ¡Gracias!";
    let referral="";
    try{
      let code=new URLSearchParams(window.location.search).get("ref");
      if(!code){
        const stored=JSON.parse(localStorage.getItem("upDownAffiliateReferral")||"null");
        if(stored&&Number(stored.expires_at)>Date.now())code=stored.code;
      }
      if(code&&/^[a-z0-9_-]{1,48}$/i.test(String(code)))referral=String(code).toUpperCase();
    }catch{/* private browsing can disable storage */}
    return "https://wa.me/526243554700?text="+encodeURIComponent(msg+(referral?"\nReferencia: "+referral:""));
  }
  const iconPin='<svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M20 10c0 5-8 12-8 12S4 15 4 10a8 8 0 1 1 16 0Z"/><circle cx="12" cy="10" r="2.7"/></svg>';
  const iconClock='<svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3.5 2"/></svg>';
  const iconMessage='<svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linejoin="round"><path d="M20.5 11.8a8.5 8.5 0 0 1-12.6 7.4L3 21l1.8-4.7A8.5 8.5 0 1 1 20.5 11.8Z"/><path d="M8 10h8M8 14h6"/></svg>';
  const section=document.createElement("section");
  section.id="udsVisit";
  section.className="uds-visit uds-section";
  section.setAttribute("aria-labelledby","udsVisitHeading");
  section.innerHTML=[
    '<div class="uds-shell"><div class="uds-visit-heading">',
    '<div><span id="udsVisitKicker" class="uds-visit-kicker"></span><h2 id="udsVisitHeading"></h2></div>',
    '<p id="udsVisitIntro"></p></div><div class="uds-visit-layout">',
    '<div class="uds-visit-directions"><div class="uds-visit-icon">'+iconPin+'</div>',
    '<p class="uds-visit-miniheading" id="udsVisitAddressLabel"></p>',
    '<address id="udsVisitAddress"></address>',
    '<div class="uds-visit-waypoint"><strong id="udsVisitDirectionsLabel"></strong><p id="udsVisitDirections"></p></div>',
    '<a id="udsVisitMaps" class="uds-visit-btn uds-visit-btn-primary" rel="noopener noreferrer" target="_blank" href="'+mapsUrl+'"></a>',
    '</div><div class="uds-visit-contact">',
    '<div class="uds-visit-contact-block"><div class="uds-visit-icon">'+iconClock+'</div>',
    '<h3 id="udsVisitHoursLabel"></h3><strong id="udsVisitHours"></strong><p id="udsVisitHoursNote"></p></div>',
    '<div class="uds-visit-contact-block"><div class="uds-visit-icon">'+iconMessage+'</div>',
    '<h3 id="udsVisitContactLabel"></h3>',
    '<a id="udsVisitPhone" href="#" rel="noopener noreferrer" target="_blank">'+number+'</a>',
    '<a id="udsVisitWhatsApp" class="uds-visit-btn uds-visit-btn-secondary" href="#" rel="noopener noreferrer" target="_blank"></a>',
    '</div></div></div></div>'
  ].join("");
  function apply(){
    if(!root.isConnected)return;
    const main=root.querySelector("#udsHome");
    const footer=root.querySelector(".uds-footer");
    if(!main||!footer)return;
    if(!section.isConnected){
      main.appendChild(section);
      // The location section is injected after hydration: handle direct #udsVisit links.
      if(window.location.hash==="#udsVisit"){
        requestAnimationFrame(()=>requestAnimationFrame(()=>{
          section.scrollIntoView({behavior:"auto",block:"start"});
        }));
      }
    }
    const t=copies[locale()];
    const values={
      udsVisitKicker:t.kicker,udsVisitHeading:t.title,udsVisitIntro:t.intro,
      udsVisitAddressLabel:t.addressTitle,udsVisitAddress:address,
      udsVisitDirectionsLabel:t.directionsTitle,udsVisitDirections:t.directions,
      udsVisitHoursLabel:t.hoursTitle,udsVisitHours:t.hours,
      udsVisitHoursNote:t.hoursNote,udsVisitContactLabel:t.contactTitle,
      udsVisitMaps:t.map,udsVisitWhatsApp:t.chat,
    };
    for(const [id,value] of Object.entries(values)){
      const node=section.querySelector("#"+id);
      if(node&&node.textContent!==value)node.textContent=value;
    }
    section.querySelector("#udsVisitMaps")?.setAttribute("aria-label",t.accessible);
    const wa=whatsappUrl();
    section.querySelector("#udsVisitWhatsApp")?.setAttribute("href",wa);
    section.querySelector("#udsVisitPhone")?.setAttribute("href",wa);
    const footerLinks=footer.querySelector(".uds-footer-grid > div:last-child .uds-footer-links");
    if(footerLinks){
      let directions=footerLinks.querySelector("#udsFooterDirections");
      if(!directions){
        directions=document.createElement("a");
        directions.id="udsFooterDirections";
        directions.href=mapsUrl;directions.target="_blank";directions.rel="noopener noreferrer";
        footerLinks.appendChild(directions);
      }
      directions.textContent=t.footerDirections;
      let hours=footerLinks.querySelector("#udsFooterHours");
      if(!hours){hours=document.createElement("span");hours.id="udsFooterHours";footerLinks.appendChild(hours);}
      hours.textContent=t.footerHours;
    }
  }
  const onLanguageChange=()=>apply();
  window.addEventListener("updown:language-change",onLanguageChange);
  window.addEventListener("updown:copy-ready",onLanguageChange);
  const dispose=()=>{
    window.removeEventListener("updown:language-change",onLanguageChange);
    window.removeEventListener("updown:copy-ready",onLanguageChange);
    window.removeEventListener("updown:preview-location-dispose",dispose);
    if(window.__UPDOWN_PREVIEW_LOCATION_DISPOSE__===dispose)window.__UPDOWN_PREVIEW_LOCATION_DISPOSE__=null;
    section.remove();
    root.querySelector("#udsFooterDirections")?.remove();
    root.querySelector("#udsFooterHours")?.remove();
  };
  window.__UPDOWN_PREVIEW_LOCATION_DISPOSE__=dispose;
  window.addEventListener("updown:preview-location-dispose",dispose,{once:true});
  apply();
})();