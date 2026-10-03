(function(){
  "use strict";

  const ROOT_ID="updown-store";
  const COURSE_BATCH=4;
  let visibleCourses=COURSE_BATCH;
  let courseObserver=null;

  function root(){return document.getElementById(ROOT_ID)}
  function isEnglish(){return document.documentElement.lang==="en"}

  function installStyles(){
    if(document.getElementById("updown-h60-styles"))return;
    const style=document.createElement("style");
    style.id="updown-h60-styles";
    style.textContent=`
      /* H60 · header quirúrgico + paginación de campos */
      #updown-store .uds-announcement{display:none!important}
      #updown-store .uds-header{
        width:100%!important;
        max-width:none!important;
        margin:0!important;
        background:#0b493d!important;
        border:0!important;
        border-radius:0!important;
        box-shadow:none!important;
      }
      #updown-store .uds-header .uds-topbar{
        width:100%!important;
        max-width:1280px!important;
        margin:0 auto!important;
        box-sizing:border-box!important;
        background:transparent!important;
      }
      #updown-store .uds-header .uds-logo,
      #updown-store .uds-header .uds-logo-copy,
      #updown-store .uds-header .uds-logo-copy strong,
      #updown-store .uds-header .uds-logo-copy span,
      #updown-store .uds-header .uds-original-vector-logo,
      #updown-store .uds-header .uds-nav-link{
        color:#fff!important;
      }
      #updown-store .uds-header .uds-logo{
        flex:0 0 auto!important;
        min-width:0!important;
      }
      #updown-store .uds-header .uds-original-vector-logo svg{
        display:block!important;
        width:100%!important;
        height:100%!important;
      }
      #updown-store .uds-header .uds-original-vector-logo svg path{fill:currentColor!important}

      #updown-store .uds-course-more-wrap{
        display:flex;
        justify-content:center;
        padding-top:24px;
      }
      #updown-store .uds-course-more{
        appearance:none;
        border:1px solid rgba(11,73,61,.22);
        background:#fff;
        color:#0b493d;
        min-height:44px;
        padding:0 24px;
        border-radius:999px;
        font:700 12px/1 system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;
        letter-spacing:.08em;
        text-transform:uppercase;
        cursor:pointer;
      }
      #updown-store .uds-course-more:hover{background:#0b493d;color:#fff}

      /* Desktop: composición propia, sin depender del móvil. */
      @media (min-width:761px){
        #updown-store .uds-header .uds-topbar{
          min-height:92px!important;
          padding:12px 28px!important;
          display:grid!important;
          grid-template-columns:minmax(230px,300px) minmax(0,1fr) auto!important;
          align-items:center!important;
          gap:22px!important;
        }
        #updown-store .uds-header .uds-menu-btn{display:none!important}
        #updown-store .uds-header .uds-logo{
          display:grid!important;
          grid-template-columns:92px minmax(0,1fr)!important;
          align-items:center!important;
          gap:12px!important;
          width:100%!important;
        }
        #updown-store .uds-header .uds-original-vector-logo{
          display:block!important;
          width:92px!important;
          height:44px!important;
        }
        #updown-store .uds-header .uds-logo-copy{
          display:flex!important;
          flex-direction:column!important;
          justify-content:center!important;
          min-width:0!important;
          white-space:nowrap!important;
        }
        #updown-store .uds-header .uds-logo-copy strong{
          font-size:17px!important;
          line-height:1!important;
          letter-spacing:.18em!important;
        }
        #updown-store .uds-header .uds-logo-copy span{
          margin-top:5px!important;
          font-size:7px!important;
          line-height:1!important;
          letter-spacing:.18em!important;
        }
        #updown-store .uds-header .uds-desktop-nav{
          display:flex!important;
          align-items:center!important;
          justify-content:center!important;
          gap:18px!important;
          min-width:0!important;
          white-space:nowrap!important;
        }
        #updown-store .uds-header .uds-nav-link{font-size:11px!important}
        #updown-store .uds-header .uds-top-actions{display:flex!important;align-items:center!important;gap:8px!important}
      }

      /* Móvil: reglas independientes; no hereda geometría de desktop. */
      @media (max-width:760px){
        #updown-store .uds-header{
          position:relative!important;
          min-height:64px!important;
        }
        #updown-store .uds-header .uds-topbar{
          min-height:64px!important;
          padding:8px 12px!important;
          display:grid!important;
          grid-template-columns:auto minmax(0,1fr) auto!important;
          align-items:center!important;
          gap:10px!important;
        }
        #updown-store .uds-header .uds-menu-btn{display:inline-flex!important;grid-column:3!important;grid-row:1!important}
        #updown-store .uds-header .uds-logo{
          grid-column:1 / 3!important;
          grid-row:1!important;
          display:grid!important;
          grid-template-columns:56px minmax(0,1fr)!important;
          align-items:center!important;
          gap:8px!important;
          width:min(230px,100%)!important;
          overflow:hidden!important;
        }
        #updown-store .uds-header .uds-original-vector-logo{
          display:block!important;
          width:56px!important;
          height:30px!important;
        }
        #updown-store .uds-header .uds-logo-copy{
          display:flex!important;
          flex-direction:column!important;
          min-width:0!important;
          white-space:nowrap!important;
        }
        #updown-store .uds-header .uds-logo-copy strong{font-size:13px!important;line-height:1!important;letter-spacing:.12em!important}
        #updown-store .uds-header .uds-logo-copy span{margin-top:3px!important;font-size:5.5px!important;line-height:1!important;letter-spacing:.12em!important}
        #updown-store .uds-header .uds-desktop-nav,
        #updown-store .uds-header .uds-top-actions{display:none!important}
        #updown-store .uds-course-more-wrap{padding-top:18px}
        #updown-store .uds-course-more{width:100%;max-width:280px}
      }
    `;
    document.head.appendChild(style);
  }

  function updateNavigationCopy(){
    const r=root();
    if(!r)return;
    const courses=r.querySelector('[data-nav-key="courses"]');
    const journal=r.querySelector('[data-nav-key="journal"]');
    if(courses)courses.textContent=isEnglish()?"Golf in Cabo":"Golf en Cabo";
    if(journal)journal.textContent=isEnglish()?"News":"Noticias";

    const nav=r.querySelector(".uds-desktop-nav");
    if(nav&&!nav.querySelector('[data-nav-key="about"]')){
      const link=document.createElement("a");
      link.className="uds-nav-link";
      link.dataset.navKey="about";
      link.href="#udsAbout";
      link.textContent=isEnglish()?"About us":"Quiénes somos";
      nav.appendChild(link);
    }
  }

  function ensureCourseMoreButton(){
    const section=document.getElementById("udsCourses");
    const grid=section?.querySelector(".uds-course-grid");
    if(!section||!grid)return null;
    let wrap=section.querySelector(".uds-course-more-wrap");
    let button=section.querySelector("#udsCourseMore");
    if(!wrap){
      wrap=document.createElement("div");
      wrap.className="uds-course-more-wrap";
      grid.insertAdjacentElement("afterend",wrap);
    }
    if(!button){
      button=document.createElement("button");
      button.id="udsCourseMore";
      button.type="button";
      button.className="uds-course-more";
      wrap.appendChild(button);
    }
    return button;
  }

  function renderCoursePage(reset){
    const grid=document.querySelector("#udsCourses .uds-course-grid");
    if(!grid)return;
    const cards=[...grid.querySelectorAll(":scope > .uds-course")];
    if(reset)visibleCourses=COURSE_BATCH;
    visibleCourses=Math.max(COURSE_BATCH,Math.min(visibleCourses,cards.length||COURSE_BATCH));
    cards.forEach((card,index)=>{card.hidden=index>=visibleCourses});

    const button=ensureCourseMoreButton();
    if(!button)return;
    const hasMore=cards.length>visibleCourses;
    button.hidden=!hasMore;
    button.classList.toggle("uds-hidden",!hasMore);
    button.textContent=isEnglish()?"View more courses":"Ver más campos";
    button.setAttribute("aria-expanded",String(!hasMore));
    button.onclick=()=>{
      visibleCourses=Math.min(visibleCourses+COURSE_BATCH,cards.length);
      renderCoursePage(false);
    };
  }

  function watchCourses(){
    const grid=document.querySelector("#udsCourses .uds-course-grid");
    if(!grid)return;
    courseObserver?.disconnect();
    courseObserver=new MutationObserver(()=>renderCoursePage(true));
    courseObserver.observe(grid,{childList:true});
    renderCoursePage(true);
  }

  function watchLanguage(){
    const observer=new MutationObserver(()=>{
      updateNavigationCopy();
      renderCoursePage(false);
    });
    observer.observe(document.documentElement,{attributes:true,attributeFilter:["lang"]});
  }

  function boot(){
    installStyles();
    updateNavigationCopy();
    watchCourses();
    watchLanguage();
  }

  if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",boot,{once:true});
  else boot();
})();
