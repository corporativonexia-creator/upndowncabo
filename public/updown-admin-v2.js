(() => {
  "use strict";

  // HOTFIX 22: Admin V2 must only mount once.
  // /admin loads this runtime from AdminParity after the cookie-aware
  // Supabase browser client is ready. A second copy must never compete
  // for the same DOM or overwrite loaded content.
  if(window.__UPDOWN_ADMIN_V2_BOOTED__) return;
  window.__UPDOWN_ADMIN_V2_BOOTED__=true;

  const CONFIG = {
    supabaseUrl: window.__UPDOWN_SUPABASE_URL__,
    supabaseKey: window.__UPDOWN_SUPABASE_PUBLISHABLE_KEY__,
    authStorageKey: "updown-admin-auth",
    bucket: "site-content",
  };

  const state = {
    db: null,
    mounted: false,
    activeView: "products",
    contentType: "courses",
    courses: [],
    instructors: [],
    articles: [],
    sellers: [],
    commissions: [],
    commissionFilter: "all",
    commissionSearch: "",
    lessonLeads: [],
    lessonEvents: [],
    lessonInstructors: [],
    lessonFilter: "all",
    lessonInstructorFilter: "all",
    lessonSearch: "",
    lessonExpanded: null,
    posEmployees: [],
    posTerminals: [],
    posAuditEvents: [],
    posAuditSearch: "",
    posAuditType: "operation",
    posAuditEmployee: "all",
    posAuditTerminal: "all",
    posSummarySales: [],
    posSummaryMetrics: {},
    posSummaryEmployee: "all",
    posSummaryTerminal: "all",
    posSummaryStatus: "all",
    posSummaryPayment: "all",
    posShiftRows: [],
    posShiftEmployee: "all",
    posShiftTerminal: "all",
    posShiftStatus: "all",
    posAdminSection: "dashboard",
    posInventoryRows: [],
    posInventoryStock: [],
    posInventoryMovement: "all",
    posInventoryProduct: "all",
    posSaleDetail: null,
    posEmployeeReportRows: [],
    posEmployeeReportEmployee: "all",
    posEmployeeReportTerminal: "all",
    posDailyCloseReport: null,
    posDailyCloseTerminal: "all",
    posDashboardDate: "",
    posDashboardReport: null,
    posShifts: [],
    posEmployeeSearch: "",
    posEmployeeFilter: "all",
    posForceCloseEmployeeId: null,
    posForceCloseTargetAction: null,
    editing: { courses: null, instructors: null, articles: null },
  };

  const $ = (id) => document.getElementById(id);
  const q = (sel, root=document) => root.querySelector(sel);
  const qa = (sel, root=document) => [...root.querySelectorAll(sel)];

  const escapeHtml = (value="") => String(value)
    .replaceAll("&","&amp;").replaceAll("<","&lt;").replaceAll(">","&gt;")
    .replaceAll('"',"&quot;").replaceAll("'","&#039;");

  const slugify = (value="") => String(value)
    .normalize("NFD").replace(/[\u0300-\u036f]/g,"")
    .toLowerCase().trim()
    .replace(/[^a-z0-9]+/g,"-")
    .replace(/^-+|-+$/g,"")
    .slice(0,80);

  const money = (value, currency="MXN") => new Intl.NumberFormat("es-MX", {
    style:"currency", currency:String(currency||"MXN").toUpperCase()
  }).format(Number(value||0));

  const dateTime = (value) => {
    if(!value) return "—";
    try { return new Intl.DateTimeFormat("es-MX",{dateStyle:"medium",timeStyle:"short"}).format(new Date(value)); }
    catch { return String(value); }
  };

  const normalizeCode = (value="") => String(value).trim().toUpperCase()
    .replace(/\s+/g,"").replace(/[^A-Z0-9_-]/g,"").slice(0,30);

  function toast(message, error=false){
    let node = $("udv2Toast");
    if(!node){
      node=document.createElement("div");
      node.id="udv2Toast";
      node.className="udv2-toast";
      document.body.appendChild(node);
    }
    node.textContent=message;
    node.classList.toggle("is-error",error);
    node.classList.add("is-show");
    clearTimeout(toast.timer);
    toast.timer=setTimeout(()=>node.classList.remove("is-show"),2800);
  }

  async function ensureSupabase(){
    if(window.supabase?.createClient){
      return window.supabase;
    }
    await new Promise((resolve,reject)=>{
      const existing=q('script[src*="@supabase/supabase-js"]');
      if(existing){
        if(window.supabase?.createClient) return resolve();
        existing.addEventListener("load",resolve,{once:true});
        existing.addEventListener("error",reject,{once:true});
        setTimeout(()=>window.supabase?.createClient?resolve():reject(new Error("Supabase no cargó.")),5000);
        return;
      }
      const s=document.createElement("script");
      s.src="https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2";
      s.onload=resolve;s.onerror=reject;
      document.head.appendChild(s);
    });
    return window.supabase;
  }

  async function getDb(){
    if(state.db) return state.db;
    const lib=await ensureSupabase();
    state.db=lib.createClient(CONFIG.supabaseUrl,CONFIG.supabaseKey,{
      auth:{
        storageKey:CONFIG.authStorageKey,
        persistSession:true,
        autoRefreshToken:true,
        detectSessionInUrl:true
      }
    });
    return state.db;
  }

  async function verifyAdmin(){
    const db=await getDb();
    const {data:{user}}=await db.auth.getUser();
    if(!user) throw new Error("Inicia sesión como administrador.");
    const {data,error}=await db.from("profiles").select("role,is_active").eq("id",user.id).single();
    if(error) throw error;
    if(data?.role!=="admin"||!data?.is_active) throw new Error("Este usuario no tiene permisos de administrador.");
    return user;
  }

  function injectStyles(){
    if($("udv2Styles")) return;
    const style=document.createElement("style");
    style.id="udv2Styles";
    style.textContent=`
#updown-admin{
  --udv2-green:#143E35;--udv2-green2:#2F6F5B;--udv2-gold:#C8A86B;--udv2-ivory:#F8F6F2;
  --udv2-muted:#68736F;--udv2-line:rgba(20,62,53,.14);--udv2-danger:#9D2C24;
}
#updown-admin .udv2-view{padding:22px 0 20px}
#updown-admin .udv2-view.udv2-hidden{display:none!important}
#updown-admin .udv2-head{display:flex;justify-content:space-between;align-items:flex-end;gap:16px;margin:8px 0 22px}
#updown-admin .udv2-head h1{font-family:"Cormorant Garamond",serif;color:var(--udv2-green);font-size:52px;line-height:.95;margin:6px 0 0}
#updown-admin .udv2-eyebrow{color:var(--udv2-gold);font-size:10px;font-weight:800;letter-spacing:.18em;text-transform:uppercase}
#updown-admin .udv2-muted{color:var(--udv2-muted);font-size:12px;line-height:1.55}
#updown-admin .udv2-subnav{display:flex;gap:8px;overflow:auto;padding:0 0 16px;scrollbar-width:none}
#updown-admin .udv2-subnav::-webkit-scrollbar{display:none}
#updown-admin .udv2-pill{flex:0 0 auto;border:1px solid var(--udv2-line);background:#fff;color:var(--udv2-green);padding:10px 14px;border-radius:999px;font-weight:800;font-size:11px;cursor:pointer}
#updown-admin .udv2-pill.is-active{background:var(--udv2-green);color:#fff;border-color:var(--udv2-green)}
#updown-admin .udv2-grid{display:grid;grid-template-columns:minmax(330px,.82fr) minmax(500px,1.18fr);gap:20px;align-items:start}
#updown-admin .udv2-panel{background:#fff;border:1px solid var(--udv2-line);border-radius:22px;box-shadow:0 12px 36px rgba(13,46,39,.06);overflow:hidden}
#updown-admin .udv2-panel-head{display:flex;justify-content:space-between;align-items:center;gap:12px;padding:18px 20px;border-bottom:1px solid var(--udv2-line)}
#updown-admin .udv2-panel-head h2{font-family:"Cormorant Garamond",serif;color:var(--udv2-green);font-size:29px;margin:0}
#updown-admin .udv2-form{display:grid;gap:12px;padding:18px}
#updown-admin .udv2-row{display:grid;grid-template-columns:1fr 1fr;gap:10px}
#updown-admin .udv2-field{display:flex;flex-direction:column;gap:6px}
#updown-admin .udv2-field label{font-size:10px;font-weight:800;color:var(--udv2-green);letter-spacing:.02em}
#updown-admin .udv2-field input,#updown-admin .udv2-field select,#updown-admin .udv2-field textarea{
  width:100%;padding:11px 12px;border:1px solid var(--udv2-line);border-radius:11px;background:#fff;color:#1e1e1e;outline:none
}
#updown-admin .udv2-field textarea{min-height:82px;resize:vertical}
#updown-admin .udv2-field input:focus,#updown-admin .udv2-field select:focus,#updown-admin .udv2-field textarea:focus{border-color:var(--udv2-green2);box-shadow:0 0 0 3px rgba(47,111,91,.09)}
#updown-admin .udv2-check{display:flex;align-items:center;gap:8px;color:var(--udv2-green);font-size:11px;font-weight:700}
#updown-admin .udv2-check input{width:auto}
#updown-admin .udv2-actions{display:flex;gap:8px;flex-wrap:wrap}
#updown-admin .udv2-btn{display:inline-flex;align-items:center;justify-content:center;border:0;border-radius:12px;padding:10px 13px;cursor:pointer;font-weight:800;font-size:10px;text-decoration:none}
#updown-admin .udv2-btn.primary{background:var(--udv2-green);color:#fff}
#updown-admin .udv2-btn.secondary{background:#fff;color:var(--udv2-green);border:1px solid var(--udv2-line)}
#updown-admin .udv2-btn.danger{background:#fff1ef;color:var(--udv2-danger)}
#updown-admin .udv2-btn:disabled{opacity:.55;cursor:not-allowed}
#updown-admin .udv2-list{display:grid;gap:10px;padding:12px}
#updown-admin .udv2-card{display:grid;grid-template-columns:76px minmax(0,1fr) auto;gap:12px;align-items:center;padding:11px;border:1px solid var(--udv2-line);border-radius:15px;background:#fff}
#updown-admin .udv2-card.no-image{grid-template-columns:minmax(0,1fr) auto}
#updown-admin .udv2-card img{width:76px;height:66px;object-fit:cover;border-radius:10px;background:#eee}
#updown-admin .udv2-card h3{margin:0;color:var(--udv2-green);font-size:14px}
#updown-admin .udv2-meta{margin-top:5px;color:var(--udv2-muted);font-size:10px;line-height:1.45}
#updown-admin .udv2-card-actions{display:flex;flex-direction:column;gap:5px}
#updown-admin .udv2-badge{display:inline-flex;padding:5px 8px;border-radius:999px;background:#eef6f2;color:var(--udv2-green);font-size:9px;font-weight:800}
#updown-admin .udv2-badge.off{background:#fff1ef;color:var(--udv2-danger)}
#updown-admin .udv2-empty{padding:26px;text-align:center;color:var(--udv2-muted);font-size:12px}
#updown-admin .udv2-preview{display:none;width:100%;aspect-ratio:16/9;object-fit:cover;border-radius:12px;border:1px solid var(--udv2-line)}
#updown-admin .udv2-preview.is-show{display:block}
#updown-admin .udv2-metrics{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:12px;margin-bottom:18px}
#updown-admin .udv2-metric{padding:16px;border:1px solid var(--udv2-line);border-radius:16px;background:#fff;box-shadow:0 9px 24px rgba(13,46,39,.05)}
#updown-admin .udv2-metric span{display:block;color:var(--udv2-muted);font-size:9px;font-weight:800;text-transform:uppercase;letter-spacing:.07em}
#updown-admin .udv2-metric strong{display:block;margin-top:7px;color:var(--udv2-green);font-family:"Cormorant Garamond",serif;font-size:27px;line-height:1}
#updown-admin .udv2-seller-card,#updown-admin .udv2-commission-card{padding:14px;border:1px solid var(--udv2-line);border-radius:15px;background:#fff}
#updown-admin .udv2-seller-head,#updown-admin .udv2-commission-head{display:flex;justify-content:space-between;gap:12px;align-items:flex-start}
#updown-admin .udv2-seller-head h3,#updown-admin .udv2-commission-head h3{margin:0;color:var(--udv2-green);font-size:14px}
#updown-admin .udv2-code{display:inline-flex;margin-top:5px;padding:4px 7px;border-radius:999px;background:#eef6f2;color:var(--udv2-green);font-size:9px;font-weight:900}
#updown-admin .udv2-seller-edit{display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-top:10px}
#updown-admin .udv2-seller-edit input,#updown-admin .udv2-seller-edit select,#updown-admin .udv2-toolbar input,#updown-admin .udv2-toolbar select{width:100%;padding:9px 10px;border:1px solid var(--udv2-line);border-radius:10px;background:#fff}
#updown-admin .udv2-link{margin-top:9px;padding:8px 9px;border-radius:9px;background:var(--udv2-ivory);color:var(--udv2-green);font-size:9px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
#updown-admin .udv2-toolbar{display:grid;grid-template-columns:1fr 190px;gap:8px;padding:12px;border-bottom:1px solid var(--udv2-line)}
#updown-admin .udv2-commission-meta{display:grid;grid-template-columns:repeat(4,1fr);gap:7px;margin-top:10px}
#updown-admin .udv2-commission-meta div{padding:8px;border-radius:9px;background:var(--udv2-ivory)}
#updown-admin .udv2-commission-meta span{display:block;color:var(--udv2-muted);font-size:8px}
#updown-admin .udv2-commission-meta strong{display:block;margin-top:3px;color:var(--udv2-green);font-size:10px}

/* Clases */
#updown-admin .udv2-lesson-list{display:grid;gap:10px;padding:12px}
#updown-admin .udv2-lesson-card{border:1px solid var(--udv2-line);border-radius:16px;background:#fff;overflow:hidden}
#updown-admin .udv2-lesson-summary{display:grid;grid-template-columns:minmax(0,1fr) auto;gap:14px;align-items:center;padding:14px}
#updown-admin .udv2-lesson-name{display:flex;align-items:center;gap:8px;flex-wrap:wrap}
#updown-admin .udv2-lesson-name h3{margin:0;color:var(--udv2-green);font-size:15px}
#updown-admin .udv2-lesson-sub{margin-top:5px;color:var(--udv2-muted);font-size:10px;line-height:1.5}
#updown-admin .udv2-lesson-detail{display:none;padding:0 14px 14px}
#updown-admin .udv2-lesson-card.is-open .udv2-lesson-detail{display:block}
#updown-admin .udv2-lesson-grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:8px;margin-top:4px}
#updown-admin .udv2-lesson-cell{padding:10px;border-radius:11px;background:var(--udv2-ivory)}
#updown-admin .udv2-lesson-cell span{display:block;color:var(--udv2-muted);font-size:8px;text-transform:uppercase;font-weight:800;letter-spacing:.05em}
#updown-admin .udv2-lesson-cell strong{display:block;margin-top:4px;color:var(--udv2-green);font-size:11px;line-height:1.45}
#updown-admin .udv2-lesson-comment{margin-top:10px;padding:12px;border-left:3px solid var(--udv2-gold);border-radius:0 10px 10px 0;background:#f6f1e7;color:var(--udv2-green);font-size:11px;line-height:1.6}
#updown-admin .udv2-lesson-actions{display:flex;gap:8px;flex-wrap:wrap;margin-top:12px}
#updown-admin .udv2-lesson-actions select{min-height:38px;padding:8px 10px;border:1px solid var(--udv2-line);border-radius:10px;background:#fff}
#updown-admin .udv2-event-list{display:grid;gap:6px;margin-top:12px}
#updown-admin .udv2-event{display:flex;justify-content:space-between;gap:12px;padding:8px 10px;border-radius:9px;background:#fff;border:1px solid var(--udv2-line);font-size:9px;color:var(--udv2-muted)}
#updown-admin .udv2-event strong{color:var(--udv2-green)}
#updown-admin .udv2-lesson-toolbar{display:grid;grid-template-columns:1fr 170px 190px;gap:8px;padding:12px;border-bottom:1px solid var(--udv2-line)}
#updown-admin .udv2-lesson-toolbar input,#updown-admin .udv2-lesson-toolbar select{width:100%;padding:9px 10px;border:1px solid var(--udv2-line);border-radius:10px;background:#fff}
@media(max-width:820px){
  #updown-admin .udv2-lesson-grid{grid-template-columns:1fr 1fr}
  #updown-admin .udv2-lesson-toolbar{grid-template-columns:1fr 1fr}
  #updown-admin .udv2-lesson-toolbar input{grid-column:1/-1}
}
@media(max-width:620px){
  #updown-admin .udv2-lesson-grid{grid-template-columns:1fr}
  #updown-admin .udv2-lesson-summary{grid-template-columns:1fr}
  #updown-admin .udv2-lesson-toolbar{grid-template-columns:1fr}
  #updown-admin .udv2-lesson-toolbar input{grid-column:auto}
}

/* POS / Caja */
#updown-admin .udv2-pos-launch{display:flex;gap:10px;flex-wrap:wrap;align-items:center}
#updown-admin .udv2-pos-employee-list,#updown-admin .udv2-pos-terminal-list{display:grid;gap:9px;padding:12px}
#updown-admin .udv2-pos-card{padding:13px;border:1px solid var(--udv2-line);border-radius:14px;background:#fff}
#updown-admin .udv2-pos-card-head{display:flex;align-items:flex-start;justify-content:space-between;gap:12px}
#updown-admin .udv2-pos-card h3{margin:0;color:var(--udv2-green);font-size:14px}
#updown-admin .udv2-pos-card small{display:block;margin-top:4px;color:var(--udv2-muted);font-size:9px;line-height:1.5}
#updown-admin .udv2-pos-actions{display:flex;gap:6px;flex-wrap:wrap;margin-top:10px}
#updown-admin .udv2-pos-actions button{min-height:34px;padding:7px 10px;border-radius:9px;border:1px solid var(--udv2-line);background:#fff;color:var(--udv2-green);font-size:9px;font-weight:800;cursor:pointer}
#updown-admin .udv2-pos-actions button.danger{color:var(--udv2-danger);background:#fff5f3}
#updown-admin .udv2-pos-code{margin-top:10px;padding:12px;border-radius:12px;background:#143E35;color:#fff}
#updown-admin .udv2-pos-code span{display:block;font-size:8px;letter-spacing:.12em;text-transform:uppercase;opacity:.7}
#updown-admin .udv2-pos-code strong{display:block;margin-top:5px;font-size:24px;letter-spacing:.08em}
#updown-admin .udv2-pos-note{padding:12px;border-left:3px solid var(--udv2-gold);border-radius:0 10px 10px 0;background:#f7f2e8;color:var(--udv2-green);font-size:10px;line-height:1.6}
#updown-admin .udv2-pos-status{display:inline-flex;padding:5px 8px;border-radius:999px;font-size:8px;font-weight:900;text-transform:uppercase;letter-spacing:.06em;background:#e8f3ee;color:#1c5f4b}
#updown-admin .udv2-force-close-modal[hidden]{display:none}
#updown-admin .udv2-force-close-modal{position:fixed;inset:0;z-index:99999;display:grid;place-items:center;padding:18px}
#updown-admin .udv2-force-close-backdrop{position:absolute;inset:0;background:rgba(6,24,20,.66);backdrop-filter:blur(4px)}
#updown-admin .udv2-force-close-dialog{position:relative;width:min(560px,100%);max-height:calc(100vh - 36px);overflow:auto;background:#fff;border-radius:18px;padding:18px;box-shadow:0 20px 70px rgba(0,0,0,.22)}
#updown-admin .udv2-force-close-head{display:flex;align-items:flex-start;justify-content:space-between;gap:14px}
#updown-admin .udv2-force-close-head small{display:block;font-size:8px;font-weight:900;letter-spacing:.08em;color:#9D2C24}
#updown-admin .udv2-force-close-head h2{margin:4px 0 0;color:var(--udv2-green);font-size:18px}
#updown-admin .udv2-force-close-x{border:0;background:transparent;font-size:24px;line-height:1;cursor:pointer;color:var(--udv2-muted)}
#updown-admin .udv2-force-close-employee{margin-top:14px;border:1px solid var(--udv2-line);border-radius:12px;padding:11px;background:#fafbf9}
#updown-admin .udv2-force-close-employee strong{display:block;color:var(--udv2-green)}
#updown-admin .udv2-force-close-employee small{display:block;margin-top:4px;color:var(--udv2-muted)}
#updown-admin .udv2-force-close-warning{margin-top:10px;padding:10px 12px;border-radius:10px;background:#fff4de;color:#715119;font-size:9px;line-height:1.45}
#updown-admin .udv2-force-close-fields{display:grid;gap:10px;margin-top:12px}
#updown-admin .udv2-force-close-fields label{display:grid;gap:5px}
#updown-admin .udv2-force-close-fields label span{font-size:8px;font-weight:900;text-transform:uppercase;color:var(--udv2-muted)}
#updown-admin .udv2-force-close-fields input,
#updown-admin .udv2-force-close-fields textarea{width:100%;box-sizing:border-box;border:1px solid var(--udv2-line);border-radius:10px;background:#fff;padding:10px;font:inherit;color:var(--udv2-green)}
#updown-admin .udv2-force-close-actions{display:flex;justify-content:flex-end;gap:8px;flex-wrap:wrap;margin-top:14px}
#updown-admin .udv2-force-close-actions button{border:1px solid var(--udv2-line);background:#fff;border-radius:10px;padding:9px 12px;font-size:8px;font-weight:900;text-transform:uppercase;cursor:pointer}
#updown-admin .udv2-force-close-actions button.danger{background:#9D2C24;border-color:#9D2C24;color:#fff}
@media(max-width:600px){
  #updown-admin .udv2-force-close-modal{padding:10px}
  #updown-admin .udv2-force-close-dialog{border-radius:15px;padding:14px}
  #updown-admin .udv2-force-close-actions{display:grid;grid-template-columns:1fr}
  #updown-admin .udv2-force-close-actions button{width:100%;min-height:44px}
}
#updown-admin .udv2-pos-status.suspended{background:#fff4de;color:#8B5F16}
#updown-admin .udv2-pos-status.terminated,#updown-admin .udv2-pos-status.revoked{background:#fff0ee;color:#9D2C24}
#updown-admin .udv2-pos-status.pending{background:#eef1f0;color:#68736F}

#updown-admin .udv2-pos-tabs-wrap{margin-top:18px}
#updown-admin .udv2-pos-tabs{background:#fff;border:1px solid var(--udv2-line);border-radius:16px;padding:7px;box-shadow:0 8px 30px rgba(20,62,53,.06)}
#updown-admin .udv2-pos-tab{border:0;background:transparent;border-radius:11px;padding:10px 14px}
#updown-admin .udv2-pos-tab.active{box-shadow:none}
#updown-admin .udv2-pos-section.active{animation:udv2SectionIn .16s ease-out}
@keyframes udv2SectionIn{from{opacity:.55;transform:translateY(3px)}to{opacity:1;transform:none}}
#updown-admin .udv2-pos-section>.udv2-panel,
#updown-admin .udv2-pos-section>.udv2-grid,
#updown-admin .udv2-pos-section>section{margin-top:14px}
#updown-admin .udv2-panel-head{padding:16px 16px 12px}
#updown-admin .udv2-panel-head h2{font-size:15px;letter-spacing:-.01em}
#updown-admin .udv2-report-tools{display:flex;align-items:center;gap:8px;flex-wrap:wrap}
#updown-admin .udv2-print-btn{border:1px solid rgba(20,62,53,.18);background:#fff;color:var(--udv2-green);border-radius:10px;padding:8px 11px;font-size:9px;font-weight:900;text-transform:uppercase;letter-spacing:.04em;cursor:pointer}
#updown-admin .udv2-print-btn:hover{background:#f2f6f3}
#updown-admin .udv2-report-print-meta{display:none}
#updown-admin .udv2-inventory-filters{display:grid;grid-template-columns:150px 150px 220px 180px minmax(180px,1fr);gap:8px;padding:12px;border-top:1px solid var(--udv2-line);border-bottom:1px solid var(--udv2-line)}
#updown-admin .udv2-inventory-filters input,#updown-admin .udv2-inventory-filters select{width:100%;padding:9px 10px;border:1px solid var(--udv2-line);border-radius:10px;background:#fff}
#updown-admin .udv2-inventory-table{padding:12px;overflow:auto}
#updown-admin .udv2-inventory-row{display:grid;grid-template-columns:150px minmax(180px,1fr) 110px 150px 80px 110px minmax(180px,1fr);gap:8px;align-items:center;padding:9px 10px;border-bottom:1px solid var(--udv2-line)}
#updown-admin .udv2-inventory-row.head{font-size:8px;font-weight:900;text-transform:uppercase;color:var(--udv2-muted);background:#fafbf9}
#updown-admin .udv2-inventory-row strong{font-size:10px;color:var(--udv2-green)}
#updown-admin .udv2-inventory-delta.negative{color:#9D2C24}
#updown-admin .udv2-inventory-delta.positive{color:#23634f}
#updown-admin .udv2-sale-detail-btn{border:1px solid rgba(20,62,53,.18);background:#fff;color:var(--udv2-green);border-radius:9px;padding:6px 8px;font-size:8px;font-weight:900;cursor:pointer;margin-top:5px}
#updown-admin .udv2-modal{display:none;position:fixed;inset:0;z-index:9999}
#updown-admin .udv2-modal.open{display:block}
#updown-admin .udv2-modal-backdrop{position:absolute;inset:0;background:rgba(8,24,20,.55);backdrop-filter:blur(3px)}
#updown-admin .udv2-modal-card{position:relative;width:min(900px,calc(100vw - 24px));max-height:calc(100vh - 40px);overflow:auto;margin:20px auto;background:#fff;border-radius:18px;box-shadow:0 30px 80px rgba(0,0,0,.25)}
#updown-admin .udv2-modal-head{display:flex;justify-content:space-between;gap:12px;align-items:flex-start;padding:18px 18px 12px;border-bottom:1px solid var(--udv2-line);position:sticky;top:0;background:#fff;z-index:2}
#updown-admin .udv2-modal-head h2{margin:2px 0 0;font-size:20px;color:var(--udv2-green)}
#updown-admin .udv2-modal-close{border:0;background:#f2f4f2;width:34px;height:34px;border-radius:999px;font-size:22px;cursor:pointer}
#updown-admin .udv2-modal-body{padding:16px}
#updown-admin .udv2-sale-detail-grid{display:grid;grid-template-columns:repeat(4,1fr);gap:8px;margin-bottom:14px}
#updown-admin .udv2-sale-detail-card{border:1px solid var(--udv2-line);border-radius:10px;padding:9px}
#updown-admin .udv2-sale-detail-card span{display:block;font-size:8px;text-transform:uppercase;font-weight:900;color:var(--udv2-muted)}
#updown-admin .udv2-sale-detail-card strong{display:block;margin-top:4px;color:var(--udv2-green)}
#updown-admin .udv2-sale-detail-section{margin-top:14px}
#updown-admin .udv2-sale-detail-section h3{font-size:11px;color:var(--udv2-green);margin:0 0 7px}
#updown-admin .udv2-sale-detail-line{display:grid;grid-template-columns:minmax(180px,1fr) 90px 110px 110px;gap:8px;padding:7px 0;border-bottom:1px solid var(--udv2-line);font-size:9px}
#updown-admin .udv2-sale-detail-actions{display:flex;gap:8px;flex-wrap:wrap;margin-top:14px}
#updown-admin .udv2-dashboard-grid{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:10px;padding:14px}
#updown-admin .udv2-dashboard-card{border:1px solid var(--udv2-line);border-radius:13px;background:#fff;padding:13px;min-height:82px}
#updown-admin .udv2-dashboard-card span{display:block;font-size:8px;font-weight:900;text-transform:uppercase;letter-spacing:.05em;color:var(--udv2-muted)}
#updown-admin .udv2-dashboard-card strong{display:block;margin-top:7px;font-size:19px;color:var(--udv2-green)}
#updown-admin .udv2-dashboard-card small{display:block;margin-top:5px;color:var(--udv2-muted);font-size:8px}
#updown-admin .udv2-dashboard-card.danger strong{color:#9D2C24}
#updown-admin .udv2-dashboard-card.gold strong{color:#896A28}
#updown-admin .udv2-dashboard-date-tools{display:flex;align-items:flex-end;gap:8px;flex-wrap:wrap}
#updown-admin .udv2-dashboard-date-label{display:grid;gap:4px}
#updown-admin .udv2-dashboard-date-label span{font-size:8px;font-weight:900;text-transform:uppercase;letter-spacing:.05em;color:var(--udv2-muted)}
#updown-admin .udv2-dashboard-date-label input{min-width:155px;padding:8px 10px;border:1px solid var(--udv2-line);border-radius:10px;background:#fff;color:var(--udv2-green)}
#updown-admin .udv2-dashboard-today{border:1px solid rgba(20,62,53,.18);background:#fff;color:var(--udv2-green);border-radius:10px;padding:9px 12px;font-size:8px;font-weight:900;text-transform:uppercase;letter-spacing:.04em;cursor:pointer}
#updown-admin .udv2-dashboard-today:hover{background:#f2f6f3}
#updown-admin .udv2-dashboard-actions{display:flex;gap:8px;flex-wrap:wrap;padding:0 14px 14px}
#updown-admin .udv2-dashboard-action{border:1px solid rgba(20,62,53,.18);background:#fff;color:var(--udv2-green);border-radius:10px;padding:9px 11px;font-size:8px;font-weight:900;text-transform:uppercase;letter-spacing:.04em;cursor:pointer}
#updown-admin .udv2-dashboard-action:hover{background:#f2f6f3}
@media(max-width:900px){
  #updown-admin .udv2-dashboard-grid{grid-template-columns:repeat(3,1fr)}
}
@media(max-width:680px){
  #updown-admin .udv2-dashboard-grid{grid-template-columns:1fr 1fr}
}
#updown-admin .udv2-employee-report-filters,
#updown-admin .udv2-daily-close-filters{display:grid;grid-template-columns:150px 150px 220px 220px;gap:8px;padding:12px;border-top:1px solid var(--udv2-line);border-bottom:1px solid var(--udv2-line)}
#updown-admin .udv2-daily-close-filters{grid-template-columns:180px 240px}
#updown-admin .udv2-employee-report-filters input,
#updown-admin .udv2-employee-report-filters select,
#updown-admin .udv2-daily-close-filters input,
#updown-admin .udv2-daily-close-filters select{width:100%;padding:9px 10px;border:1px solid var(--udv2-line);border-radius:10px;background:#fff}
#updown-admin .udv2-employee-report-list{display:grid;gap:10px;padding:12px}
#updown-admin .udv2-employee-report-card{border:1px solid var(--udv2-line);border-radius:14px;background:#fff;padding:12px}
#updown-admin .udv2-employee-report-head{display:flex;justify-content:space-between;gap:10px;align-items:center;margin-bottom:9px}
#updown-admin .udv2-employee-report-head strong{font-size:12px;color:var(--udv2-green)}
#updown-admin .udv2-report-metrics{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:7px}
#updown-admin .udv2-report-metric{border:1px solid var(--udv2-line);border-radius:10px;padding:8px}
#updown-admin .udv2-report-metric span{display:block;font-size:7px;font-weight:900;text-transform:uppercase;color:var(--udv2-muted)}
#updown-admin .udv2-report-metric strong{display:block;margin-top:3px;color:var(--udv2-green);font-size:12px}
#updown-admin .udv2-report-metric.danger strong{color:#9D2C24}
#updown-admin .udv2-daily-close-grid{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:8px;padding:12px}
#updown-admin .udv2-daily-close-shifts{padding:0 12px 12px}
#updown-admin .udv2-daily-close-shift{display:grid;grid-template-columns:1.2fr 1fr 1fr 1fr 1fr 1fr;gap:8px;padding:9px 0;border-bottom:1px solid var(--udv2-line);font-size:9px}
#updown-admin .udv2-daily-close-shift-head{font-size:8px;font-weight:900;text-transform:uppercase;letter-spacing:.04em;color:var(--udv2-muted);background:#fafbf9;padding:8px 6px;border-radius:8px 8px 0 0}
@media(max-width:760px){
  #updown-admin .udv2-employee-report-filters{grid-template-columns:1fr 1fr}
  #updown-admin .udv2-daily-close-filters{grid-template-columns:1fr 1fr}
  #updown-admin .udv2-report-metrics,
  #updown-admin .udv2-daily-close-grid{grid-template-columns:1fr 1fr}
  #updown-admin .udv2-daily-close-shift{grid-template-columns:1fr 1fr}
}

@media(max-width:760px){
  #updown-admin .udv2-inventory-filters{grid-template-columns:1fr 1fr}
  #updown-admin .udv2-sale-detail-grid{grid-template-columns:1fr 1fr}
}

@media(max-width:680px){
  #updown-admin .udv2-pos-tabs{border-radius:13px}
  #updown-admin .udv2-pos-tab{padding:9px 11px;font-size:8px}
  #updown-admin .udv2-report-tools{width:100%;justify-content:flex-start}
}
#updown-admin .udv2-pos-tabs-wrap{margin-top:14px;position:sticky;top:0;z-index:20;background:linear-gradient(#f7f8f5 78%,rgba(247,248,245,0));padding:6px 0 12px}
#updown-admin .udv2-pos-tabs{display:flex;gap:8px;overflow-x:auto;padding:3px 2px 7px;scrollbar-width:thin}
#updown-admin .udv2-pos-tab{flex:0 0 auto;border:1px solid var(--udv2-line);background:#fff;color:var(--udv2-green);border-radius:999px;padding:10px 14px;font-size:9px;font-weight:900;text-transform:uppercase;letter-spacing:.04em;cursor:pointer;white-space:nowrap}
#updown-admin .udv2-pos-tab:hover{border-color:rgba(20,62,53,.28);transform:translateY(-1px)}
#updown-admin .udv2-pos-tab.active{background:var(--udv2-green);color:#fff;border-color:var(--udv2-green);box-shadow:0 8px 20px rgba(20,62,53,.16)}
#updown-admin .udv2-pos-section{display:none!important}
#updown-admin .udv2-pos-section.active{display:block!important}
#updown-admin .udv2-shift-date-group{border:1px solid var(--udv2-line);border-radius:14px;background:#fff;overflow:hidden}
#updown-admin .udv2-shift-date-head{display:flex;align-items:center;justify-content:space-between;gap:10px;padding:11px 13px;background:#f5f7f4;border-bottom:1px solid var(--udv2-line);cursor:pointer}
#updown-admin .udv2-shift-date-head strong{font-size:10px;color:var(--udv2-green);text-transform:uppercase;letter-spacing:.04em}
#updown-admin .udv2-shift-date-head span{font-size:9px;color:var(--udv2-muted);font-weight:800}
#updown-admin .udv2-shift-date-body{display:grid;gap:10px;padding:10px}
#updown-admin .udv2-shift-date-body.is-collapsed{display:none}
#updown-admin .udv2-shifts-wrap{margin-top:16px}
#updown-admin .udv2-shifts-filters{display:grid;grid-template-columns:150px 150px 180px 180px 160px;gap:8px;padding:12px;border-top:1px solid var(--udv2-line);border-bottom:1px solid var(--udv2-line)}
#updown-admin .udv2-shifts-filters input,#updown-admin .udv2-shifts-filters select{width:100%;padding:9px 10px;border:1px solid var(--udv2-line);border-radius:10px;background:#fff}
#updown-admin .udv2-shifts-list{display:grid;gap:10px;padding:12px}
#updown-admin .udv2-shift-card{border:1px solid var(--udv2-line);border-radius:14px;background:#fff;overflow:hidden}
#updown-admin .udv2-shift-head{display:grid;grid-template-columns:1.2fr 1fr 1fr auto;gap:12px;align-items:center;padding:12px 14px;background:#fafbf9;border-bottom:1px solid var(--udv2-line)}
#updown-admin .udv2-shift-head strong{color:var(--udv2-green);font-size:11px}
#updown-admin .udv2-shift-head small{display:block;margin-top:3px;color:var(--udv2-muted);font-size:9px}
#updown-admin .udv2-shift-body{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:8px;padding:12px}
#updown-admin .udv2-shift-metric{padding:10px;border:1px solid var(--udv2-line);border-radius:10px}
#updown-admin .udv2-shift-metric span{display:block;font-size:8px;font-weight:900;text-transform:uppercase;color:var(--udv2-muted)}
#updown-admin .udv2-shift-metric strong{display:block;margin-top:4px;color:var(--udv2-green);font-size:13px}
#updown-admin .udv2-shift-metric.danger strong{color:#9D2C24}
#updown-admin .udv2-shift-note{margin:0 12px 12px;padding:9px 11px;border-left:2px solid var(--udv2-gold);background:#faf7f0;border-radius:0 10px 10px 0;font-size:9px;color:#4b5c56}
@media(max-width:980px){
  #updown-admin .udv2-shifts-filters{grid-template-columns:repeat(3,1fr)}
  #updown-admin .udv2-shift-body{grid-template-columns:repeat(2,1fr)}
}
@media(max-width:680px){
  #updown-admin .udv2-shifts-filters{grid-template-columns:1fr 1fr}
  #updown-admin .udv2-shift-head{grid-template-columns:1fr}
  #updown-admin .udv2-shift-body{grid-template-columns:1fr 1fr}
}
#updown-admin .udv2-pos-summary{margin-top:16px}
#updown-admin .udv2-summary-grid{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:10px;padding:12px}
#updown-admin .udv2-summary-card{padding:14px;border:1px solid var(--udv2-line);border-radius:13px;background:#fff}
#updown-admin .udv2-summary-card span{display:block;font-size:8px;font-weight:900;text-transform:uppercase;letter-spacing:.06em;color:var(--udv2-muted)}
#updown-admin .udv2-summary-card strong{display:block;margin-top:5px;font-size:20px;color:var(--udv2-green)}
#updown-admin .udv2-summary-card.danger strong{color:#9D2C24}
#updown-admin .udv2-summary-card.gold strong{color:#896A28}
#updown-admin .udv2-summary-filters{display:grid;grid-template-columns:150px 150px 180px 180px 160px 160px;gap:8px;padding:12px;border-top:1px solid var(--udv2-line);border-bottom:1px solid var(--udv2-line)}
#updown-admin .udv2-summary-filters input,#updown-admin .udv2-summary-filters select{width:100%;padding:9px 10px;border:1px solid var(--udv2-line);border-radius:10px;background:#fff}
#updown-admin .udv2-sales-table{padding:12px;overflow:auto}
#updown-admin .udv2-sales-row{display:grid;grid-template-columns:110px 160px minmax(180px,1fr) 150px 130px 110px 130px;gap:10px;align-items:center;padding:10px 12px;border-bottom:1px solid var(--udv2-line)}
#updown-admin .udv2-sales-row.head{font-size:8px;font-weight:900;text-transform:uppercase;letter-spacing:.05em;color:var(--udv2-muted);background:#fafbf9;border-radius:10px 10px 0 0}
#updown-admin .udv2-sales-row strong{color:var(--udv2-green);font-size:11px}
#updown-admin .udv2-sales-row small{display:block;color:var(--udv2-muted);font-size:9px;margin-top:3px}
#updown-admin .udv2-sale-status{display:inline-flex;padding:4px 7px;border-radius:999px;font-size:8px;font-weight:900;text-transform:uppercase}
#updown-admin .udv2-sale-status.completed{background:#e9f5ef;color:#23634f}
#updown-admin .udv2-sale-status.voided,#updown-admin .udv2-sale-status.refunded{background:#fff0ee;color:#9D2C24}
@media(max-width:980px){
  #updown-admin .udv2-summary-grid{grid-template-columns:repeat(2,1fr)}
  #updown-admin .udv2-summary-filters{grid-template-columns:repeat(3,1fr)}
}
@media(max-width:680px){
  #updown-admin .udv2-summary-grid{grid-template-columns:1fr 1fr}
  #updown-admin .udv2-summary-filters{grid-template-columns:1fr 1fr}
  #updown-admin .udv2-sales-row{grid-template-columns:1fr 1fr}
  #updown-admin .udv2-sales-row.head{display:none}
}
#updown-admin .udv2-audit-wrap{margin-top:16px}
#updown-admin .udv2-audit-toolbar{display:grid;grid-template-columns:minmax(220px,1fr) 180px 180px 180px 150px 150px;gap:8px;padding:12px;border-bottom:1px solid var(--udv2-line)}
#updown-admin .udv2-audit-toolbar input,#updown-admin .udv2-audit-toolbar select{width:100%;padding:9px 10px;border:1px solid var(--udv2-line);border-radius:10px;background:#fff}
#updown-admin .udv2-audit-list{display:grid;gap:8px;padding:12px}
#updown-admin .udv2-audit-row{display:grid;grid-template-columns:145px 160px minmax(180px,1fr) 150px 120px;gap:10px;align-items:start;padding:11px 12px;border:1px solid var(--udv2-line);border-radius:12px;background:#fff}
#updown-admin .udv2-audit-row strong{color:var(--udv2-green);font-size:11px}
#updown-admin .udv2-audit-row small{display:block;margin-top:3px;color:var(--udv2-muted);font-size:9px;line-height:1.45}
#updown-admin .udv2-audit-type{display:inline-flex;padding:4px 7px;border-radius:999px;background:#edf3f0;color:#275c4d;font-size:8px;font-weight:900;text-transform:uppercase;letter-spacing:.04em}
#updown-admin .udv2-audit-type.danger{background:#fff0ee;color:#9D2C24}
#updown-admin .udv2-audit-type.cash{background:#f7f2e8;color:#7f6226}
#updown-admin .udv2-audit-amount{text-align:right;font-weight:900;color:var(--udv2-green)}
#updown-admin .udv2-audit-reason{margin-top:5px;padding:6px 8px;border-left:2px solid var(--udv2-gold);background:#faf7f0;border-radius:0 8px 8px 0;font-size:9px;color:#4b5c56}
#updown-admin .udv2-audit-details{margin-top:6px;font-size:8px;color:#7c8783;word-break:break-word}
@media(max-width:980px){
  #updown-admin .udv2-audit-toolbar{grid-template-columns:1fr 1fr 1fr}
  #updown-admin .udv2-audit-row{grid-template-columns:130px 150px minmax(160px,1fr) 110px}
  #updown-admin .udv2-audit-amount{grid-column:4}
}
@media(max-width:680px){
  #updown-admin .udv2-audit-toolbar{grid-template-columns:1fr 1fr}
  #updown-admin .udv2-audit-toolbar input[type="search"]{grid-column:1/-1}
  #updown-admin .udv2-audit-row{grid-template-columns:1fr}
  #updown-admin .udv2-audit-amount{text-align:left;grid-column:auto}
}
@media(max-width:760px){
  #updown-admin .udv2-pos-launch{width:100%}
  #updown-admin .udv2-pos-launch .udv2-btn{flex:1 1 auto}
}

#updown-admin .udv2-toast,.udv2-toast{position:fixed;right:16px;bottom:16px;z-index:200000;max-width:340px;padding:13px 16px;border-radius:13px;background:#143E35;color:#fff;opacity:0;transform:translateY(9px);transition:.22s;pointer-events:none;box-shadow:0 18px 45px rgba(13,46,39,.22);font:600 12px Inter,Arial,sans-serif}
#updown-admin .udv2-toast.is-show,.udv2-toast.is-show{opacity:1;transform:translateY(0)}
#updown-admin .udv2-toast.is-error,.udv2-toast.is-error{background:#9D2C24}
#updown-admin .u-admin-nav{scrollbar-width:none}
#updown-admin .u-admin-nav::-webkit-scrollbar{display:none}
@media(max-width:980px){
  #updown-admin .udv2-grid{grid-template-columns:1fr}
  #updown-admin .udv2-metrics{grid-template-columns:1fr 1fr}
}
@media(max-width:620px){
  #updown-admin .udv2-view{padding-top:14px}
  #updown-admin .udv2-head{align-items:flex-start;flex-direction:column}
  #updown-admin .udv2-head h1{font-size:42px}
  #updown-admin .udv2-row,#updown-admin .udv2-seller-edit,#updown-admin .udv2-toolbar{grid-template-columns:1fr}
  #updown-admin .udv2-card{grid-template-columns:62px minmax(0,1fr)}
  #updown-admin .udv2-card img{width:62px;height:58px}
  #updown-admin .udv2-card-actions{grid-column:1/-1;flex-direction:row}
  #updown-admin .udv2-metrics{grid-template-columns:1fr 1fr}
  #updown-admin .udv2-commission-meta{grid-template-columns:1fr 1fr}
}
`;
    document.head.appendChild(style);
  }

  function createShell(){
    const dashboard=$("udDashboard");
    const nav=q("#updown-admin .u-admin-nav");
    if(!dashboard||!nav) return false;
    if($("udv2ContentTab")) return true;

    const contentTab=document.createElement("button");
    contentTab.id="udv2ContentTab";
    contentTab.className="u-tab";
    contentTab.type="button";
    contentTab.textContent="Contenido";

    const sellersTab=document.createElement("button");
    sellersTab.id="udv2SellersTab";
    sellersTab.className="u-tab";
    sellersTab.type="button";
    sellersTab.textContent="Vendedores";

    const lessonsTab=document.createElement("button");
    lessonsTab.id="udv2LessonsTab";
    lessonsTab.className="u-tab";
    lessonsTab.type="button";
    lessonsTab.textContent="Clases";

    const posTab=document.createElement("button");
    posTab.id="udv2PosTab";
    posTab.className="u-tab";
    posTab.type="button";
    posTab.textContent="POS / Caja";

    const firstExternal=q("a.u-tab",nav);
    nav.insertBefore(contentTab,firstExternal||null);
    nav.insertBefore(sellersTab,firstExternal||null);
    nav.insertBefore(lessonsTab,firstExternal||null);
    nav.insertBefore(posTab,firstExternal||null);

    const content=document.createElement("section");
    content.id="udv2ContentView";
    content.className="udv2-view udv2-hidden";
    content.innerHTML=contentViewHtml();

    const sellers=document.createElement("section");
    sellers.id="udv2SellersView";
    sellers.className="udv2-view udv2-hidden";
    sellers.innerHTML=sellersViewHtml();

    const lessons=document.createElement("section");
    lessons.id="udv2LessonsView";
    lessons.className="udv2-view udv2-hidden";
    lessons.innerHTML=lessonsViewHtml();

    const pos=document.createElement("section");
    pos.id="udv2PosView";
    pos.className="udv2-view udv2-hidden";
    pos.innerHTML=posViewHtml();

    dashboard.appendChild(content);
    dashboard.appendChild(sellers);
    dashboard.appendChild(lessons);
    dashboard.appendChild(pos);

    contentTab.addEventListener("click",()=>switchView("content"));
    sellersTab.addEventListener("click",()=>switchView("sellers"));
    lessonsTab.addEventListener("click",()=>switchView("lessons"));
    posTab.addEventListener("click",()=>switchView("pos"));

    const productsTab=$("udProductsTab"),ordersTab=$("udOrdersTab");
    productsTab?.addEventListener("click",()=>hideV2Views());
    ordersTab?.addEventListener("click",()=>hideV2Views());

    return true;
  }

  function hideV2Views(){
    $("udv2ContentView")?.classList.add("udv2-hidden");
    $("udv2SellersView")?.classList.add("udv2-hidden");
    $("udv2LessonsView")?.classList.add("udv2-hidden");
    $("udv2PosView")?.classList.add("udv2-hidden");
    $("udv2ContentTab")?.classList.remove("is-active");
    $("udv2SellersTab")?.classList.remove("is-active");
    $("udv2LessonsTab")?.classList.remove("is-active");
    $("udv2PosTab")?.classList.remove("is-active");
  }

  function switchView(view){
    state.activeView=view;
    const productView=$("udProductsView"),orderView=$("udOrdersView");
    if(productView) productView.classList.add("u-hidden");
    if(orderView) orderView.classList.add("u-hidden");
    qa("#updown-admin .u-admin-nav .u-tab").forEach(tab=>tab.classList.remove("is-active"));

    $("udv2ContentView").classList.toggle("udv2-hidden",view!=="content");
    $("udv2SellersView").classList.toggle("udv2-hidden",view!=="sellers");
    $("udv2LessonsView").classList.toggle("udv2-hidden",view!=="lessons");
    $("udv2PosView").classList.toggle("udv2-hidden",view!=="pos");

    const tabId=view==="content"?"udv2ContentTab":view==="sellers"?"udv2SellersTab":view==="lessons"?"udv2LessonsTab":"udv2PosTab";
    $(tabId)?.classList.add("is-active");

    if(view==="content") loadContent();
    if(view==="sellers") loadSellers();
    if(view==="lessons") loadLessons();
    if(view==="pos") loadPosAdmin();
  }

  function contentViewHtml(){
    return `
<div class="udv2-head">
  <div><div class="udv2-eyebrow">Contenido del sitio</div><h1>Contenido</h1><div class="udv2-muted">Administra campos de golf, profesores y Cabo Journal.</div></div>
  <button id="udv2ContentRefresh" class="udv2-btn secondary" type="button">Actualizar</button>
</div>
<div class="udv2-subnav" aria-label="Tipos de contenido">
  <button class="udv2-pill is-active" data-content-type="courses" type="button">Campos de golf</button>
  <button class="udv2-pill" data-content-type="instructors" type="button">Profesores</button>
  <button class="udv2-pill" data-content-type="articles" type="button">Cabo Journal</button>
</div>
<div id="udv2ContentBody"></div>`;
  }

  function sellersViewHtml(){
    return `
<div class="udv2-head">
  <div><div class="udv2-eyebrow">Red comercial</div><h1>Vendedores</h1><div class="udv2-muted">Alta, enlaces de referencia, comisiones y estado de vendedores.</div></div>
  <button id="udv2SellerRefresh" class="udv2-btn secondary" type="button">Actualizar</button>
</div>
<div class="udv2-metrics">
  <article class="udv2-metric"><span>Vendedores activos</span><strong id="udv2ActiveSellers">0</strong></article>
  <article class="udv2-metric"><span>Ventas atribuidas</span><strong id="udv2AttributedSales">$0</strong></article>
  <article class="udv2-metric"><span>Comisión pendiente</span><strong id="udv2PendingCommission">$0</strong></article>
  <article class="udv2-metric"><span>Comisión pagada</span><strong id="udv2PaidCommission">$0</strong></article>
</div>
<div class="udv2-grid">
  <section class="udv2-panel">
    <div class="udv2-panel-head"><h2>Alta de vendedor</h2></div>
    <form id="udv2SellerForm" class="udv2-form">
      <div class="udv2-row">
        <div class="udv2-field"><label>Nombre *</label><input id="udv2SellerName" required></div>
        <div class="udv2-field"><label>Código *</label><input id="udv2SellerCode" maxlength="30" placeholder="ALDO001" required></div>
      </div>
      <div class="udv2-row">
        <div class="udv2-field"><label>Correo de acceso *</label><input id="udv2SellerEmail" type="email" required></div>
        <div class="udv2-field"><label>Teléfono / WhatsApp</label><input id="udv2SellerPhone" type="tel"></div>
      </div>
      <div class="udv2-row">
        <div class="udv2-field"><label>Comisión (%) *</label><input id="udv2SellerRate" type="number" min="0" max="100" step=".01" value="10" required></div>
        <div class="udv2-field"><label>Contraseña temporal *</label><input id="udv2SellerPassword" type="password" minlength="8" required></div>
      </div>
      <div class="udv2-actions"><button id="udv2CreateSeller" class="udv2-btn primary" type="submit">Crear vendedor</button></div>
    </form>
  </section>
  <section class="udv2-panel">
    <div class="udv2-panel-head"><h2>Vendedores registrados</h2><span id="udv2SellerCount" class="udv2-muted"></span></div>
    <div id="udv2SellerList" class="udv2-list"><div class="udv2-empty">Cargando…</div></div>
  </section>
</div>
<section class="udv2-panel" style="margin-top:20px">
  <div class="udv2-panel-head"><h2>Comisiones</h2><span id="udv2CommissionCount" class="udv2-muted"></span></div>
  <div class="udv2-toolbar">
    <input id="udv2CommissionSearch" type="search" placeholder="Buscar vendedor, código o pedido…">
    <select id="udv2CommissionFilter">
      <option value="all">Todos los estados</option>
      <option value="pending">Pendiente</option>
      <option value="approved">Aprobada</option>
      <option value="paid">Pagada</option>
      <option value="cancelled">Cancelada</option>
    </select>
  </div>
  <div id="udv2CommissionList" class="udv2-list"><div class="udv2-empty">Cargando…</div></div>
</section>`;
  }

  const LESSON_STATUS_LABELS={
    new:"Nueva",
    contacted:"Contactado",
    qualified:"Calificado",
    scheduled:"Agendada",
    completed:"Completada",
    closed:"Cerrada"
  };
  const LESSON_SKILL_LABELS={
    new:"Está empezando",
    beginner:"Principiante",
    intermediate:"Intermedio",
    advanced:"Avanzado",
    competitive:"Competitivo"
  };
  const LESSON_GOAL_LABELS={
    starting:"Empezar desde cero",
    consistency:"Consistencia del swing",
    distance:"Más distancia / driver",
    irons:"Hierros y precisión",
    short_game:"Juego corto",
    putting:"Putting",
    strategy:"Estrategia en campo",
    other:"Otro"
  };

  function lessonsViewHtml(){
    return `
<div class="udv2-head">
  <div>
    <div class="udv2-eyebrow">Solicitudes de entrenamiento</div>
    <h1>Clases</h1>
    <div class="udv2-muted">Da seguimiento a quienes solicitaron clases desde la tienda.</div>
  </div>
  <button id="udv2LessonRefresh" class="udv2-btn secondary" type="button">Actualizar</button>
</div>

<div class="udv2-metrics">
  <article class="udv2-metric"><span>Solicitudes</span><strong id="udv2LessonTotal">0</strong></article>
  <article class="udv2-metric"><span>Nuevas</span><strong id="udv2LessonNew">0</strong></article>
  <article class="udv2-metric"><span>Con instructor</span><strong id="udv2LessonInstructor">0</strong></article>
  <article class="udv2-metric"><span>Agendadas / completadas</span><strong id="udv2LessonConverted">0</strong></article>
</div>

<section class="-employees udv2-panel">
  <div class="udv2-panel-head">
    <h2>Solicitudes</h2>
    <span id="udv2LessonCount" class="udv2-muted"></span>
  </div>
  <div class="udv2-lesson-toolbar">
    <input id="udv2LessonSearch" type="search" placeholder="Buscar nombre, teléfono, objetivo o referencia…">
    <select id="udv2LessonFilter">
      <option value="all">Todos los estados</option>
      <option value="new">Nueva</option>
      <option value="contacted">Contactado</option>
      <option value="qualified">Calificado</option>
      <option value="scheduled">Agendada</option>
      <option value="completed">Completada</option>
      <option value="closed">Cerrada</option>
    </select>
    <select id="udv2LessonInstructorFilter">
      <option value="all">Todos los instructores</option>
      <option value="none">Sin instructor</option>
    </select>
  </div>
  <div id="udv2LessonList" class="udv2-lesson-list">
    <div class="udv2-empty">Cargando solicitudes…</div>
  </div>
</section>`;
  }

  function lessonInstructorName(slug){
    if(!slug)return "Sin seleccionar";
    return state.lessonInstructors.find(x=>x.slug===slug)?.name||slug;
  }

  function lessonWhatsapp(phone,name){
    let digits=String(phone||"").replace(/\D/g,"");
    if(digits.length===10)digits=`52${digits}`;
    const text=`Hola ${name||""} 👋 Soy de UP AND DOWN · Cabo Golf Shop. Recibimos tu solicitud de clases de golf y me gustaría ayudarte a darle seguimiento.`;
    return `https://wa.me/${digits}?text=${encodeURIComponent(text)}`;
  }

  function lessonEventsFor(id){
    return state.lessonEvents
      .filter(x=>x.lead_id===id)
      .sort((a,b)=>new Date(a.created_at)-new Date(b.created_at));
  }

  function renderLessonInstructorFilter(){
    const select=$("udv2LessonInstructorFilter");
    if(!select)return;
    const current=state.lessonInstructorFilter||"all";
    select.innerHTML='<option value="all">Todos los instructores</option><option value="none">Sin instructor</option>'+
      state.lessonInstructors.map(x=>`<option value="${escapeHtml(x.slug)}">${escapeHtml(x.name)}</option>`).join("");
    select.value=[...select.options].some(x=>x.value===current)?current:"all";
  }

  function renderLessons(){
    const root=$("udv2LessonList");
    if(!root)return;

    renderLessonInstructorFilter();

    const search=String(state.lessonSearch||"").trim().toLowerCase();
    const status=state.lessonFilter||"all";
    const instructor=state.lessonInstructorFilter||"all";

    const visible=state.lessonLeads.filter(lead=>{
      const hay=[
        lead.name,lead.phone,lead.phone_digits,
        LESSON_SKILL_LABELS[lead.skill_level],LESSON_GOAL_LABELS[lead.goal_category],
        lead.goal_text,lead.affiliate_code,lead.selected_instructor,
        lessonInstructorName(lead.selected_instructor),lead.source
      ].filter(Boolean).join(" ").toLowerCase();

      const statusOk=status==="all"||lead.status===status;
      const instructorOk=instructor==="all"||(instructor==="none"?!lead.selected_instructor:lead.selected_instructor===instructor);
      return statusOk&&instructorOk&&(!search||hay.includes(search));
    });

    $("udv2LessonCount").textContent=`${visible.length} de ${state.lessonLeads.length}`;
    $("udv2LessonTotal").textContent=String(state.lessonLeads.length);
    $("udv2LessonNew").textContent=String(state.lessonLeads.filter(x=>x.status==="new").length);
    $("udv2LessonInstructor").textContent=String(state.lessonLeads.filter(x=>!!x.selected_instructor).length);
    $("udv2LessonConverted").textContent=String(state.lessonLeads.filter(x=>["scheduled","completed"].includes(x.status)).length);

    if(!visible.length){
      root.innerHTML='<div class="udv2-empty">No hay solicitudes con esos filtros.</div>';
      return;
    }

    root.innerHTML=visible.map(lead=>{
      const events=lessonEventsFor(lead.id);
      const open=state.lessonExpanded===lead.id;
      const statusLabel=LESSON_STATUS_LABELS[lead.status]||lead.status;
      const instructorName=lessonInstructorName(lead.selected_instructor);
      const source=[lead.affiliate_code?`Ref ${lead.affiliate_code}`:null,lead.utm_source,lead.source].filter(Boolean).join(" · ");
      return `<article class="udv2-lesson-card ${open?"is-open":""}" data-lesson-id="${lead.id}">
        <div class="udv2-lesson-summary">
          <div>
            <div class="udv2-lesson-name">
              <h3>${escapeHtml(lead.name)}</h3>
              <span class="udv2-badge ${lead.status==="closed"?"off":""}">${escapeHtml(statusLabel)}</span>
              ${lead.selected_instructor?`<span class="udv2-badge">${escapeHtml(instructorName)}</span>`:""}
            </div>
            <div class="udv2-lesson-sub">
              ${escapeHtml(lead.phone)} · ${escapeHtml(LESSON_SKILL_LABELS[lead.skill_level]||lead.skill_level)} ·
              ${escapeHtml(LESSON_GOAL_LABELS[lead.goal_category]||lead.goal_category)} · ${escapeHtml(dateTime(lead.created_at))}
            </div>
          </div>
          <button class="udv2-btn secondary udv2-lesson-toggle" type="button">${open?"Cerrar":"Ver solicitud"}</button>
        </div>

        <div class="udv2-lesson-detail">
          <div class="udv2-lesson-grid">
            <div class="udv2-lesson-cell"><span>Teléfono</span><strong>${escapeHtml(lead.phone)}</strong></div>
            <div class="udv2-lesson-cell"><span>Nivel</span><strong>${escapeHtml(LESSON_SKILL_LABELS[lead.skill_level]||lead.skill_level)}</strong></div>
            <div class="udv2-lesson-cell"><span>Objetivo</span><strong>${escapeHtml(LESSON_GOAL_LABELS[lead.goal_category]||lead.goal_category)}</strong></div>
            <div class="udv2-lesson-cell"><span>Instructor elegido</span><strong>${escapeHtml(instructorName)}</strong></div>
            <div class="udv2-lesson-cell"><span>Origen</span><strong>${escapeHtml(source||"Directo")}</strong></div>
            <div class="udv2-lesson-cell"><span>Idioma</span><strong>${lead.language==="en"?"English":"Español"}</strong></div>
          </div>

          ${lead.goal_text?`<div class="udv2-lesson-comment"><strong>Comentario del alumno</strong><br>${escapeHtml(lead.goal_text)}</div>`:""}

          <div class="udv2-lesson-actions">
            <a class="udv2-btn primary" href="${lessonWhatsapp(lead.phone,lead.name)}" target="_blank" rel="noopener">WhatsApp</a>
            <select class="udv2-lesson-status">
              ${Object.entries(LESSON_STATUS_LABELS).map(([value,label])=>`<option value="${value}" ${lead.status===value?"selected":""}>${label}</option>`).join("")}
            </select>
            <button class="udv2-btn secondary udv2-lesson-save" type="button">Guardar estado</button>
          </div>

          <div class="udv2-event-list">
            ${events.length?events.map(event=>`<div class="udv2-event">
              <span><strong>${event.event_type==="lead_created"?"Solicitud creada":"Interés en instructor"}</strong>${event.instructor_slug?` · ${escapeHtml(lessonInstructorName(event.instructor_slug))}`:""}</span>
              <span>${escapeHtml(dateTime(event.created_at))}</span>
            </div>`).join(""):'<div class="udv2-muted">Sin eventos adicionales.</div>'}
          </div>
        </div>
      </article>`;
    }).join("");

    qa("[data-lesson-id]",root).forEach(card=>{
      const id=card.dataset.lessonId;
      q(".udv2-lesson-toggle",card)?.addEventListener("click",()=>{
        state.lessonExpanded=state.lessonExpanded===id?null:id;
        renderLessons();
      });

      q(".udv2-lesson-save",card)?.addEventListener("click",async()=>{
        const button=q(".udv2-lesson-save",card);
        const newStatus=q(".udv2-lesson-status",card)?.value;
        button.disabled=true;
        button.textContent="Guardando…";
        try{
          const db=await getDb();
          const {error}=await db.from("golf_lesson_leads")
            .update({status:newStatus,updated_at:new Date().toISOString()})
            .eq("id",id);
          if(error)throw error;
          const lead=state.lessonLeads.find(x=>x.id===id);
          if(lead)lead.status=newStatus;
          toast("Estado de la solicitud actualizado.");
          renderLessons();
        }catch(error){
          toast(error.message||"No se pudo actualizar el estado.",true);
          button.disabled=false;
          button.textContent="Guardar estado";
        }
      });
    });
  }

  async function loadLessons(){
    const root=$("udv2LessonList");
    if(root)root.innerHTML='<div class="udv2-empty">Cargando solicitudes…</div>';

    try{
      await verifyAdmin();
      const db=await getDb();

      const [leadsResult,eventsResult,instructorsResult]=await Promise.all([
        db.from("golf_lesson_leads")
          .select("id,name,phone,phone_digits,skill_level,goal_category,goal_text,language,source,affiliate_code,utm_source,utm_medium,utm_campaign,utm_content,utm_term,referrer_host,selected_instructor,selected_at,status,consent_at,created_at,updated_at")
          .order("created_at",{ascending:false}),
        db.from("golf_lesson_events")
          .select("id,lead_id,event_type,instructor_slug,metadata,created_at")
          .order("created_at",{ascending:false}),
        db.from("golf_instructors")
          .select("slug,name,is_visible,is_active,sort_order")
          .order("sort_order",{ascending:true})
      ]);

      if(leadsResult.error)throw leadsResult.error;
      if(eventsResult.error)throw eventsResult.error;
      if(instructorsResult.error)throw instructorsResult.error;

      state.lessonLeads=leadsResult.data||[];
      state.lessonEvents=eventsResult.data||[];
      state.lessonInstructors=instructorsResult.data||[];
      renderLessons();
    }catch(error){
      console.error("Clases admin load",error);
      if(root)root.innerHTML=`<div class="udv2-empty">No se pudieron cargar las solicitudes.<br>${escapeHtml(error.message||"Error")}</div>`;
      toast(error.message||"No se pudieron cargar las solicitudes.",true);
    }
  }


  function posViewHtml(){
    return `

<div class="udv2-head">
  <div>
    <div class="udv2-eyebrow">Operación en tienda</div>
    <h1>POS / Caja</h1>
    <div class="udv2-muted">Empleados, terminales autorizadas, PIN de apertura y turnos.</div>
  </div>
  <div class="udv2-pos-launch">
    <button id="udv2PosRefresh" class="udv2-btn secondary" type="button">Actualizar</button>
    <a class="udv2-btn primary" href="/pos" target="_blank" rel="noopener">Abrir panel POS ↗</a>
  </div>
</div>

<div class="udv2-metrics">
  <article class="udv2-metric"><span>Empleados activos</span><strong id="udv2PosActiveEmployees">0</strong></article>
  <article class="udv2-metric"><span>Suspendidos</span><strong id="udv2PosSuspendedEmployees">0</strong></article>
  <article class="udv2-metric"><span>Terminales activas</span><strong id="udv2PosActiveTerminals">0</strong></article>
  <article class="udv2-metric"><span>Turnos abiertos</span><strong id="udv2PosOpenShifts">0</strong></article>
</div>

<div class="udv2-pos-tabs-wrap">
  <nav class="udv2-pos-tabs" aria-label="Secciones POS">
    <button type="button" class="udv2-pos-tab active" data-pos-section="dashboard">Dashboard</button>
    <button type="button" class="udv2-pos-tab" data-pos-section="terminals">Terminales y PIN</button>
    <button type="button" class="udv2-pos-tab" data-pos-section="employees">Empleados</button>
    <button type="button" class="udv2-pos-tab" data-pos-section="shifts">Turnos y Caja</button>
    <button type="button" class="udv2-pos-tab" data-pos-section="summary">Resumen y Ventas</button>
    <button type="button" class="udv2-pos-tab" data-pos-section="inventory">Inventario POS</button>
    <button type="button" class="udv2-pos-tab" data-pos-section="employees-report">Reporte por empleado</button>
    <button type="button" class="udv2-pos-tab" data-pos-section="daily-close">Cierre diario</button>
    <button type="button" class="udv2-pos-tab" data-pos-section="audit">Bitácora</button>
  </nav>
</div>

<div class="udv2-pos-section udv2-pos-section-dashboard active">
<section class="udv2-panel udv2-pos-dashboard">
  <div class="udv2-panel-head">
    <div>
      <h2>Dashboard POS</h2>
      <div class="udv2-muted">Resumen operativo de un día específico.</div>
    </div>
    <div class="udv2-dashboard-date-tools">
      <label class="udv2-dashboard-date-label">
        <span>Fecha</span>
        <input id="udv2PosDashboardDateInput" type="date" aria-label="Fecha del Dashboard">
      </label>
      <button type="button" id="udv2PosDashboardToday" class="udv2-dashboard-today">Hoy</button>
    </div>
  </div>

  <div id="udv2PosDashboardCards" class="udv2-dashboard-grid">
    <div class="udv2-empty">Cargando operación del día…</div>
  </div>

  <div class="udv2-dashboard-actions">
    <button type="button" class="udv2-dashboard-action" data-pos-goto="summary">Ver Resumen y Ventas</button>
    <button type="button" class="udv2-dashboard-action" data-pos-goto="shifts">Ver Turnos y Caja</button>
    <button type="button" class="udv2-dashboard-action" data-pos-goto="daily-close">Ver Cierre diario</button>
  </div>
</section>
</div>

<div id="udv2PosForceCloseModal" class="udv2-force-close-modal" hidden>
  <div class="udv2-force-close-backdrop" data-force-close-cancel></div>
  <section class="udv2-force-close-dialog" role="dialog" aria-modal="true" aria-labelledby="udv2ForceCloseTitle">
    <div class="udv2-force-close-head">
      <div>
        <small>CIERRE ADMINISTRATIVO</small>
        <h2 id="udv2ForceCloseTitle">Empleado con turno abierto</h2>
      </div>
      <button type="button" class="udv2-force-close-x" data-force-close-cancel aria-label="Cerrar">×</button>
    </div>

    <div id="udv2ForceCloseEmployee" class="udv2-force-close-employee"></div>

    <div class="udv2-force-close-warning">
      El turno debe cerrarse antes de cambiar el acceso del empleado. El cierre quedará registrado en la bitácora.
    </div>

    <div class="udv2-force-close-fields">
      <label>
        <span>Efectivo contado *</span>
        <input id="udv2ForceCloseCash" type="number" min="0" step="0.01" inputmode="decimal" placeholder="0.00">
      </label>
      <label>
        <span>Motivo del cierre forzado *</span>
        <textarea id="udv2ForceCloseReason" rows="3" maxlength="500" placeholder="Ej. El empleado se retiró sin cerrar turno."></textarea>
      </label>
    </div>

    <div class="udv2-force-close-actions">
      <button type="button" id="udv2ForceCloseViewShift">Ver turno</button>
      <button type="button" data-force-close-cancel>Cancelar</button>
      <button type="button" id="udv2ForceCloseConfirm" class="danger">Cerrar turno</button>
    </div>
  </section>
</div>

<div class="udv2-pos-section udv2-pos-section-terminals">
<div class="udv2-grid">
  <section class="udv2-panel">
    <div class="udv2-panel-head"><h2>Seguridad de apertura</h2></div>
    <div class="udv2-form">
      <div class="udv2-pos-note">El PIN es una segunda barrera además de usuario, contraseña y terminal autorizada. Genera uno nuevo al iniciar el día y compártelo solo dentro de la tienda.</div>
      <button id="udv2PosGeneratePin" class="udv2-btn primary" type="button">Generar PIN de hoy</button>
      <div id="udv2PosPinResult"></div>
    </div>
  </section>
  <section class="udv2-panel">
    <div class="udv2-panel-head"><h2>Terminales autorizadas</h2></div>
    <form id="udv2PosTerminalForm" class="udv2-form">
      <div class="udv2-field"><label>Nombre de terminal *</label><input id="udv2PosTerminalName" placeholder="Caja principal" maxlength="80" required></div>
      <button class="udv2-btn primary" type="submit">Crear código de activación</button>
      <div id="udv2PosTerminalCode"></div>
    </form>
    <div id="udv2PosTerminalList" class="udv2-pos-terminal-list"><div class="udv2-empty">Cargando…</div></div>
  </section>
</div>
</div>

<div class="udv2-pos-section udv2-pos-section-employees">
<div class="udv2-grid">
  <section class="udv2-panel">
    <div class="udv2-panel-head"><h2>Alta de empleado</h2></div>
    <form id="udv2PosEmployeeForm" class="udv2-form">
      <div class="udv2-row">
        <div class="udv2-field"><label>Número de empleado *</label><input id="udv2PosEmployeeNumber" inputmode="numeric" maxlength="8" placeholder="0024" required></div>
        <div class="udv2-field"><label>Nombre *</label><input id="udv2PosEmployeeName" maxlength="120" required></div>
      </div>
      <div class="udv2-row">
        <div class="udv2-field"><label>Rol *</label>
          <select id="udv2PosEmployeeRole">
            <option value="cashier">Cajero</option>
            <option value="supervisor">Supervisor</option>
            <option value="pos_admin">Administrador POS</option>
          </select>
        </div>
        <div class="udv2-field"><label>Contraseña inicial *</label><input id="udv2PosEmployeePassword" type="password" minlength="8" autocomplete="new-password" required></div>
      </div>
      <button class="udv2-btn primary" type="submit">Crear empleado</button>
    </form>
  </section>
  <section class="udv2-panel">
    <div class="udv2-panel-head"><h2>Empleados POS</h2><span id="udv2PosEmployeeCount" class="udv2-muted"></span></div>
    <div class="udv2-toolbar">
      <input id="udv2PosEmployeeSearch" type="search" placeholder="Buscar empleado…">
      <select id="udv2PosEmployeeFilter">
        <option value="all">Todos</option>
        <option value="active">Activos</option>
        <option value="suspended">Suspendidos</option>
        <option value="terminated">Baja</option>
      </select>
    </div>
    <div id="udv2PosEmployeeList" class="udv2-pos-employee-list"><div class="udv2-empty">Cargando…</div></div>
  </section>
</div>
</div>

<div class="udv2-pos-section udv2-pos-section-shifts">
<section class="udv2-panel udv2-shifts-wrap">
  <div class="udv2-panel-head">
    <div>
      <h2>Turnos y Caja</h2>
      <div class="udv2-muted">Detalle financiero por turno, empleado y terminal.</div>
    </div>
    <div class="udv2-report-tools">
      <span id="udv2PosShiftCount" class="udv2-muted"></span>
      <button type="button" class="udv2-print-btn" data-print-report="shifts">Imprimir A4</button>
    </div>
  </div>

  <div class="udv2-shifts-filters">
    <input id="udv2PosShiftFrom" type="date" aria-label="Desde">
    <input id="udv2PosShiftTo" type="date" aria-label="Hasta">
    <select id="udv2PosShiftEmployee"><option value="all">Todos los empleados</option></select>
    <select id="udv2PosShiftTerminal"><option value="all">Todas las terminales</option></select>
    <select id="udv2PosShiftStatus">
      <option value="all">Todos los turnos</option>
      <option value="open">Abiertos</option>
      <option value="closed">Cerrados</option>
    </select>
  </div>

  <div id="udv2PosShiftList" class="udv2-shifts-list">
    <div class="udv2-empty">Cargando turnos…</div>
  </div>
</section>
</div>

<div class="udv2-pos-section udv2-pos-section-summary">
<section class="udv2-panel udv2-pos-summary">
  <div class="udv2-panel-head">
    <div>
      <h2>Resumen / Ventas</h2>
      <div class="udv2-muted">Ventas, métodos de pago, anulaciones, devoluciones, caja y diferencias de cierre.</div>
    </div>
    <div class="udv2-report-tools">
      <span id="udv2PosSummaryCount" class="udv2-muted"></span>
      <button type="button" class="udv2-print-btn" data-print-report="summary">Imprimir A4</button>
    </div>
  </div>

  <div id="udv2PosSummaryCards" class="udv2-summary-grid">
    <div class="udv2-empty">Cargando resumen…</div>
  </div>

  <div class="udv2-summary-filters">
    <input id="udv2PosSummaryFrom" type="date" aria-label="Desde">
    <input id="udv2PosSummaryTo" type="date" aria-label="Hasta">
    <select id="udv2PosSummaryEmployee"><option value="all">Todos los empleados</option></select>
    <select id="udv2PosSummaryTerminal"><option value="all">Todas las terminales</option></select>
    <select id="udv2PosSummaryStatus">
      <option value="all">Todos los estados</option>
      <option value="completed">Completadas</option>
      <option value="voided">Anuladas</option>
      <option value="refunded">Devueltas</option>
    </select>
    <select id="udv2PosSummaryPayment">
      <option value="all">Todos los pagos</option>
      <option value="cash">Efectivo</option>
      <option value="card_terminal">Terminal</option>
      <option value="transfer">Transferencia</option>
      <option value="other">Otro</option>
    </select>
  </div>

  <div class="udv2-sales-table">
    <div class="udv2-sales-row head">
      <div>Venta</div>
      <div>Fecha / hora</div>
      <div>Empleado</div>
      <div>Terminal</div>
      <div>Pago</div>
      <div>Estado</div>
      <div>Total</div>
    </div>
    <div id="udv2PosSummarySales"><div class="udv2-empty">Cargando ventas…</div></div>
  </div>
</section>
</div>

<div class="udv2-pos-section udv2-pos-section-inventory">
<section class="udv2-panel udv2-inventory-report">
  <div class="udv2-panel-head">
    <div>
      <h2>Inventario POS</h2>
      <div class="udv2-muted">Consulta movimientos de inventario usando filtros por producto, fecha, tipo de movimiento, SKU o venta.</div>
    </div>
    <div class="udv2-report-tools">
      <span id="udv2PosInventoryCount" class="udv2-muted"></span>
      <button type="button" class="udv2-print-btn" data-print-report="inventory">Imprimir A4</button>
    </div>
  </div>

  <div class="udv2-inventory-filters">
    <input id="udv2PosInventoryFrom" type="date" aria-label="Desde">
    <input id="udv2PosInventoryTo" type="date" aria-label="Hasta">
    <select id="udv2PosInventoryProduct"><option value="all">Todos los productos</option></select>
    <select id="udv2PosInventoryMovement">
      <option value="all">Todos los movimientos</option>
      <option value="sale">Venta / salida</option>
      <option value="void">Reposición por anulación</option>
      <option value="refund">Reposición por devolución</option>
      <option value="restock">Reposición / entrada</option>
      <option value="adjustment">Ajuste</option>
    </select>
    <input id="udv2PosInventorySearch" type="search" placeholder="Producto, SKU o venta #">
  </div>

  <div class="udv2-inventory-table">
    <div class="udv2-inventory-row head">
      <div>Fecha / hora</div>
      <div>Producto</div>
      <div>SKU</div>
      <div>Movimiento</div>
      <div>Cambio</div>
      <div>Antes → después</div>
      <div>Referencia</div>
    </div>
    <div id="udv2PosInventoryRows"><div class="udv2-empty">Cargando inventario…</div></div>
  </div>
</section>
</div>

<div class="udv2-pos-section udv2-pos-section-employees-report">
<section class="udv2-panel udv2-employee-report">
  <div class="udv2-panel-head">
    <div>
      <h2>Reporte por empleado</h2>
      <div class="udv2-muted">Desempeño operativo, ventas, devoluciones, caja y diferencias de cierre.</div>
    </div>
    <div class="udv2-report-tools">
      <span id="udv2PosEmployeeReportCount" class="udv2-muted"></span>
      <button type="button" class="udv2-print-btn" data-print-report="employees-report">Imprimir A4</button>
    </div>
  </div>

  <div class="udv2-employee-report-filters">
    <input id="udv2PosEmployeeReportFrom" type="date" aria-label="Desde">
    <input id="udv2PosEmployeeReportTo" type="date" aria-label="Hasta">
    <select id="udv2PosEmployeeReportEmployee"><option value="all">Todos los empleados</option></select>
    <select id="udv2PosEmployeeReportTerminal"><option value="all">Todas las terminales</option></select>
  </div>

  <div id="udv2PosEmployeeReportRows" class="udv2-employee-report-list">
    <div class="udv2-empty">Cargando reporte…</div>
  </div>
</section>
</div>

<div class="udv2-pos-section udv2-pos-section-daily-close">
<section class="udv2-panel udv2-daily-close-report">
  <div class="udv2-panel-head">
    <div>
      <h2>Cierre diario consolidado</h2>
      <div class="udv2-muted">Consolidado de ventas, pagos, caja y turnos de una fecha.</div>
    </div>
    <div class="udv2-report-tools">
      <button type="button" class="udv2-print-btn" data-print-report="daily-close">Imprimir A4</button>
    </div>
  </div>

  <div class="udv2-daily-close-filters">
    <input id="udv2PosDailyCloseDate" type="date" aria-label="Fecha">
    <select id="udv2PosDailyCloseTerminal"><option value="all">Todas las terminales</option></select>
  </div>

  <div id="udv2PosDailyCloseBody">
    <div class="udv2-empty">Cargando cierre…</div>
  </div>
</section>
</div>

<div class="udv2-pos-section udv2-pos-section-audit">
<section class="udv2-panel udv2-audit-wrap">
  <div class="udv2-panel-head">
    <div>
      <h2>Bitácora POS</h2>
      <div class="udv2-muted">Vista Operación por defecto. Los filtros se aplican en servidor para que ventas, devoluciones y caja no queden ocultas por eventos técnicos.</div>
    </div>
    <div class="udv2-report-tools">
      <span id="udv2PosAuditCount" class="udv2-muted"></span>
      <button type="button" class="udv2-print-btn" data-print-report="audit">Imprimir A4</button>
    </div>
  </div>
  <div class="udv2-audit-toolbar">
    <input id="udv2PosAuditSearch" type="search" placeholder="Buscar venta, empleado, motivo…">
    <select id="udv2PosAuditType">
      <option value="operation">Operación</option>
      <option value="all">Todos los eventos</option>
      <option value="sale_completed">Ventas</option>
      <option value="sale_voided">Anulaciones</option>
      <option value="refunds">Devoluciones</option>
      <option value="refund_document">Documentos devolución</option>
      <option value="cash_in">Entradas caja</option>
      <option value="cash_out">Salidas caja</option>
      <option value="inventory_deducted">Inventario descontado</option>
      <option value="inventory_restored">Inventario repuesto</option>
      <option value="shift_opened">Turnos abiertos</option>
      <option value="shift_closed">Turnos cerrados</option>
      <option value="employee_login">Accesos</option>
      <option value="terminal_activated">Activación terminal</option>
    </select>
    <select id="udv2PosAuditEmployee"><option value="all">Todos los empleados</option></select>
    <select id="udv2PosAuditTerminal"><option value="all">Todas las terminales</option></select>
    <input id="udv2PosAuditFrom" type="date" aria-label="Desde">
    <input id="udv2PosAuditTo" type="date" aria-label="Hasta">
  </div>
  <div id="udv2PosAuditList" class="udv2-audit-list"><div class="udv2-empty">Cargando bitácora…</div></div>
</section>
</div>

<div id="udv2SaleDetailModal" class="udv2-modal" aria-hidden="true">
  <div class="udv2-modal-backdrop" data-sale-detail-close></div>
  <div class="udv2-modal-card" role="dialog" aria-modal="true" aria-labelledby="udv2SaleDetailTitle">
    <div class="udv2-modal-head">
      <div>
        <div class="udv2-eyebrow">DETALLE DE VENTA</div>
        <h2 id="udv2SaleDetailTitle">Venta</h2>
      </div>
      <button type="button" class="udv2-modal-close" data-sale-detail-close>×</button>
    </div>
    <div id="udv2SaleDetailBody" class="udv2-modal-body">
      <div class="udv2-empty">Cargando…</div>
    </div>
  </div>
</div>
`;
  }

  const POS_ROLE_LABELS={cashier:"Cajero",supervisor:"Supervisor",pos_admin:"Administrador POS"};

  async function posAdminApi(payload){
    const response=await fetch("/api/admin/pos/employees",{
      method:"POST",
      headers:{"Content-Type":"application/json"},
      body:JSON.stringify(payload)
    });
    const body=await response.json().catch(()=>({}));
    if(!response.ok)throw new Error(body.error||"No fue posible completar la operación.");
    return body;
  }

  function getEmployeeOpenShift(employeeId){
    return state.posShifts.find(x=>x.employee_id===employeeId&&x.status==="open")||null;
  }

  function closeForceCloseModal(){
    const modal=$("udv2PosForceCloseModal");
    if(modal)modal.hidden=true;
    state.posForceCloseEmployeeId=null;
    state.posForceCloseTargetAction=null;
    if($("udv2ForceCloseCash"))$("udv2ForceCloseCash").value="";
    if($("udv2ForceCloseReason"))$("udv2ForceCloseReason").value="";
  }

  function openForceCloseModal(emp,targetAction){
    const shift=getEmployeeOpenShift(emp.id);
    if(!shift)return false;

    state.posForceCloseEmployeeId=emp.id;
    state.posForceCloseTargetAction=targetAction;

    const terminal=state.posTerminals.find(x=>x.id===shift.terminal_id);
    const targetLabel=targetAction==="terminate"?"Dar de baja":"Suspender";

    $("udv2ForceCloseTitle").textContent=`Cerrar turno para ${targetLabel.toLowerCase()}`;
    $("udv2ForceCloseEmployee").innerHTML=`
      <strong>#${escapeHtml(emp.employee_number)} · ${escapeHtml(emp.full_name)}</strong>
      <small>${escapeHtml(POS_ROLE_LABELS[emp.role]||emp.role)} · ${escapeHtml(terminal?.name||"Terminal")} · Apertura ${escapeHtml(dateTime(shift.opened_at))}</small>
    `;
    $("udv2ForceCloseConfirm").textContent=targetAction==="terminate"
      ?"Cerrar turno y dar de baja"
      :"Cerrar turno y suspender";

    const modal=$("udv2PosForceCloseModal");
    modal.hidden=false;
    setTimeout(()=>$("udv2ForceCloseCash")?.focus(),0);
    return true;
  }

  async function confirmForceClose(){
    const employeeId=state.posForceCloseEmployeeId;
    const targetAction=state.posForceCloseTargetAction;
    if(!employeeId||!targetAction)return;

    const emp=state.posEmployees.find(x=>x.id===employeeId);
    if(!emp)return closeForceCloseModal();

    const closingCash=Number($("udv2ForceCloseCash")?.value);
    const reason=String($("udv2ForceCloseReason")?.value||"").trim();

    if(!Number.isFinite(closingCash)||closingCash<0){
      return toast("Escribe el efectivo contado.",true);
    }
    if(reason.length<3){
      return toast("Escribe el motivo del cierre administrativo.",true);
    }

    const button=$("udv2ForceCloseConfirm");
    button.disabled=true;
    const original=button.textContent;
    button.textContent="Procesando…";

    try{
      const result=await posAdminApi({
        action:targetAction==="terminate"
          ?"force_close_and_terminate"
          :"force_close_and_suspend",
        employee_id:employeeId,
        closing_cash:closingCash,
        reason
      });

      const difference=Number(result?.forced_close?.difference||0);
      closeForceCloseModal();
      toast(
        targetAction==="terminate"
          ?`Turno cerrado y empleado dado de baja. Diferencia: ${money(difference)}`
          :`Turno cerrado y empleado suspendido. Diferencia: ${money(difference)}`
      );
      await loadPosAdmin();
    }catch(error){
      toast(error.message||"No se pudo cerrar el turno administrativamente.",true);
    }finally{
      button.disabled=false;
      button.textContent=original;
    }
  }

  function renderPosEmployees(){
    const list=$("udv2PosEmployeeList");
    if(!list)return;
    const search=String(state.posEmployeeSearch||"").toLowerCase();
    const filter=state.posEmployeeFilter||"all";
    const rows=state.posEmployees.filter(x=>{
      const matchesFilter=filter==="all"||x.status===filter;
      const hay=[x.employee_number,x.full_name,POS_ROLE_LABELS[x.role],x.status].filter(Boolean).join(" ").toLowerCase();
      return matchesFilter&&(!search||hay.includes(search));
    });

    $("udv2PosEmployeeCount").textContent=`${rows.length} de ${state.posEmployees.length}`;
    $("udv2PosActiveEmployees").textContent=String(state.posEmployees.filter(x=>x.status==="active").length);
    $("udv2PosSuspendedEmployees").textContent=String(state.posEmployees.filter(x=>x.status==="suspended").length);

    if(!rows.length){
      list.innerHTML='<div class="udv2-empty">No hay empleados con esos filtros.</div>';
      return;
    }

    list.innerHTML=rows.map(emp=>`
      <article class="udv2-pos-card" data-pos-employee="${emp.id}">
        <div class="udv2-pos-card-head">
          <div>
            <h3>#${escapeHtml(emp.employee_number)} · ${escapeHtml(emp.full_name)}</h3>
            <small>${escapeHtml(POS_ROLE_LABELS[emp.role]||emp.role)} · Alta ${escapeHtml(dateTime(emp.created_at))}${emp.last_login_at?` · Último acceso ${escapeHtml(dateTime(emp.last_login_at))}`:""}</small>
          </div>
          <span class="udv2-pos-status ${escapeHtml(emp.status)}">${emp.status==="active"?"Activo":emp.status==="suspended"?"Suspendido":"Baja"}</span>
        </div>
        ${getEmployeeOpenShift(emp.id)?`<div class="udv2-force-close-warning">Tiene un turno abierto desde ${escapeHtml(dateTime(getEmployeeOpenShift(emp.id).opened_at))}.</div>`:""}
        <div class="udv2-pos-actions">
          ${emp.status==="active"?`<button data-pos-action="suspend" type="button">Suspender</button>`:""}
          ${emp.status==="suspended"?`<button data-pos-action="reactivate" type="button">Reactivar</button>`:""}
          ${emp.status!=="terminated"?`<button data-pos-action="reset_password" type="button">Restablecer contraseña</button>`:""}
          ${emp.status!=="terminated"?`<button data-pos-action="terminate" class="danger" type="button">Dar de baja</button>`:""}
        </div>
      </article>
    `).join("");

    qa("[data-pos-employee]",list).forEach(card=>{
      const id=card.dataset.posEmployee;
      qa("[data-pos-action]",card).forEach(button=>{
        button.addEventListener("click",async()=>{
          const action=button.dataset.posAction;
          const emp=state.posEmployees.find(x=>x.id===id);
          if(!emp)return;

          let password=null;
          if(action==="reset_password"){
            password=prompt(`Nueva contraseña para ${emp.full_name} (mínimo 8 caracteres):`)||"";
            if(password.length<8)return toast("La contraseña debe tener al menos 8 caracteres.",true);
          }

          if((action==="suspend"||action==="terminate")&&getEmployeeOpenShift(emp.id)){
            openForceCloseModal(emp,action);
            return;
          }

          if(action==="terminate"&&!confirm(`Dar de baja a ${emp.full_name}? Su historial se conservará.`))return;
          if(action==="suspend"&&!confirm(`Suspender el acceso de ${emp.full_name}?`))return;

          button.disabled=true;
          try{
            await posAdminApi({action,employee_id:id,password});
            toast(action==="suspend"?"Empleado suspendido.":action==="reactivate"?"Empleado reactivado.":action==="terminate"?"Empleado dado de baja.":"Contraseña actualizada.");
            await loadPosAdmin();
          }catch(error){
            toast(error.message,true);
          }finally{
            button.disabled=false;
          }
        });
      });
    });
  }

  function renderPosTerminals(){
    const list=$("udv2PosTerminalList");
    if(!list)return;

    $("udv2PosActiveTerminals").textContent=String(state.posTerminals.filter(x=>x.status==="active").length);
    if(!state.posTerminals.length){
      list.innerHTML='<div class="udv2-empty">Aún no hay terminales.</div>';
      return;
    }

    list.innerHTML=state.posTerminals.map(t=>`
      <article class="udv2-pos-card" data-pos-terminal="${t.id}">
        <div class="udv2-pos-card-head">
          <div>
            <h3>${escapeHtml(t.name)}</h3>
            <small>${t.activated_at?`Activada ${escapeHtml(dateTime(t.activated_at))}`:"Pendiente de activación"}${t.last_seen_at?` · Último uso ${escapeHtml(dateTime(t.last_seen_at))}`:""}</small>
          </div>
          <span class="udv2-pos-status ${t.status==="revoked"?"revoked":t.activated_at?"":"pending"}">${t.status==="revoked"?"Revocada":t.activated_at?"Activa":"Pendiente"}</span>
        </div>
        ${t.status!=="revoked"?`<div class="udv2-pos-actions">
          <button data-terminal-reauthorize type="button">Reautorizar terminal</button>
          <button data-terminal-revoke type="button" class="danger">Revocar terminal</button>
        </div>`:""}
      </article>
    `).join("");

    qa("[data-pos-terminal]",list).forEach(card=>{
      q("[data-terminal-reauthorize]",card)?.addEventListener("click",async()=>{
        if(!confirm("¿Reautorizar esta terminal? El dispositivo actualmente vinculado dejará de estar autorizado."))return;
        try{
          const db=await getDb();
          const {data,error}=await db.rpc("admin_pos_reauthorize_terminal",{p_terminal_id:card.dataset.posTerminal});
          if(error)throw error;
          const row=Array.isArray(data)?data[0]:data;
          $("udv2PosTerminalCode").innerHTML=`<div class="udv2-pos-code"><span>Código de reautorización · válido 20 minutos</span><strong>${escapeHtml(row.activation_code)}</strong></div>`;
          toast("Código de reautorización generado.");
          await loadPosAdmin();
        }catch(error){toast(error.message,true)}
      });

      q("[data-terminal-revoke]",card)?.addEventListener("click",async()=>{
        if(!confirm("Revocar esta terminal? Dejará de poder abrir el POS."))return;
        try{
          const db=await getDb();
          const {error}=await db.rpc("admin_pos_revoke_terminal",{p_terminal_id:card.dataset.posTerminal});
          if(error)throw error;
          toast("Terminal revocada.");
          await loadPosAdmin();
        }catch(error){toast(error.message,true)}
      });
    });
  }

  function printPosReport(report){
    const config={
      shifts:{
        title:"Turnos y Caja",
        selector:".udv2-pos-section-shifts"
      },
      summary:{
        title:"Resumen y Ventas",
        selector:".udv2-pos-section-summary"
      },
      audit:{
        title:"Bitácora POS",
        selector:".udv2-pos-section-audit"
      },
      inventory:{
        title:"Inventario POS",
        selector:".udv2-pos-section-inventory"
      },
      "employees-report":{
        title:"Reporte por empleado",
        selector:".udv2-pos-section-employees-report"
      },
      "daily-close":{
        title:"Cierre diario consolidado",
        selector:".udv2-pos-section-daily-close"
      }
    };

    const current=config[report];
    if(!current)return;

    const source=document.querySelector(`#updown-admin ${current.selector}`);
    if(!source){
      toast("No se encontró el reporte para imprimir.",true);
      return;
    }

    const clone=source.cloneNode(true);
    clone.querySelectorAll("button").forEach(el=>el.remove());

    // Preserve selected values as readable text for print.
    clone.querySelectorAll("select").forEach(select=>{
      const text=select.options?.[select.selectedIndex]?.textContent||"";
      const span=document.createElement("span");
      span.className="print-filter-value";
      span.textContent=text;
      select.replaceWith(span);
    });

    clone.querySelectorAll('input[type="date"],input[type="text"],input[type="search"]').forEach(input=>{
      const span=document.createElement("span");
      span.className="print-filter-value";
      span.textContent=input.value||"Todos";
      input.replaceWith(span);
    });

    // All grouped dates must print expanded.
    clone.querySelectorAll(".udv2-shift-date-body").forEach(el=>{
      el.classList.remove("is-collapsed");
    });

    const printedAt=new Intl.DateTimeFormat("es-MX",{
      dateStyle:"full",
      timeStyle:"short"
    }).format(new Date());

    const popup=window.open("","_blank","width=1100,height=800");
    if(!popup){
      toast("El navegador bloqueó la ventana de impresión.",true);
      return;
    }

    popup.document.open();
    popup.document.write(`
      <!doctype html>
      <html lang="es">
      <head>
        <meta charset="utf-8">
        <title>UP AND DOWN · ${current.title}</title>
        <style>
          @page{size:A4 portrait;margin:12mm}
          *{box-sizing:border-box}
          html,body{margin:0;padding:0;background:#fff;color:#172c27;font-family:Arial,Helvetica,sans-serif}
          body{font-size:9pt;line-height:1.35}
          .print-header{display:flex;justify-content:space-between;gap:20px;align-items:flex-end;border-bottom:2px solid #143e35;padding-bottom:8px;margin-bottom:12px}
          .print-brand{font-family:Georgia,serif;font-size:20pt;font-weight:700;color:#143e35;letter-spacing:-.02em}
          .print-title{font-size:12pt;font-weight:700;color:#143e35;margin-top:2px}
          .print-meta{text-align:right;color:#66736f;font-size:8pt}
          .udv2-panel{border:0!important;box-shadow:none!important;background:#fff!important}
          .udv2-panel-head{display:flex;justify-content:space-between;align-items:flex-start;gap:12px;margin-bottom:8px}
          .udv2-panel-head h2{font-size:13pt;margin:0 0 3px}
          .udv2-muted{color:#68736f;font-size:8pt}
          .udv2-report-tools{display:none!important}
          .udv2-summary-grid{display:grid;grid-template-columns:repeat(4,1fr);gap:5px;margin:8px 0 10px}
          .udv2-summary-card,.udv2-shift-metric{border:1px solid #d8dfdc;border-radius:6px;padding:6px;break-inside:avoid}
          .udv2-summary-card span,.udv2-shift-metric span{display:block;font-size:6.5pt;text-transform:uppercase;color:#6a7571;font-weight:700}
          .udv2-summary-card strong,.udv2-shift-metric strong{display:block;margin-top:2px;font-size:9pt;color:#143e35}
          .udv2-summary-filters,.udv2-shifts-filters,.udv2-audit-filters{display:flex;flex-wrap:wrap;gap:5px;border:1px solid #e1e5e3;border-radius:6px;padding:6px;margin:6px 0 10px}
          .print-filter-value{border:1px solid #d8dfdc;border-radius:5px;padding:4px 6px;background:#f8faf9;font-size:7.5pt}
          .udv2-sales-row{display:grid;grid-template-columns:70px 95px 1fr 100px 90px 70px 80px;gap:5px;padding:5px;border-bottom:1px solid #e4e8e6;align-items:center;break-inside:avoid}
          .udv2-sales-row.head{font-size:6.5pt;text-transform:uppercase;font-weight:700;background:#f3f6f4}
          .udv2-sales-row strong{font-size:8pt;color:#143e35}
          .udv2-sales-row small{font-size:6.5pt;color:#68736f}
          .udv2-sale-status{font-size:6.5pt;border:1px solid #cbd4d0;padding:2px 4px;border-radius:9px}
          .udv2-shifts-list{display:block}
          .udv2-shift-date-group{margin:0 0 10px;border:1px solid #d8dfdc;border-radius:6px;overflow:hidden;break-inside:auto}
          .udv2-shift-date-head{width:100%;display:flex;justify-content:space-between;padding:6px;background:#f2f5f3;border:0;border-bottom:1px solid #d8dfdc}
          .udv2-shift-date-head strong{font-size:8pt;color:#143e35}
          .udv2-shift-date-body{display:block!important;padding:5px}
          .udv2-shift-card{border:1px solid #dfe5e2;border-radius:5px;margin-bottom:6px;break-inside:avoid}
          .udv2-shift-head{display:grid;grid-template-columns:1.2fr 1fr 1fr auto;gap:5px;background:#fafbfa;padding:5px;border-bottom:1px solid #e3e7e5}
          .udv2-shift-head strong{font-size:7.5pt}
          .udv2-shift-head small{font-size:6.5pt}
          .udv2-shift-body{display:grid;grid-template-columns:repeat(4,1fr);gap:4px;padding:5px}
          .udv2-shift-note{font-size:7pt;margin:0 5px 5px;padding:5px;background:#faf7f0}
          .udv2-inventory-filters{display:flex;flex-wrap:wrap;gap:5px;border:1px solid #e1e5e3;border-radius:6px;padding:6px;margin:6px 0}
          .udv2-inventory-row{display:grid;grid-template-columns:82px 1fr 62px 85px 45px 68px 1fr;gap:4px;padding:4px;border-bottom:1px solid #e4e8e6;align-items:center;break-inside:avoid}
          .udv2-inventory-row.head{font-size:6.2pt;text-transform:uppercase;font-weight:700;background:#f3f6f4}
          .udv2-employee-report-list{display:block}
          .udv2-employee-report-card{border:1px solid #d8dfdc;border-radius:6px;padding:6px;margin-bottom:7px;break-inside:avoid}
          .udv2-report-metrics,.udv2-daily-close-grid{display:grid;grid-template-columns:repeat(4,1fr);gap:4px}
          .udv2-report-metric{border:1px solid #d8dfdc;border-radius:5px;padding:5px}
          .udv2-report-metric span{display:block;font-size:6.2pt;text-transform:uppercase;color:#68736f;font-weight:700}
          .udv2-report-metric strong{display:block;margin-top:2px;font-size:8.5pt;color:#143e35}
          .udv2-daily-close-shifts{margin-top:8px}
          .udv2-daily-close-shift{display:grid;grid-template-columns:1.2fr 1fr 1fr 1fr 1fr 1fr;gap:4px;padding:5px 0;border-bottom:1px solid #e4e8e6;font-size:7pt;break-inside:avoid}
          .udv2-daily-close-shift-head{font-size:6.5pt;font-weight:700;text-transform:uppercase;background:#f3f6f4;padding:5px}
          .udv2-audit-list{display:block}
          .udv2-audit-row{border-bottom:1px solid #e1e5e3;padding:6px 3px;break-inside:avoid}
          .udv2-audit-row strong{font-size:8pt}
          .udv2-audit-row small{font-size:6.8pt;color:#68736f}
          a{color:inherit;text-decoration:none}
          @media print{
            body{-webkit-print-color-adjust:exact;print-color-adjust:exact}
          }
        </style>
      </head>
      <body>
        <header class="print-header">
          <div>
            <div class="print-brand">UP AND DOWN</div>
            <div class="print-title">${current.title}</div>
          </div>
          <div class="print-meta">Reporte administrativo<br>${printedAt}</div>
        </header>
        ${clone.innerHTML}
        <script>
          window.onload=function(){
            setTimeout(function(){window.print();},150);
          };
        <\/script>
      </body>
      </html>
    `);
    popup.document.close();
  }

  function setPosAdminSection(section){
    const allowed=new Set(["dashboard","terminals","employees","shifts","summary","inventory","employees-report","daily-close","audit"]);
    const next=allowed.has(section)?section:"dashboard";
    state.posAdminSection=next;

    document.querySelectorAll("#updown-admin .udv2-pos-tab").forEach(btn=>{
      const isActive=btn.getAttribute("data-pos-section")===next;
      btn.classList.toggle("active",isActive);
      btn.setAttribute("aria-selected",isActive?"true":"false");
    });

    document.querySelectorAll("#updown-admin .udv2-pos-section").forEach(sectionEl=>{
      sectionEl.classList.remove("active");
      sectionEl.setAttribute("aria-hidden","true");
    });

    const target=document.querySelector(`#updown-admin .udv2-pos-section-${next}`);
    if(target){
      target.classList.add("active");
      target.setAttribute("aria-hidden","false");
    }
  }

  function bindPosAdminTabs(){
    document.querySelectorAll("#updown-admin .udv2-pos-tab").forEach(btn=>{
      btn.addEventListener("click",()=>{
        setPosAdminSection(String(btn.getAttribute("data-pos-section")||"terminals"));
      });
    });
    document.querySelectorAll("#updown-admin [data-print-report]").forEach(btn=>{
      btn.addEventListener("click",()=>{
        printPosReport(String(btn.getAttribute("data-print-report")||""));
      });
    });
    setPosAdminSection(state.posAdminSection||"dashboard");
  }

  function inventoryMovementLabel(value){
    const map={
      sale:"Venta / salida",
      refund:"Reposición por devolución",
      void:"Reposición por anulación",
      restock:"Reposición / entrada",
      adjustment:"Ajuste"
    };
    return map[value]||String(value||"—");
  }

  function populateInventoryFilters(){
    const product=$("udv2PosInventoryProduct");
    if(product){
      const rows=state.posInventoryStock||[];
      product.innerHTML='<option value="all">Todos los productos</option>'+rows.map(x=>`<option value="${x.id}">${escapeHtml(x.name||"Producto")} ${x.sku?`· ${escapeHtml(x.sku)}`:""}</option>`).join("");
      product.value=state.posInventoryProduct||"all";
    }
    if($("udv2PosInventoryMovement"))$("udv2PosInventoryMovement").value=state.posInventoryMovement||"all";
  }

  function renderPosInventory(){
    const rowsEl=$("udv2PosInventoryRows");
    if(!rowsEl)return;

    const movements=state.posInventoryRows||[];
    $("udv2PosInventoryCount").textContent=`${movements.length} movimientos`;

    rowsEl.innerHTML=movements.length
      ? movements.map(row=>{
          const delta=Number(row.quantity_change||0);
          const ref=row.sale_number
            ? `Venta #${row.sale_number}${row.note?` · ${row.note}`:""}`
            : (row.note||"—");
          return `
            <div class="udv2-inventory-row">
              <div><strong>${escapeHtml(dateTime(row.created_at))}</strong></div>
              <div><strong>${escapeHtml(row.product_name||"Producto")}</strong></div>
              <div>${escapeHtml(row.sku||"—")}</div>
              <div>${escapeHtml(inventoryMovementLabel(row.movement_kind))}</div>
              <div class="udv2-inventory-delta ${delta<0?"negative":"positive"}"><strong>${delta>0?"+":""}${escapeHtml(String(delta))}</strong></div>
              <div><strong>${escapeHtml(`${row.stock_before??"—"} → ${row.stock_after??"—"}`)}</strong></div>
              <div>${escapeHtml(ref)}</div>
            </div>
          `;
        }).join("")
      : '<div class="udv2-empty">No hay movimientos con esos filtros.</div>';
  }

  async function loadPosInventory(){
    try{
      const db=await getDb();
      const from=$("udv2PosInventoryFrom")?.value||"";
      const to=$("udv2PosInventoryTo")?.value||"";
      const search=String($("udv2PosInventorySearch")?.value||"").trim();

      const {data,error}=await db.rpc("admin_pos_inventory_report",{
        p_from:from?new Date(`${from}T00:00:00`).toISOString():null,
        p_to:to?new Date(`${to}T23:59:59.999`).toISOString():null,
        p_product_id:(state.posInventoryProduct&&state.posInventoryProduct!=="all")?state.posInventoryProduct:null,
        p_movement_type:(state.posInventoryMovement&&state.posInventoryMovement!=="all")?state.posInventoryMovement:null,
        p_search:search||null,
        p_limit:1000
      });
      if(error)throw error;

      state.posInventoryRows=Array.isArray(data?.movements)?data.movements:[];
      state.posInventoryStock=Array.isArray(data?.stock)?data.stock:[];
      populateInventoryFilters();
      renderPosInventory();
    }catch(error){
      console.error("POS inventory load",error);
      if($("udv2PosInventoryRows"))$("udv2PosInventoryRows").innerHTML=`<div class="udv2-empty">No se pudo cargar inventario.<br>${escapeHtml(error.message||"Error")}</div>`;
      toast(error.message||"No se pudo cargar inventario.",true);
    }
  }

  function saleStatusAdminLabel(status){
    const map={completed:"Completada",voided:"Anulada",refunded:"Devuelta"};
    return map[status]||String(status||"—");
  }

  function paymentAdminLabel(method){
    const map={cash:"Efectivo",card_terminal:"Terminal",transfer:"Transferencia",other:"Otro"};
    return map[method]||String(method||"—");
  }

  function closeSaleDetail(){
    const modal=$("udv2SaleDetailModal");
    if(modal){
      modal.classList.remove("open");
      modal.setAttribute("aria-hidden","true");
    }
  }

  function renderSaleDetail(data){
    const body=$("udv2SaleDetailBody");
    const title=$("udv2SaleDetailTitle");
    if(!body||!title)return;

    const sale=data?.sale||{};
    const items=Array.isArray(data?.items)?data.items:[];
    const payments=Array.isArray(data?.payments)?data.payments:[];
    const events=Array.isArray(data?.events)?data.events:[];
    const refunds=Array.isArray(data?.refunds)?data.refunds:[];

    title.textContent=`Venta #${sale.sale_number||"—"}`;

    body.innerHTML=`
      <div class="udv2-sale-detail-grid">
        <div class="udv2-sale-detail-card"><span>Estado</span><strong>${escapeHtml(saleStatusAdminLabel(sale.status))}</strong></div>
        <div class="udv2-sale-detail-card"><span>Total</span><strong>${escapeHtml(money(Number(sale.total||0)))}</strong></div>
        <div class="udv2-sale-detail-card"><span>Empleado</span><strong>${escapeHtml(sale.employee_number?`#${sale.employee_number} · ${sale.employee_name||""}`:(sale.employee_name||"—"))}</strong></div>
        <div class="udv2-sale-detail-card"><span>Terminal</span><strong>${escapeHtml(sale.terminal_name||"—")}</strong></div>
        <div class="udv2-sale-detail-card"><span>Fecha</span><strong>${escapeHtml(dateTime(sale.created_at))}</strong></div>
        <div class="udv2-sale-detail-card"><span>Turno</span><strong>${escapeHtml(sale.shift_opened_at?dateTime(sale.shift_opened_at):dateTime(sale.created_at))}</strong></div>
        <div class="udv2-sale-detail-card"><span>Subtotal</span><strong>${escapeHtml(money(Number(sale.subtotal||0)))}</strong></div>
        <div class="udv2-sale-detail-card"><span>Descuento</span><strong>${escapeHtml(money(Number(sale.discount_amount||0)))}</strong></div>
      </div>

      <div class="udv2-sale-detail-section">
        <h3>Productos</h3>
        ${items.length?items.map(item=>`
          <div class="udv2-sale-detail-line">
            <div><strong>${escapeHtml(item.product_name||"Producto")}</strong><br><small>${escapeHtml(item.sku||"")}</small></div>
            <div>${escapeHtml(String(item.quantity||0))} uds.</div>
            <div>${escapeHtml(money(Number(item.unit_price||0)))}</div>
            <div><strong>${escapeHtml(money(Number(item.line_total||0)))}</strong></div>
          </div>
        `).join(""):'<div class="udv2-empty">Sin productos.</div>'}
      </div>

      <div class="udv2-sale-detail-section">
        <h3>Pagos</h3>
        ${payments.length?payments.map(p=>`
          <div class="udv2-sale-detail-line">
            <div><strong>${escapeHtml(paymentAdminLabel(p.method))}</strong></div>
            <div></div>
            <div>${escapeHtml(p.reference||"")}</div>
            <div><strong>${escapeHtml(money(Number(p.amount||0)))}</strong></div>
          </div>
        `).join(""):'<div class="udv2-empty">Sin pagos.</div>'}
      </div>

      ${sale.void_reason?`<div class="udv2-shift-note"><strong>Motivo de anulación:</strong> ${escapeHtml(sale.void_reason)}</div>`:""}
      ${sale.refund_reason?`<div class="udv2-shift-note"><strong>Motivo de devolución:</strong> ${escapeHtml(sale.refund_reason)}</div>`:""}

      <div class="udv2-sale-detail-section">
        <h3>Historial de la venta</h3>
        ${events.length?events.map(e=>`
          <div class="udv2-audit-row">
            <strong>${escapeHtml(auditTypeLabel(e.event_type))}</strong>
            <small>${escapeHtml(dateTime(e.created_at))}</small>
          </div>
        `).join(""):'<div class="udv2-empty">Sin eventos.</div>'}
      </div>

      ${refunds.length?`
      <div class="udv2-sale-detail-section">
        <h3>Documentos de devolución</h3>
        ${refunds.map(r=>`
          <div class="udv2-sale-detail-line">
            <div><strong>${escapeHtml(paymentAdminLabel(r.method))}</strong></div>
            <div>${escapeHtml(dateTime(r.created_at))}</div>
            <div>${escapeHtml(r.reason||"")}</div>
            <div><strong>${escapeHtml(money(Number(r.amount||0)))}</strong></div>
          </div>
        `).join("")}
      </div>`:""}

      <div class="udv2-sale-detail-actions">
        <button type="button" class="udv2-print-btn" onclick="window.print()">Imprimir vista</button>
      </div>
    `;
  }

  async function openSaleDetail(saleId){
    try{
      const modal=$("udv2SaleDetailModal");
      if(modal){
        modal.classList.add("open");
        modal.setAttribute("aria-hidden","false");
      }
      if($("udv2SaleDetailBody"))$("udv2SaleDetailBody").innerHTML='<div class="udv2-empty">Cargando detalle…</div>';

      const db=await getDb();
      const {data,error}=await db.rpc("admin_pos_sale_detail",{p_sale_id:saleId});
      if(error)throw error;
      state.posSaleDetail=data?.data||null;
      renderSaleDetail(state.posSaleDetail);
    }catch(error){
      console.error("sale detail load",error);
      if($("udv2SaleDetailBody"))$("udv2SaleDetailBody").innerHTML=`<div class="udv2-empty">No se pudo cargar la venta.<br>${escapeHtml(error.message||"Error")}</div>`;
    }
  }

  function populateEmployeeReportFilters(){
    const employee=$("udv2PosEmployeeReportEmployee");
    const terminal=$("udv2PosEmployeeReportTerminal");

    if(employee){
      employee.innerHTML='<option value="all">Todos los empleados</option>'+state.posEmployees.map(x=>`<option value="${x.id}">#${escapeHtml(x.employee_number)} · ${escapeHtml(x.full_name)}</option>`).join("");
      employee.value=state.posEmployeeReportEmployee||"all";
    }

    if(terminal){
      terminal.innerHTML='<option value="all">Todas las terminales</option>'+state.posTerminals.map(x=>`<option value="${x.id}">${escapeHtml(x.name)}</option>`).join("");
      terminal.value=state.posEmployeeReportTerminal||"all";
    }

    const dailyTerminal=$("udv2PosDailyCloseTerminal");
    if(dailyTerminal){
      dailyTerminal.innerHTML='<option value="all">Todas las terminales</option>'+state.posTerminals.map(x=>`<option value="${x.id}">${escapeHtml(x.name)}</option>`).join("");
      dailyTerminal.value=state.posDailyCloseTerminal||"all";
    }

    const dailyDate=$("udv2PosDailyCloseDate");
    if(dailyDate && !dailyDate.value){
      const d=new Date();
      dailyDate.value=`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`;
    }
  }

  function renderEmployeeReport(){
    const container=$("udv2PosEmployeeReportRows");
    if(!container)return;
    const rows=state.posEmployeeReportRows||[];
    $("udv2PosEmployeeReportCount").textContent=`${rows.length} empleados`;

    if(!rows.length){
      container.innerHTML='<div class="udv2-empty">No hay datos con esos filtros.</div>';
      return;
    }

    container.innerHTML=rows.map(row=>`
      <article class="udv2-employee-report-card">
        <div class="udv2-employee-report-head">
          <div>
            <strong>#${escapeHtml(row.employee_number||"—")} · ${escapeHtml(row.employee_name||"Empleado")}</strong>
            <small>${escapeHtml(row.role||"")}</small>
          </div>
          <strong>${escapeHtml(money(Number(row.gross_sales||0)))}</strong>
        </div>

        <div class="udv2-report-metrics">
          <div class="udv2-report-metric"><span>Tickets</span><strong>${escapeHtml(String(row.tickets||0))}</strong></div>
          <div class="udv2-report-metric"><span>Ticket promedio</span><strong>${escapeHtml(money(Number(row.ticket_average||0)))}</strong></div>
          <div class="udv2-report-metric"><span>Efectivo</span><strong>${escapeHtml(money(Number(row.cash_sales||0)))}</strong></div>
          <div class="udv2-report-metric"><span>Terminal</span><strong>${escapeHtml(money(Number(row.card_sales||0)))}</strong></div>

          <div class="udv2-report-metric"><span>Transferencias</span><strong>${escapeHtml(money(Number(row.transfer_sales||0)))}</strong></div>
          <div class="udv2-report-metric"><span>Otros</span><strong>${escapeHtml(money(Number(row.other_sales||0)))}</strong></div>
          <div class="udv2-report-metric danger"><span>Anulaciones</span><strong>${escapeHtml(String(row.voided_count||0))}</strong></div>
          <div class="udv2-report-metric danger"><span>Devoluciones</span><strong>${escapeHtml(`${row.refunds_count||0} · ${money(Number(row.refunds_total||0))}`)}</strong></div>

          <div class="udv2-report-metric"><span>Entradas caja</span><strong>${escapeHtml(money(Number(row.cash_in||0)))}</strong></div>
          <div class="udv2-report-metric"><span>Salidas caja</span><strong>${escapeHtml(money(Number(row.cash_out||0)))}</strong></div>
          <div class="udv2-report-metric ${Number(row.closing_difference||0)!==0?"danger":""}"><span>Diferencia cierres</span><strong>${escapeHtml(money(Number(row.closing_difference||0)))}</strong></div>
          <div class="udv2-report-metric"><span>Turnos</span><strong>${escapeHtml(String(row.shifts_count||0))}</strong></div>
        </div>
      </article>
    `).join("");
  }

  async function loadEmployeeReport(){
    try{
      const db=await getDb();
      const from=$("udv2PosEmployeeReportFrom")?.value||"";
      const to=$("udv2PosEmployeeReportTo")?.value||"";

      const {data,error}=await db.rpc("admin_pos_employee_report",{
        p_from:from?new Date(`${from}T00:00:00`).toISOString():null,
        p_to:to?new Date(`${to}T23:59:59.999`).toISOString():null,
        p_employee_id:(state.posEmployeeReportEmployee&&state.posEmployeeReportEmployee!=="all")?state.posEmployeeReportEmployee:null,
        p_terminal_id:(state.posEmployeeReportTerminal&&state.posEmployeeReportTerminal!=="all")?state.posEmployeeReportTerminal:null,
        p_limit:500
      });
      if(error)throw error;
      state.posEmployeeReportRows=Array.isArray(data?.rows)?data.rows:[];
      renderEmployeeReport();
    }catch(error){
      console.error("POS employee report",error);
      if($("udv2PosEmployeeReportRows"))$("udv2PosEmployeeReportRows").innerHTML=`<div class="udv2-empty">No se pudo cargar el reporte.<br>${escapeHtml(error.message||"Error")}</div>`;
      toast(error.message||"No se pudo cargar el reporte por empleado.",true);
    }
  }

  function localDateInputValue(date=new Date()){
    return `${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,"0")}-${String(date.getDate()).padStart(2,"0")}`;
  }

  function renderPosDashboard(){
    const cards=$("udv2PosDashboardCards");
    if(!cards)return;

    const r=state.posDashboardReport;
    const input=$("udv2PosDashboardDateInput");

    if(input && state.posDashboardDate && input.value!==state.posDashboardDate){
      input.value=state.posDashboardDate;
    }

    if(!r){
      cards.innerHTML='<div class="udv2-empty">No hay datos disponibles para esta fecha.</div>';
      return;
    }

    const tickets=Number(r.tickets||0);
    const gross=Number(r.gross_sales||0);
    const avg=tickets>0?gross/tickets:0;

    const data=[
      ["Ventas",money(gross),`${tickets} ticket${tickets===1?"":"s"}`,""],
      ["Tickets",String(tickets),"Ventas completadas / devueltas",""],
      ["Ticket promedio",money(avg),"Promedio por operación",""],
      ["Efectivo",money(Number(r.cash_sales||0)),"Pagos en efectivo",""],
      ["Terminal",money(Number(r.card_sales||0)),"Pagos por terminal",""],
      ["Transferencias",money(Number(r.transfer_sales||0)),"Transferencias",""],
      ["Otros",money(Number(r.other_sales||0)),"Otros métodos",""],
      ["Anulaciones",String(r.voided_count||0),"Ventas anuladas","danger"],
      ["Devoluciones",`${r.refunded_count||0} · ${money(Number(r.refunds_total||0))}`,"Operaciones devueltas","danger"],
      ["Turnos abiertos",String(r.open_shifts||0),"En esa fecha","gold"],
      ["Turnos cerrados",String(r.closed_shifts||0),"En esa fecha",""],
      ["Diferencia del día",money(Number(r.difference_total||0)),"Suma de diferencias de cierre",Number(r.difference_total||0)!==0?"danger":""]
    ];

    cards.innerHTML=data.map(([label,value,sub,cls])=>`
      <div class="udv2-dashboard-card ${cls}">
        <span>${escapeHtml(label)}</span>
        <strong>${escapeHtml(value)}</strong>
        <small>${escapeHtml(sub)}</small>
      </div>
    `).join("");
  }

  async function loadPosDashboard(){
    try{
      const db=await getDb();

      if(!state.posDashboardDate){
        state.posDashboardDate=localDateInputValue(new Date());
      }

      const input=$("udv2PosDashboardDateInput");
      if(input && !input.value){
        input.value=state.posDashboardDate;
      }

      const {data,error}=await db.rpc("admin_pos_daily_close_report",{
        p_date:state.posDashboardDate,
        p_terminal_id:null
      });

      if(error)throw error;

      state.posDashboardReport=data?.report||null;
      renderPosDashboard();
    }catch(error){
      console.error("POS dashboard",error);
      if($("udv2PosDashboardCards")){
        $("udv2PosDashboardCards").innerHTML=`<div class="udv2-empty">No se pudo cargar el Dashboard.<br>${escapeHtml(error.message||"Error")}</div>`;
      }
      toast(error.message||"No se pudo cargar el Dashboard.",true);
    }
  }

  function renderDailyClose(){
    const body=$("udv2PosDailyCloseBody");
    if(!body)return;
    const r=state.posDailyCloseReport;
    if(!r){
      body.innerHTML='<div class="udv2-empty">Sin datos.</div>';
      return;
    }

    const metrics=[
      ["Ventas",r.tickets||0,""],
      ["Monto vendido",money(Number(r.gross_sales||0)),""],
      ["Efectivo",money(Number(r.cash_sales||0)),""],
      ["Terminal",money(Number(r.card_sales||0)),""],
      ["Transferencias",money(Number(r.transfer_sales||0)),""],
      ["Otros",money(Number(r.other_sales||0)),""],
      ["Anulaciones",r.voided_count||0,"danger"],
      ["Devoluciones",`${r.refunded_count||0} · ${money(Number(r.refunds_total||0))}`,"danger"],
      ["Entradas caja",money(Number(r.cash_in||0)),""],
      ["Salidas caja",money(Number(r.cash_out||0)),""],
      ["Fondo inicial",money(Number(r.opening_cash_total||0)),""],
      ["Efectivo esperado",money(Number(r.expected_cash_total||0)),""],
      ["Efectivo contado",money(Number(r.closing_cash_total||0)),""],
      ["Diferencia",money(Number(r.difference_total||0)),Number(r.difference_total||0)!==0?"danger":""],
      ["Turnos abiertos",r.open_shifts||0,""],
      ["Turnos cerrados",r.closed_shifts||0,""]
    ];

    body.innerHTML=`
      <div class="udv2-daily-close-grid">
        ${metrics.map(([label,value,cls])=>`
          <div class="udv2-report-metric ${cls}">
            <span>${escapeHtml(label)}</span>
            <strong>${escapeHtml(value)}</strong>
          </div>
        `).join("")}
      </div>

      <div class="udv2-daily-close-shifts">
        <h3>Turnos del día</h3>
        ${(r.shifts||[]).length?`
          <div class="udv2-daily-close-shift udv2-daily-close-shift-head">
            <div>Empleado</div>
            <div>Terminal</div>
            <div>Apertura</div>
            <div>Cierre</div>
            <div>Efectivo contado</div>
            <div>Diferencia</div>
          </div>
          ${(r.shifts||[]).map(sh=>`
          <div class="udv2-daily-close-shift">
            <div><strong>#${escapeHtml(sh.employee_number||"—")} · ${escapeHtml(sh.employee_name||"Empleado")}</strong></div>
            <div>${escapeHtml(sh.terminal_name||"—")}</div>
            <div>${escapeHtml(dateTime(sh.opened_at))}</div>
            <div>${sh.closed_at?escapeHtml(dateTime(sh.closed_at)):"Abierto"}</div>
            <div>${sh.closing_cash===null||sh.closing_cash===undefined?"—":escapeHtml(money(Number(sh.closing_cash||0)))}</div>
            <div class="${Number(sh.difference||0)!==0?"danger":""}">${sh.difference===null||sh.difference===undefined?"—":escapeHtml(money(Number(sh.difference||0)))}</div>
          </div>
        `).join("")}`:'<div class="udv2-empty">No hay turnos en esta fecha.</div>'}
      </div>
    `;
  }

  async function loadDailyClose(){
    try{
      const db=await getDb();
      const date=$("udv2PosDailyCloseDate")?.value||"";
      if(!date)return;

      const {data,error}=await db.rpc("admin_pos_daily_close_report",{
        p_date:date,
        p_terminal_id:(state.posDailyCloseTerminal&&state.posDailyCloseTerminal!=="all")?state.posDailyCloseTerminal:null
      });
      if(error)throw error;
      state.posDailyCloseReport=data?.report||null;
      renderDailyClose();
    }catch(error){
      console.error("POS daily close",error);
      if($("udv2PosDailyCloseBody"))$("udv2PosDailyCloseBody").innerHTML=`<div class="udv2-empty">No se pudo cargar el cierre.<br>${escapeHtml(error.message||"Error")}</div>`;
      toast(error.message||"No se pudo cargar el cierre diario.",true);
    }
  }

  function populateShiftFilters(){
    const employee=$("udv2PosShiftEmployee");
    const terminal=$("udv2PosShiftTerminal");

    if(employee){
      employee.innerHTML='<option value="all">Todos los empleados</option>'+state.posEmployees.map(x=>`<option value="${x.id}">#${escapeHtml(x.employee_number)} · ${escapeHtml(x.full_name)}</option>`).join("");
      employee.value=state.posShiftEmployee||"all";
    }

    if(terminal){
      terminal.innerHTML='<option value="all">Todas las terminales</option>'+state.posTerminals.map(x=>`<option value="${x.id}">${escapeHtml(x.name)}</option>`).join("");
      terminal.value=state.posShiftTerminal||"all";
    }

    if($("udv2PosShiftStatus"))$("udv2PosShiftStatus").value=state.posShiftStatus||"all";
  }

  function renderPosShifts(){
    const list=$("udv2PosShiftList");
    if(!list)return;

    const rows=state.posShiftRows||[];
    $("udv2PosShiftCount").textContent=`${rows.length} turnos`;

    if(!rows.length){
      list.innerHTML='<div class="udv2-empty">No hay turnos con esos filtros.</div>';
      return;
    }

    const groups=new Map();
    rows.forEach(row=>{
      const d=new Date(row.opened_at);
      const key=new Intl.DateTimeFormat("es-MX",{year:"numeric",month:"2-digit",day:"2-digit"}).format(d);
      const label=new Intl.DateTimeFormat("es-MX",{weekday:"long",year:"numeric",month:"long",day:"numeric"}).format(d);
      if(!groups.has(key))groups.set(key,{label,rows:[]});
      groups.get(key).rows.push(row);
    });

    const groupEntries=[...groups.entries()];

    list.innerHTML=groupEntries.map(([key,group],groupIndex)=>{
      const shiftCards=group.rows.map(row=>{
        const diff=Number(row.difference||0);
        const statusLabel=row.status==="open"?"ABIERTO":"CERRADO";
        return `
          <article class="udv2-shift-card">
            <div class="udv2-shift-head">
              <div>
                <strong>#${escapeHtml(row.employee_number||"—")} · ${escapeHtml(row.employee_name||"Empleado")}</strong>
                <small>${escapeHtml(row.employee_role||"")}</small>
              </div>
              <div>
                <strong>${escapeHtml(row.terminal_name||"—")}</strong>
                <small>Terminal</small>
              </div>
              <div>
                <strong>${escapeHtml(dateTime(row.opened_at))}</strong>
                <small>${row.closed_at?`Cierre: ${escapeHtml(dateTime(row.closed_at))}`:"Turno aún abierto"}</small>
              </div>
              <div>
                <span class="udv2-sale-status ${row.status==="open"?"completed":"voided"}">${statusLabel}</span>
              </div>
            </div>

            <div class="udv2-shift-body">
              <div class="udv2-shift-metric"><span>Fondo inicial</span><strong>${escapeHtml(money(Number(row.opening_cash||0)))}</strong></div>
              <div class="udv2-shift-metric"><span>Ventas efectivo</span><strong>${escapeHtml(money(Number(row.cash_sales||0)))}</strong></div>
              <div class="udv2-shift-metric"><span>Terminal</span><strong>${escapeHtml(money(Number(row.card_sales||0)))}</strong></div>
              <div class="udv2-shift-metric"><span>Transferencias</span><strong>${escapeHtml(money(Number(row.transfer_sales||0)))}</strong></div>

              <div class="udv2-shift-metric"><span>Otros pagos</span><strong>${escapeHtml(money(Number(row.other_sales||0)))}</strong></div>
              <div class="udv2-shift-metric"><span>Entradas caja</span><strong>${escapeHtml(money(Number(row.cash_in||0)))}</strong></div>
              <div class="udv2-shift-metric"><span>Salidas caja</span><strong>${escapeHtml(money(Number(row.cash_out||0)))}</strong></div>
              <div class="udv2-shift-metric"><span>Devoluciones efectivo</span><strong>${escapeHtml(money(Number(row.cash_refunds||0)))}</strong></div>

              <div class="udv2-shift-metric"><span>Efectivo esperado</span><strong>${row.expected_cash===null||row.expected_cash===undefined?"—":escapeHtml(money(Number(row.expected_cash||0)))}</strong></div>
              <div class="udv2-shift-metric"><span>Efectivo contado</span><strong>${row.closing_cash===null||row.closing_cash===undefined?"—":escapeHtml(money(Number(row.closing_cash||0)))}</strong></div>
              <div class="udv2-shift-metric ${diff!==0?"danger":""}"><span>Diferencia</span><strong>${row.difference===null||row.difference===undefined?"—":escapeHtml(money(diff))}</strong></div>
              <div class="udv2-shift-metric"><span>Operaciones</span><strong>${escapeHtml(`${row.sales_count||0} ventas · ${row.voided_count||0} anuladas · ${row.refunds_count||0} dev.`)}</strong></div>
            </div>

            ${row.notes?`<div class="udv2-shift-note"><strong>Notas:</strong> ${escapeHtml(row.notes)}</div>`:""}
          </article>
        `;
      }).join("");

      return `
        <section class="udv2-shift-date-group">
          <button type="button" class="udv2-shift-date-head" data-shift-date="${escapeHtml(key)}">
            <strong>${escapeHtml(group.label)}</strong>
            <span>${group.rows.length} turno${group.rows.length===1?"":"s"} ${groupIndex===0?"· abierto":"· ver"}</span>
          </button>
          <div class="udv2-shift-date-body ${groupIndex===0?"":"is-collapsed"}" data-shift-date-body="${escapeHtml(key)}">
            ${shiftCards}
          </div>
        </section>
      `;
    }).join("");

    list.querySelectorAll(".udv2-shift-date-head").forEach(btn=>{
      btn.addEventListener("click",()=>{
        const key=btn.getAttribute("data-shift-date");
        const body=list.querySelector(`[data-shift-date-body="${key}"]`);
        body?.classList.toggle("is-collapsed");
      });
    });
  }

  async function loadPosShifts(){
    try{
      const db=await getDb();
      const from=$("udv2PosShiftFrom")?.value||"";
      const to=$("udv2PosShiftTo")?.value||"";

      const {data,error}=await db.rpc("admin_pos_shift_report",{
        p_from:from?new Date(`${from}T00:00:00`).toISOString():null,
        p_to:to?new Date(`${to}T23:59:59.999`).toISOString():null,
        p_employee_id:(state.posShiftEmployee&&state.posShiftEmployee!=="all")?state.posShiftEmployee:null,
        p_terminal_id:(state.posShiftTerminal&&state.posShiftTerminal!=="all")?state.posShiftTerminal:null,
        p_status:(state.posShiftStatus&&state.posShiftStatus!=="all")?state.posShiftStatus:null,
        p_limit:500
      });

      if(error)throw error;

      state.posShiftRows=Array.isArray(data?.shifts)?data.shifts:[];
      renderPosShifts();
    }catch(error){
      console.error("POS shifts load",error);
      if($("udv2PosShiftList"))$("udv2PosShiftList").innerHTML=`<div class="udv2-empty">No se pudieron cargar los turnos.<br>${escapeHtml(error.message||"Error")}</div>`;
      toast(error.message||"No se pudieron cargar los turnos.",true);
    }
  }

  function paymentMethodLabel(value){
    const map={
      cash:"Efectivo",
      card_terminal:"Terminal",
      transfer:"Transferencia",
      other:"Otro"
    };
    return String(value||"").split(" + ").map(x=>map[x]||x).join(" + ");
  }

  function populatePosSummaryFilters(){
    const employee=$("udv2PosSummaryEmployee");
    const terminal=$("udv2PosSummaryTerminal");

    if(employee){
      employee.innerHTML='<option value="all">Todos los empleados</option>'+state.posEmployees.map(x=>`<option value="${x.id}">#${escapeHtml(x.employee_number)} · ${escapeHtml(x.full_name)}</option>`).join("");
      employee.value=state.posSummaryEmployee||"all";
    }

    if(terminal){
      terminal.innerHTML='<option value="all">Todas las terminales</option>'+state.posTerminals.map(x=>`<option value="${x.id}">${escapeHtml(x.name)}</option>`).join("");
      terminal.value=state.posSummaryTerminal||"all";
    }

    if($("udv2PosSummaryStatus"))$("udv2PosSummaryStatus").value=state.posSummaryStatus||"all";
    if($("udv2PosSummaryPayment"))$("udv2PosSummaryPayment").value=state.posSummaryPayment||"all";
  }

  function renderPosSummary(){
    const cards=$("udv2PosSummaryCards");
    const sales=$("udv2PosSummarySales");
    if(!cards||!sales)return;

    const m=state.posSummaryMetrics||{};
    const cardData=[
      ["Ventas",m.sales_count??0,""],
      ["Monto vendido",money(Number(m.gross_sales||0)),""],
      ["Efectivo",money(Number(m.cash_payments||0)),""],
      ["Terminal",money(Number(m.card_terminal_payments||0)),""],
      ["Transferencias",money(Number(m.transfer_payments||0)),""],
      ["Otros",money(Number(m.other_payments||0)),""],
      ["Anulaciones",m.voided_sales??0,"danger"],
      ["Devoluciones",`${m.refunded_sales??0} · ${money(Number(m.refunds_total||0))}`,"danger"],
      ["Entradas caja",money(Number(m.cash_in||0)),"gold"],
      ["Salidas caja",money(Number(m.cash_out||0)),"gold"],
      ["Turnos abiertos",m.open_shifts??0,""],
      ["Diferencia cierres",money(Number(m.closing_difference_total||0)),Number(m.closing_difference_total||0)!==0?"danger":""]
    ];

    cards.innerHTML=cardData.map(([label,value,cls])=>`
      <div class="udv2-summary-card ${cls}">
        <span>${escapeHtml(label)}</span>
        <strong>${escapeHtml(value)}</strong>
      </div>
    `).join("");

    const rows=state.posSummarySales||[];
    $("udv2PosSummaryCount").textContent=`${rows.length} ventas`;

    if(!rows.length){
      sales.innerHTML='<div class="udv2-empty">No hay ventas con esos filtros.</div>';
      return;
    }

    sales.innerHTML=rows.map(row=>`
      <div class="udv2-sales-row">
        <div>
          <strong>#${escapeHtml(row.sale_number)}</strong>
          <small>${escapeHtml(String(row.shift_id||"").slice(0,8))}</small>
          <button type="button" class="udv2-sale-detail-btn" data-sale-detail="${escapeHtml(row.id)}">Ver detalle</button>
        </div>
        <div><strong>${escapeHtml(dateTime(row.created_at))}</strong></div>
        <div><strong>${escapeHtml(row.employee_number?`#${row.employee_number} · ${row.employee_name||""}`:(row.employee_name||"—"))}</strong><small>${escapeHtml(row.employee_role||"")}</small></div>
        <div><strong>${escapeHtml(row.terminal_name||"—")}</strong></div>
        <div><strong>${escapeHtml(paymentMethodLabel(row.payment_methods||""))}</strong></div>
        <div><span class="udv2-sale-status ${escapeHtml(row.status||"")}">${escapeHtml(row.status||"—")}</span></div>
        <div><strong>${escapeHtml(money(Number(row.total||0)))}</strong></div>
      </div>
    `).join("");

    sales.querySelectorAll("[data-sale-detail]").forEach(btn=>{
      btn.addEventListener("click",()=>{
        openSaleDetail(String(btn.getAttribute("data-sale-detail")||""));
      });
    });
  }

  async function loadPosSummary(){
    try{
      const db=await getDb();

      const from=$("udv2PosSummaryFrom")?.value||"";
      const to=$("udv2PosSummaryTo")?.value||"";

      const {data,error}=await db.rpc("admin_pos_sales_summary",{
        p_from:from?new Date(`${from}T00:00:00`).toISOString():null,
        p_to:to?new Date(`${to}T23:59:59.999`).toISOString():null,
        p_employee_id:(state.posSummaryEmployee&&state.posSummaryEmployee!=="all")?state.posSummaryEmployee:null,
        p_terminal_id:(state.posSummaryTerminal&&state.posSummaryTerminal!=="all")?state.posSummaryTerminal:null,
        p_status:(state.posSummaryStatus&&state.posSummaryStatus!=="all")?state.posSummaryStatus:null,
        p_payment_method:(state.posSummaryPayment&&state.posSummaryPayment!=="all")?state.posSummaryPayment:null,
        p_limit:500
      });

      if(error)throw error;

      state.posSummaryMetrics=data?.metrics||{};
      state.posSummarySales=Array.isArray(data?.sales)?data.sales:[];
      renderPosSummary();
    }catch(error){
      console.error("POS summary load",error);
      if($("udv2PosSummaryCards"))$("udv2PosSummaryCards").innerHTML=`<div class="udv2-empty">No se pudo cargar el resumen.<br>${escapeHtml(error.message||"Error")}</div>`;
      if($("udv2PosSummarySales"))$("udv2PosSummarySales").innerHTML='<div class="udv2-empty">Sin datos.</div>';
      toast(error.message||"No se pudo cargar el resumen.",true);
    }
  }

  function auditTypeLabel(type){
    const labels={
      sale_completed:"Venta completada",
      payment_recorded:"Pago registrado",
      inventory_deducted:"Inventario descontado",
      sale_voided:"Venta anulada",
      inventory_restored:"Inventario repuesto",
      sale_refunded:"Venta devuelta",
      refund_recorded:"Devolución registrada",
      refund_document:"Documento de devolución",
      cash_in:"Entrada de efectivo",
      cash_out:"Salida de efectivo",
      shift_opened:"Turno abierto",
      shift_closed:"Turno cerrado",
      employee_login:"Inicio de sesión",
      access_validated:"Acceso validado",
      terminal_activated:"Terminal activada",
      terminal_reauthorization_requested:"Reautorización solicitada"
    };
    return labels[type]||String(type||"Evento").replaceAll("_"," ");
  }

  function auditTypeClass(type){
    if(["sale_voided","sale_refunded","refund_recorded","refund_document","inventory_restored"].includes(type))return "danger";
    if(["cash_in","cash_out","payment_recorded"].includes(type))return "cash";
    return "";
  }

  function populateAuditFilters(){
    const employee=$("udv2PosAuditEmployee");
    const terminal=$("udv2PosAuditTerminal");
    const typeSelect=$("udv2PosAuditType");
    if(typeSelect){
      const desired=state.posAuditType||"operation";
      typeSelect.value=[...typeSelect.options].some(x=>x.value===desired)?desired:"operation";
    }
    if(employee){
      const current=state.posAuditEmployee||"all";
      employee.innerHTML='<option value="all">Todos los empleados</option>'+state.posEmployees.map(x=>`<option value="${x.id}">#${escapeHtml(x.employee_number)} · ${escapeHtml(x.full_name)}</option>`).join("");
      employee.value=[...employee.options].some(x=>x.value===current)?current:"all";
    }
    if(terminal){
      const current=state.posAuditTerminal||"all";
      terminal.innerHTML='<option value="all">Todas las terminales</option>'+state.posTerminals.map(x=>`<option value="${x.id}">${escapeHtml(x.name)}</option>`).join("");
      terminal.value=[...terminal.options].some(x=>x.value===current)?current:"all";
    }
  }

  function renderPosAudit(){
    const list=$("udv2PosAuditList");
    if(!list)return;

    const search=String(state.posAuditSearch||"").toLowerCase();
    const type=state.posAuditType||"all";
    const employee=state.posAuditEmployee||"all";
    const terminal=state.posAuditTerminal||"all";

    const rows=(state.posAuditEvents||[]).filter(event=>{
      // El tipo, empleado y terminal ya se filtran en SQL antes del LIMIT.
      // Aquí solo mantenemos la búsqueda de texto local.
      if(!search)return true;
      const hay=[
        event.event_type,event.employee_number,event.employee_name,event.employee_role,
        event.terminal_name,event.sale_number,event.sale_status,event.sale_total,
        event.amount,event.reason,JSON.stringify(event.details||{})
      ].filter(x=>x!==null&&x!==undefined).join(" ").toLowerCase();
      return hay.includes(search);
    });

    $("udv2PosAuditCount").textContent=`${rows.length} eventos`;

    if(!rows.length){
      list.innerHTML='<div class="udv2-empty">No hay eventos con esos filtros.</div>';
      return;
    }

    list.innerHTML=rows.map(event=>{
      const sale=event.sale_number?`Venta #${escapeHtml(event.sale_number)}`:"";
      const employeeName=event.employee_name?`${event.employee_number?`#${escapeHtml(event.employee_number)} · `:""}${escapeHtml(event.employee_name)}`:"Sistema";
      const terminalName=event.terminal_name?escapeHtml(event.terminal_name):"—";
      const amount=event.amount!==null&&event.amount!==undefined?Number(event.amount):event.sale_total!==null&&event.sale_total!==undefined?Number(event.sale_total):null;
      const details=event.details&&Object.keys(event.details).length?escapeHtml(JSON.stringify(event.details)):"";
      return `
        <article class="udv2-audit-row">
          <div>
            <strong>${escapeHtml(dateTime(event.created_at))}</strong>
            <small>${terminalName}</small>
          </div>
          <div>
            <span class="udv2-audit-type ${auditTypeClass(event.event_type)}">${escapeHtml(auditTypeLabel(event.event_type))}</span>
            ${sale?`<small>${sale}${event.sale_status?` · ${escapeHtml(event.sale_status)}`:""}</small>`:""}
          </div>
          <div>
            <strong>${employeeName}</strong>
            <small>${escapeHtml(event.employee_role||event.source||"")}</small>
            ${event.reason?`<div class="udv2-audit-reason">${escapeHtml(event.reason)}</div>`:""}
            ${details?`<div class="udv2-audit-details">${details}</div>`:""}
          </div>
          <div>
            <small>${event.shift_id?`Turno ${escapeHtml(String(event.shift_id).slice(0,8))}`:""}</small>
          </div>
          <div class="udv2-audit-amount">${amount!==null&&Number.isFinite(amount)?escapeHtml(money(amount)):"—"}</div>
        </article>
      `;
    }).join("");
  }

  async function loadPosAudit(){
    const list=$("udv2PosAuditList");
    if(list)list.innerHTML='<div class="udv2-empty">Cargando bitácora…</div>';
    try{
      const db=await getDb();
      const from=$("udv2PosAuditFrom")?.value||"";
      const to=$("udv2PosAuditTo")?.value||"";
      const pFrom=from?new Date(`${from}T00:00:00`).toISOString():null;
      const pTo=to?new Date(`${to}T23:59:59.999`).toISOString():null;

      const {data,error}=await db.rpc("admin_pos_audit_feed",{
        p_limit:500,
        p_event_type:state.posAuditType==="all"?null:state.posAuditType,
        p_employee_id:state.posAuditEmployee==="all"?null:state.posAuditEmployee,
        p_terminal_id:state.posAuditTerminal==="all"?null:state.posAuditTerminal,
        p_from:pFrom,
        p_to:pTo
      });
      if(error)throw error;

      state.posAuditEvents=Array.isArray(data?.events)?data.events:[];
      populateAuditFilters();
      renderPosAudit();
    }catch(error){
      console.error("POS audit load",error);
      if(list)list.innerHTML=`<div class="udv2-empty">No se pudo cargar la bitácora.<br>${escapeHtml(error.message||"Error")}</div>`;
      toast(error.message||"No se pudo cargar la bitácora.",true);
    }
  }

  async function loadPosAdmin(){
    try{
      await verifyAdmin();
      const db=await getDb();
      const [employees,terminals,shifts]=await Promise.all([
        db.from("pos_employees").select("id,auth_user_id,employee_number,full_name,role,status,created_at,last_login_at,suspended_at,terminated_at").order("created_at",{ascending:false}),
        db.from("pos_terminals").select("id,name,status,activated_at,last_seen_at,created_at").order("created_at",{ascending:false}),
        db.from("pos_shifts").select("id,status,employee_id,terminal_id,opened_at,closed_at").eq("status","open")
      ]);
      if(employees.error)throw employees.error;
      if(terminals.error)throw terminals.error;
      if(shifts.error)throw shifts.error;
      state.posEmployees=employees.data||[];
      state.posTerminals=terminals.data||[];
      state.posShifts=shifts.data||[];
      $("udv2PosOpenShifts").textContent=String(state.posShifts.length);
      renderPosEmployees();
      renderPosTerminals();
      populateAuditFilters();
      populatePosSummaryFilters();
      populateShiftFilters();
      populateEmployeeReportFilters();
      bindPosAdminTabs();
      await Promise.all([loadPosAudit(),loadPosSummary(),loadPosShifts(),loadPosInventory(),loadEmployeeReport(),loadDailyClose(),loadPosDashboard()]);
    }catch(error){
      console.error("POS admin load",error);
      $("udv2PosEmployeeList").innerHTML=`<div class="udv2-empty">No se pudo cargar POS.<br>${escapeHtml(error.message||"Error")}</div>`;
      toast(error.message||"No se pudo cargar POS.",true);
    }
  }

  async function createPosEmployee(event){
    event.preventDefault();
    const form=event.currentTarget;
    const submit=q('button[type="submit"]',form);
    submit.disabled=true;
    submit.textContent="Creando…";
    try{
      const employee_number=String($("udv2PosEmployeeNumber").value||"").replace(/\D/g,"").slice(0,8);
      const full_name=$("udv2PosEmployeeName").value.trim();
      const role=$("udv2PosEmployeeRole").value;
      const password=$("udv2PosEmployeePassword").value;
      if(employee_number.length<3)throw new Error("Usa un número de empleado de al menos 3 dígitos.");
      if(!full_name)throw new Error("Escribe el nombre.");
      if(password.length<8)throw new Error("La contraseña debe tener al menos 8 caracteres.");

      await posAdminApi({action:"create",employee_number,full_name,role,password});
      form.reset();
      toast("Empleado POS creado.");
      await loadPosAdmin();
    }catch(error){toast(error.message,true)}
    finally{submit.disabled=false;submit.textContent="Crear empleado"}
  }

  async function createPosTerminal(event){
    event.preventDefault();
    const form=event.currentTarget;
    const name=$("udv2PosTerminalName").value.trim();
    if(!name)return;
    try{
      const db=await getDb();
      const {data,error}=await db.rpc("admin_pos_create_terminal",{p_name:name});
      if(error)throw error;
      const row=Array.isArray(data)?data[0]:data;
      $("udv2PosTerminalCode").innerHTML=`<div class="udv2-pos-code"><span>Código de activación · válido 20 minutos</span><strong>${escapeHtml(row.activation_code)}</strong></div>`;
      form.reset();
      toast("Código de terminal creado.");
      await loadPosAdmin();
    }catch(error){toast(error.message,true)}
  }

  async function generatePosPin(){
    const pin=String(Math.floor(100000+Math.random()*900000));
    const expires=new Date();
    expires.setHours(23,59,59,999);
    try{
      const db=await getDb();
      const {error}=await db.rpc("admin_pos_set_shift_pin",{p_pin:pin,p_expires_at:expires.toISOString()});
      if(error)throw error;
      $("udv2PosPinResult").innerHTML=`<div class="udv2-pos-code"><span>PIN de apertura de hoy</span><strong>${pin}</strong></div>`;
      toast("PIN de apertura actualizado.");
    }catch(error){toast(error.message,true)}
  }


  function bindShell(){
    $("udv2ContentRefresh")?.addEventListener("click",loadContent);
    $("udv2SellerRefresh")?.addEventListener("click",loadSellers);

    qa("[data-content-type]",$("udv2ContentView")).forEach(btn=>{
      btn.addEventListener("click",()=>{
        state.contentType=btn.dataset.contentType;
        qa("[data-content-type]",$("udv2ContentView")).forEach(x=>x.classList.toggle("is-active",x===btn));
        renderContentSection();
      });
    });

    $("udv2SellerCode")?.addEventListener("input",e=>e.target.value=normalizeCode(e.target.value));
    $("udv2SellerName")?.addEventListener("blur",()=>{
      if($("udv2SellerCode").value.trim()) return;
      const base=normalizeCode($("udv2SellerName").value).replace(/[^A-Z0-9]/g,"").slice(0,6);
      if(base) $("udv2SellerCode").value=`${base}001`;
    });
    $("udv2SellerForm")?.addEventListener("submit",createSeller);

    $("udv2LessonRefresh")?.addEventListener("click",loadLessons);
    $("udv2LessonSearch")?.addEventListener("input",event=>{
      state.lessonSearch=String(event.target.value||"").trim().toLowerCase();
      renderLessons();
    });
    $("udv2LessonFilter")?.addEventListener("change",event=>{
      state.lessonFilter=String(event.target.value||"all");
      renderLessons();
    });
    $("udv2LessonInstructorFilter")?.addEventListener("change",event=>{
      state.lessonInstructorFilter=String(event.target.value||"all");
      renderLessons();
    });

    $("udv2PosRefresh")?.addEventListener("click",loadPosAdmin);
    $("udv2PosEmployeeForm")?.addEventListener("submit",createPosEmployee);
    $("udv2PosTerminalForm")?.addEventListener("submit",createPosTerminal);
    $("udv2PosGeneratePin")?.addEventListener("click",generatePosPin);
    qa("[data-force-close-cancel]").forEach(button=>{
      button.addEventListener("click",closeForceCloseModal);
    });

    $("udv2ForceCloseConfirm")?.addEventListener("click",confirmForceClose);

    $("udv2ForceCloseViewShift")?.addEventListener("click",()=>{
      const employeeId=state.posForceCloseEmployeeId;
      if(!employeeId)return;
      state.posShiftEmployee=employeeId;
      setPosAdminSection("shifts");
      populateShiftFilters();
      const select=$("udv2PosShiftEmployee");
      if(select)select.value=employeeId;
      loadPosShifts();
      closeForceCloseModal();
    });

    $("udv2PosEmployeeSearch")?.addEventListener("input",event=>{
      state.posEmployeeSearch=String(event.target.value||"").trim().toLowerCase();
      renderPosEmployees();
    });
    $("udv2PosEmployeeFilter")?.addEventListener("change",event=>{
      state.posEmployeeFilter=String(event.target.value||"all");
      renderPosEmployees();
    });
    $("udv2PosDashboardDateInput")?.addEventListener("change",event=>{
      const value=String(event.target.value||"");
      if(!value)return;
      state.posDashboardDate=value;
      loadPosDashboard();
    });

    $("udv2PosDashboardToday")?.addEventListener("click",()=>{
      state.posDashboardDate=localDateInputValue(new Date());
      const input=$("udv2PosDashboardDateInput");
      if(input)input.value=state.posDashboardDate;
      loadPosDashboard();
    });

    document.querySelectorAll("#updown-admin [data-pos-goto]").forEach(btn=>{
      btn.addEventListener("click",()=>{
        setPosAdminSection(String(btn.getAttribute("data-pos-goto")||"dashboard"));
      });
    });

    $("udv2PosEmployeeReportEmployee")?.addEventListener("change",event=>{
      state.posEmployeeReportEmployee=String(event.target.value||"all");
      loadEmployeeReport();
    });
    $("udv2PosEmployeeReportTerminal")?.addEventListener("change",event=>{
      state.posEmployeeReportTerminal=String(event.target.value||"all");
      loadEmployeeReport();
    });
    $("udv2PosEmployeeReportFrom")?.addEventListener("change",loadEmployeeReport);
    $("udv2PosEmployeeReportTo")?.addEventListener("change",loadEmployeeReport);

    $("udv2PosDailyCloseDate")?.addEventListener("change",loadDailyClose);
    $("udv2PosDailyCloseTerminal")?.addEventListener("change",event=>{
      state.posDailyCloseTerminal=String(event.target.value||"all");
      loadDailyClose();
    });

    $("udv2PosInventoryProduct")?.addEventListener("change",event=>{
      state.posInventoryProduct=String(event.target.value||"all");
      loadPosInventory();
    });
    $("udv2PosInventoryMovement")?.addEventListener("change",event=>{
      state.posInventoryMovement=String(event.target.value||"all");
      loadPosInventory();
    });
    $("udv2PosInventoryFrom")?.addEventListener("change",loadPosInventory);
    $("udv2PosInventoryTo")?.addEventListener("change",loadPosInventory);
    $("udv2PosInventorySearch")?.addEventListener("input",()=>{
      clearTimeout(state.__posInventorySearchTimer);
      state.__posInventorySearchTimer=setTimeout(loadPosInventory,250);
    });

    document.querySelectorAll("#updown-admin [data-sale-detail-close]").forEach(el=>{
      el.addEventListener("click",closeSaleDetail);
    });

    $("udv2PosShiftEmployee")?.addEventListener("change",event=>{
      state.posShiftEmployee=String(event.target.value||"all");
      loadPosShifts();
    });
    $("udv2PosShiftTerminal")?.addEventListener("change",event=>{
      state.posShiftTerminal=String(event.target.value||"all");
      loadPosShifts();
    });
    $("udv2PosShiftStatus")?.addEventListener("change",event=>{
      state.posShiftStatus=String(event.target.value||"all");
      loadPosShifts();
    });
    $("udv2PosShiftFrom")?.addEventListener("change",loadPosShifts);
    $("udv2PosShiftTo")?.addEventListener("change",loadPosShifts);

    $("udv2PosSummaryEmployee")?.addEventListener("change",event=>{
      state.posSummaryEmployee=String(event.target.value||"all");
      loadPosSummary();
    });
    $("udv2PosSummaryTerminal")?.addEventListener("change",event=>{
      state.posSummaryTerminal=String(event.target.value||"all");
      loadPosSummary();
    });
    $("udv2PosSummaryStatus")?.addEventListener("change",event=>{
      state.posSummaryStatus=String(event.target.value||"all");
      loadPosSummary();
    });
    $("udv2PosSummaryPayment")?.addEventListener("change",event=>{
      state.posSummaryPayment=String(event.target.value||"all");
      loadPosSummary();
    });
    $("udv2PosSummaryFrom")?.addEventListener("change",loadPosSummary);
    $("udv2PosSummaryTo")?.addEventListener("change",loadPosSummary);

    $("udv2PosAuditSearch")?.addEventListener("input",event=>{
      state.posAuditSearch=String(event.target.value||"").trim().toLowerCase();
      renderPosAudit();
    });
    $("udv2PosAuditType")?.addEventListener("change",event=>{
      state.posAuditType=String(event.target.value||"all");
      renderPosAudit();
    });
    $("udv2PosAuditEmployee")?.addEventListener("change",event=>{
      state.posAuditEmployee=String(event.target.value||"all");
      renderPosAudit();
    });
    $("udv2PosAuditTerminal")?.addEventListener("change",event=>{
      state.posAuditTerminal=String(event.target.value||"all");
      renderPosAudit();
    });
    $("udv2PosAuditFrom")?.addEventListener("change",loadPosAudit);
    $("udv2PosAuditTo")?.addEventListener("change",loadPosAudit);

    $("udv2CommissionSearch")?.addEventListener("input",event=>{
      state.commissionSearch=String(event.target.value||"").trim().toLowerCase();
      renderCommissions();
    });
    $("udv2CommissionFilter")?.addEventListener("change",event=>{
      state.commissionFilter=String(event.target.value||"all");
      renderCommissions();
    });
  }

  async function uploadImage(file,folder,slug){
    if(!file) return null;
    if(file.size>10*1024*1024) throw new Error("La imagen supera 10 MB.");
    if(!["image/jpeg","image/png","image/webp","image/avif"].includes(file.type)) throw new Error("Usa JPG, PNG, WebP o AVIF.");
    const db=await getDb();
    const ext=(file.name.split(".").pop()||"jpg").toLowerCase().replace(/[^a-z0-9]/g,"");
    const path=`${folder}/${slug||"item"}/${Date.now()}-${crypto.randomUUID()}.${ext}`;
    const {error}=await db.storage.from(CONFIG.bucket).upload(path,file,{cacheControl:"3600",upsert:false,contentType:file.type});
    if(error) throw error;
    const {data}=db.storage.from(CONFIG.bucket).getPublicUrl(path);
    return data.publicUrl;
  }

  async function loadContent(){
    try{
      await verifyAdmin();
      const db=await getDb();

      // Load each source independently. A failure in Journal must never make
      // Courses and Instructors appear as "0", and vice versa.
      const [coursesResult,instructorsResult,articlesResult]=await Promise.all([
        db.from("golf_courses").select("*"),
        db.from("golf_instructors").select("*"),
        db.from("journal_articles").select("*")
      ]);

      const sortByOrder=(rows=[])=>[...rows].sort((a,b)=>{
        const ao=Number(a.sort_order||0),bo=Number(b.sort_order||0);
        if(ao!==bo)return ao-bo;
        return String(a.created_at||"").localeCompare(String(b.created_at||""));
      });

      if(coursesResult.error){
        console.error("golf_courses admin load",coursesResult.error);
        toast(`Campos: ${coursesResult.error.message}`,true);
      }else{
        state.courses=sortByOrder(coursesResult.data||[]);
      }

      if(instructorsResult.error){
        console.error("golf_instructors admin load",instructorsResult.error);
        toast(`Profesores: ${instructorsResult.error.message}`,true);
      }else{
        state.instructors=sortByOrder(instructorsResult.data||[]);
      }

      if(articlesResult.error){
        console.error("journal_articles admin load",articlesResult.error);
        toast(`Journal: ${articlesResult.error.message}`,true);
      }else{
        state.articles=[...(articlesResult.data||[])].sort((a,b)=>{
          const ao=Number(a.sort_order||0),bo=Number(b.sort_order||0);
          if(ao!==bo)return ao-bo;
          return String(b.published_at||b.created_at||"").localeCompare(String(a.published_at||a.created_at||""));
        });
      }

      renderContentSection();
    }catch(e){
      console.error("Managed admin content load",e);
      toast(e.message||"No se pudo cargar contenido.",true);
      renderContentSection();
    }
  }

  function renderContentSection(){
    const body=$("udv2ContentBody");
    if(!body) return;
    if(state.contentType==="courses") body.innerHTML=courseSectionHtml();
    if(state.contentType==="instructors") body.innerHTML=instructorSectionHtml();
    if(state.contentType==="articles") body.innerHTML=articleSectionHtml();
    bindContentSection();
  }

  function courseSectionHtml(){
    const edit=state.courses.find(x=>x.id===state.editing.courses)||{};
    return `
<div class="udv2-grid">
<section class="udv2-panel">
  <div class="udv2-panel-head"><h2>${edit.id?"Editar campo":"Nuevo campo"}</h2>${edit.id?'<button id="udv2CourseNew" class="udv2-btn secondary" type="button">Nuevo</button>':""}</div>
  <form id="udv2CourseForm" class="udv2-form">
    <div class="udv2-row">
      <div class="udv2-field"><label>Nombre *</label><input name="name" value="${escapeHtml(edit.name||"")}" required></div>
      <div class="udv2-field"><label>Slug *</label><input name="slug" value="${escapeHtml(edit.slug||"")}" required></div>
    </div>
    <div class="udv2-field"><label>Ubicación</label><input name="location_label" value="${escapeHtml(edit.location_label||"")}" placeholder="Los Cabos, B.C.S."></div>
    <div class="udv2-field"><label>Descripción ES</label><textarea name="description">${escapeHtml(edit.description||"")}</textarea></div>
    <div class="udv2-field"><label>Descripción EN</label><textarea name="description_en">${escapeHtml(edit.description_en||"")}</textarea></div>
    <div class="udv2-row">
      <div class="udv2-field"><label>Google Maps URL</label><input name="map_url" type="url" value="${escapeHtml(edit.map_url||"")}"></div>
      <div class="udv2-field"><label>Sitio oficial</label><input name="official_url" type="url" value="${escapeHtml(edit.official_url||"")}"></div>
    </div>
    <div class="udv2-field"><label>Imagen</label><input name="image_file" type="file" accept="image/jpeg,image/png,image/webp,image/avif"></div>
    ${edit.image_url?`<img class="udv2-preview is-show" src="${escapeHtml(edit.image_url)}" alt="">`:""}
    <div class="udv2-row">
      <div class="udv2-field"><label>Orden</label><input name="sort_order" type="number" value="${Number(edit.sort_order||0)}"></div>
      <label class="udv2-check"><input name="is_visible" type="checkbox" ${edit.id?!edit.is_visible?"":"checked":"checked"}> Mostrar en la tienda</label>
    </div>
    <div class="udv2-actions"><button class="udv2-btn primary" type="submit">${edit.id?"Guardar cambios":"Crear campo"}</button></div>
  </form>
</section>
<section class="udv2-panel">
  <div class="udv2-panel-head"><h2>Campos de golf</h2><span class="udv2-muted">${state.courses.length}</span></div>
  <div class="udv2-list">${renderCards(state.courses,"courses")}</div>
</section>
</div>`;
  }

  function instructorSectionHtml(){
    const edit=state.instructors.find(x=>x.id===state.editing.instructors)||{};
    return `
<div class="udv2-grid">
<section class="udv2-panel">
  <div class="udv2-panel-head"><h2>${edit.id?"Editar profesor":"Nuevo profesor"}</h2>${edit.id?'<button id="udv2InstructorNew" class="udv2-btn secondary" type="button">Nuevo</button>':""}</div>
  <form id="udv2InstructorForm" class="udv2-form">
    <div class="udv2-row">
      <div class="udv2-field"><label>Nombre *</label><input name="name" value="${escapeHtml(edit.name||"")}" required></div>
      <div class="udv2-field"><label>Slug *</label><input name="slug" value="${escapeHtml(edit.slug||"")}" required></div>
    </div>
    <div class="udv2-field"><label>Bio ES</label><textarea name="short_bio">${escapeHtml(edit.short_bio||"")}</textarea></div>
    <div class="udv2-field"><label>Bio EN</label><textarea name="short_bio_en">${escapeHtml(edit.short_bio_en||"")}</textarea></div>
    <div class="udv2-row">
      <div class="udv2-field"><label>Teléfono</label><input name="phone" value="${escapeHtml(edit.phone||"")}"></div>
      <div class="udv2-field"><label>WhatsApp</label><input name="whatsapp_phone" value="${escapeHtml(edit.whatsapp_phone||"")}"></div>
    </div>
    <div class="udv2-field"><label>Especialidades ES</label><input name="specialties" value="${escapeHtml((edit.specialties||[]).join(", "))}" placeholder="Swing, juego corto, estrategia"></div>
    <div class="udv2-field"><label>Especialidades EN</label><input name="specialties_en" value="${escapeHtml((edit.specialties_en||[]).join(", "))}"></div>
    <div class="udv2-field"><label>Booking URL (opcional)</label><input name="booking_url" type="url" value="${escapeHtml(edit.booking_url||"")}"></div>
    <div class="udv2-field"><label>Foto</label><input name="image_file" type="file" accept="image/jpeg,image/png,image/webp,image/avif"></div>
    ${edit.image_url?`<img class="udv2-preview is-show" src="${escapeHtml(edit.image_url)}" alt="">`:""}
    <div class="udv2-row">
      <div class="udv2-field"><label>Orden</label><input name="sort_order" type="number" value="${Number(edit.sort_order||0)}"></div>
      <div style="display:grid;gap:8px">
        <label class="udv2-check"><input name="is_visible" type="checkbox" ${edit.id?!edit.is_visible?"":"checked":"checked"}> Visible en HOME</label>
        <label class="udv2-check"><input name="is_active" type="checkbox" ${edit.id?(edit.is_active!==false?"checked":""):"checked"}> Disponible para clases</label>
      </div>
    </div>
    <div class="udv2-actions"><button class="udv2-btn primary" type="submit">${edit.id?"Guardar cambios":"Crear profesor"}</button></div>
  </form>
</section>
<section class="udv2-panel">
  <div class="udv2-panel-head"><h2>Profesores</h2><span class="udv2-muted">${state.instructors.length}</span></div>
  <div class="udv2-list">${renderCards(state.instructors,"instructors")}</div>
</section>
</div>`;
  }

  function articleSectionHtml(){
    const edit=state.articles.find(x=>x.id===state.editing.articles)||{};
    const published = edit.published_at ? new Date(edit.published_at).toISOString().slice(0,16) : "";
    return `
<div class="udv2-grid">
<section class="udv2-panel">
  <div class="udv2-panel-head"><h2>${edit.id?"Editar artículo":"Nuevo artículo"}</h2>${edit.id?'<button id="udv2ArticleNew" class="udv2-btn secondary" type="button">Nuevo</button>':""}</div>
  <form id="udv2ArticleForm" class="udv2-form">
    <div class="udv2-row">
      <div class="udv2-field"><label>Título ES *</label><input name="title" value="${escapeHtml(edit.title||"")}" required></div>
      <div class="udv2-field"><label>Slug *</label><input name="slug" value="${escapeHtml(edit.slug||"")}" required></div>
    </div>
    <div class="udv2-field"><label>Título EN</label><input name="title_en" value="${escapeHtml(edit.title_en||"")}"></div>
    <div class="udv2-row">
      <div class="udv2-field"><label>Eyebrow ES</label><input name="eyebrow" value="${escapeHtml(edit.eyebrow||"")}"></div>
      <div class="udv2-field"><label>Eyebrow EN</label><input name="eyebrow_en" value="${escapeHtml(edit.eyebrow_en||"")}"></div>
    </div>
    <div class="udv2-field"><label>Resumen ES</label><textarea name="summary">${escapeHtml(edit.summary||"")}</textarea></div>
    <div class="udv2-field"><label>Resumen EN</label><textarea name="summary_en">${escapeHtml(edit.summary_en||"")}</textarea></div>
    <div class="udv2-field"><label>Contenido ES</label><textarea name="body" style="min-height:180px">${escapeHtml(edit.body||"")}</textarea></div>
    <div class="udv2-field"><label>Contenido EN</label><textarea name="body_en" style="min-height:180px">${escapeHtml(edit.body_en||"")}</textarea></div>
    <div class="udv2-field"><label>Imagen</label><input name="image_file" type="file" accept="image/jpeg,image/png,image/webp,image/avif"></div>
    ${edit.image_url?`<img class="udv2-preview is-show" src="${escapeHtml(edit.image_url)}" alt="">`:""}
    <div class="udv2-row">
      <div class="udv2-field"><label>Publicar desde</label><input name="published_at" type="datetime-local" value="${published}"></div>
      <div class="udv2-field"><label>Orden</label><input name="sort_order" type="number" value="${Number(edit.sort_order||0)}"></div>
    </div>
    <div class="udv2-actions">
      <label class="udv2-check"><input name="is_visible" type="checkbox" ${edit.id?!edit.is_visible?"":"checked":"checked"}> Visible</label>
      <label class="udv2-check"><input name="is_priority" type="checkbox" ${edit.is_priority?"checked":""}> Prioridad</label>
    </div>
    <div class="udv2-actions"><button class="udv2-btn primary" type="submit">${edit.id?"Guardar cambios":"Crear artículo"}</button></div>
  </form>
</section>
<section class="udv2-panel">
  <div class="udv2-panel-head"><h2>Cabo Journal</h2><span class="udv2-muted">${state.articles.length}</span></div>
  <div class="udv2-list">${renderCards(state.articles,"articles")}</div>
</section>
</div>`;
  }

  function renderCards(items,type){
    if(!items.length) return '<div class="udv2-empty">Todavía no hay contenido.</div>';
    return items.map(item=>{
      const title=item.name||item.title||"Sin título";
      let meta="";
      if(type==="courses") meta=[item.location_label,`Orden ${item.sort_order||0}`].filter(Boolean).join(" · ");
      if(type==="instructors") meta=[item.whatsapp_phone||item.phone,item.is_active===false?"No disponible":"Disponible para clases",`Orden ${item.sort_order||0}`].filter(Boolean).join(" · ");
      if(type==="articles") meta=[item.eyebrow,item.published_at?dateTime(item.published_at):"Sin fecha",`Orden ${item.sort_order||0}`].filter(Boolean).join(" · ");
      return `<article class="udv2-card ${item.image_url?"":"no-image"}">
        ${item.image_url?`<img src="${escapeHtml(item.image_url)}" alt="">`:""}
        <div><div style="display:flex;align-items:center;gap:7px;flex-wrap:wrap"><h3>${escapeHtml(title)}</h3><span class="udv2-badge ${item.is_visible?"":"off"}">${item.is_visible?"Visible":"Oculto"}</span>${item.is_priority?'<span class="udv2-badge">Prioridad</span>':""}</div><div class="udv2-meta">${escapeHtml(meta)}</div></div>
        <div class="udv2-card-actions">
          <button class="udv2-btn secondary" type="button" data-edit-type="${type}" data-id="${item.id}">Editar</button>
          <button class="udv2-btn danger" type="button" data-delete-type="${type}" data-id="${item.id}">Eliminar</button>
        </div>
      </article>`;
    }).join("");
  }

  function bindContentSection(){
    const type=state.contentType;
    const form=$(type==="courses"?"udv2CourseForm":type==="instructors"?"udv2InstructorForm":"udv2ArticleForm");
    const nameInput=form?.querySelector('input[name="name"],input[name="title"]');
    const slugInput=form?.querySelector('input[name="slug"]');
    nameInput?.addEventListener("blur",()=>{ if(slugInput&&!slugInput.value.trim()) slugInput.value=slugify(nameInput.value); });

    $("udv2CourseNew")?.addEventListener("click",()=>{state.editing.courses=null;renderContentSection()});
    $("udv2InstructorNew")?.addEventListener("click",()=>{state.editing.instructors=null;renderContentSection()});
    $("udv2ArticleNew")?.addEventListener("click",()=>{state.editing.articles=null;renderContentSection()});

    form?.addEventListener("submit",saveContentItem);

    qa("[data-edit-type]",$("udv2ContentBody")).forEach(btn=>btn.addEventListener("click",()=>{
      state.editing[btn.dataset.editType]=btn.dataset.id;
      renderContentSection();
      window.scrollTo({top:$("udv2ContentView").offsetTop,behavior:"smooth"});
    }));
    qa("[data-delete-type]",$("udv2ContentBody")).forEach(btn=>btn.addEventListener("click",()=>deleteContentItem(btn.dataset.deleteType,btn.dataset.id)));
  }

  async function saveContentItem(event){
    event.preventDefault();
    const form=event.currentTarget;
    const fd=new FormData(form);
    const db=await getDb();
    const type=state.contentType;
    const table=type==="courses"?"golf_courses":type==="instructors"?"golf_instructors":"journal_articles";
    const editingId=state.editing[type];
    const current=(state[type]||[]).find(x=>x.id===editingId)||{};
    const slug=slugify(fd.get("slug")||fd.get("name")||fd.get("title"));
    if(!slug) return toast("El slug es obligatorio.",true);

    let image_url=current.image_url||null;
    const file=fd.get("image_file");
    if(file instanceof File && file.size){
      try { image_url=await uploadImage(file,type,slug); }
      catch(e){ return toast(e.message,true); }
    }

    let payload={slug,image_url,sort_order:Number(fd.get("sort_order")||0),is_visible:fd.get("is_visible")==="on"};
    if(type==="courses"){
      Object.assign(payload,{
        name:String(fd.get("name")||"").trim(),
        location_label:String(fd.get("location_label")||"").trim()||null,
        description:String(fd.get("description")||"").trim()||null,
        description_en:String(fd.get("description_en")||"").trim()||null,
        map_url:String(fd.get("map_url")||"").trim()||null,
        official_url:String(fd.get("official_url")||"").trim()||null
      });
    }else if(type==="instructors"){
      const list=(v)=>String(v||"").split(",").map(x=>x.trim()).filter(Boolean);
      Object.assign(payload,{
        name:String(fd.get("name")||"").trim(),
        short_bio:String(fd.get("short_bio")||"").trim()||null,
        short_bio_en:String(fd.get("short_bio_en")||"").trim()||null,
        phone:String(fd.get("phone")||"").trim()||null,
        whatsapp_phone:String(fd.get("whatsapp_phone")||"").trim()||null,
        specialties:list(fd.get("specialties")),
        specialties_en:list(fd.get("specialties_en")),
        booking_url:String(fd.get("booking_url")||"").trim()||null,
        is_active:fd.get("is_active")==="on"
      });
    }else{
      const published=String(fd.get("published_at")||"").trim();
      Object.assign(payload,{
        eyebrow:String(fd.get("eyebrow")||"").trim()||null,
        eyebrow_en:String(fd.get("eyebrow_en")||"").trim()||null,
        title:String(fd.get("title")||"").trim(),
        title_en:String(fd.get("title_en")||"").trim()||null,
        summary:String(fd.get("summary")||"").trim()||null,
        summary_en:String(fd.get("summary_en")||"").trim()||null,
        body:String(fd.get("body")||"").trim()||null,
        body_en:String(fd.get("body_en")||"").trim()||null,
        is_priority:fd.get("is_priority")==="on",
        published_at:published?new Date(published).toISOString():null
      });
    }

    const button=q('button[type="submit"]',form); button.disabled=true; const old=button.textContent; button.textContent="Guardando…";
    try{
      const result=editingId
        ? await db.from(table).update(payload).eq("id",editingId)
        : await db.from(table).insert(payload);
      if(result.error) throw result.error;
      state.editing[type]=null;
      toast(editingId?"Cambios guardados.":"Contenido creado.");
      await loadContent();
    }catch(e){ toast(e.message||"No fue posible guardar.",true); }
    finally{ button.disabled=false;button.textContent=old; }
  }

  async function deleteContentItem(type,id){
    if(!confirm("¿Eliminar este contenido? Esta acción no se puede deshacer.")) return;
    const table=type==="courses"?"golf_courses":type==="instructors"?"golf_instructors":"journal_articles";
    const db=await getDb();
    const {error}=await db.from(table).delete().eq("id",id);
    if(error) return toast(error.message,true);
    if(state.editing[type]===id) state.editing[type]=null;
    toast("Contenido eliminado.");
    await loadContent();
  }

  async function loadSellers(){
    try{
      await verifyAdmin();
      const db=await getDb();
      const [s,c]=await Promise.all([
        db.from("affiliate_sellers").select("id,code,name,email,phone,commission_rate,is_active,created_at").order("created_at",{ascending:false}),
        db.from("affiliate_commissions").select("id,order_id,seller_id,seller_code,currency,order_total,commission_rate,commission_amount,status,created_at,affiliate_sellers(name,code),orders(order_number,created_at)").order("created_at",{ascending:false})
      ]);
      if(s.error) throw s.error;if(c.error) throw c.error;
      state.sellers=s.data||[];state.commissions=c.data||[];
      renderSellerMetrics();renderSellers();renderCommissions();
    }catch(e){ toast(e.message||"No se pudieron cargar vendedores.",true); }
  }

  function renderSellerMetrics(){
    $("udv2ActiveSellers").textContent=String(state.sellers.filter(x=>x.is_active).length);
    $("udv2AttributedSales").textContent=money(state.commissions.filter(x=>x.status!=="cancelled").reduce((a,x)=>a+Number(x.order_total||0),0));
    $("udv2PendingCommission").textContent=money(state.commissions.filter(x=>["pending","approved"].includes(x.status)).reduce((a,x)=>a+Number(x.commission_amount||0),0));
    $("udv2PaidCommission").textContent=money(state.commissions.filter(x=>x.status==="paid").reduce((a,x)=>a+Number(x.commission_amount||0),0));
  }

  function referralLink(code){
    const url=new URL(window.location.origin);
    url.searchParams.set("ref",code);
    return url.toString();
  }

  async function copy(text){
    try{ await navigator.clipboard.writeText(text);toast("Copiado."); }
    catch{
      const ta=document.createElement("textarea");ta.value=text;ta.style.position="fixed";ta.style.opacity="0";document.body.appendChild(ta);ta.select();document.execCommand("copy");ta.remove();toast("Copiado.");
    }
  }

  function renderSellers(){
    const root=$("udv2SellerList");
    $("udv2SellerCount").textContent=`${state.sellers.length} vendedor${state.sellers.length===1?"":"es"}`;
    if(!state.sellers.length){root.innerHTML='<div class="udv2-empty">Todavía no hay vendedores.</div>';return}
    root.innerHTML=state.sellers.map(s=>{
      const link=referralLink(s.code);
      return `<article class="udv2-seller-card" data-seller-id="${s.id}">
        <div class="udv2-seller-head"><div><h3>${escapeHtml(s.name)}</h3><span class="udv2-code">${escapeHtml(s.code)}</span><div class="udv2-meta">${escapeHtml(s.email||"")}${s.phone?` · ${escapeHtml(s.phone)}`:""}</div></div><span class="udv2-badge ${s.is_active?"":"off"}">${s.is_active?"Activo":"Inactivo"}</span></div>
        <div class="udv2-seller-edit"><input class="udv2-rate" type="number" min="0" max="100" step=".01" value="${Number(s.commission_rate||0)}"><select class="udv2-active"><option value="true" ${s.is_active?"selected":""}>Activo</option><option value="false" ${!s.is_active?"selected":""}>Inactivo</option></select></div>
        <div class="udv2-link">${escapeHtml(link)}</div>
        <div class="udv2-actions" style="margin-top:9px"><button class="udv2-btn primary udv2-save-seller" type="button">Guardar</button><button class="udv2-btn secondary udv2-copy-link" type="button">Copiar enlace</button><a class="udv2-btn secondary" href="${window.location.origin}/vendedor" target="_blank" rel="noopener noreferrer">Portal ↗</a></div>
      </article>`;
    }).join("");

    qa("[data-seller-id]",root).forEach(card=>{
      const seller=state.sellers.find(x=>x.id===card.dataset.sellerId);
      q(".udv2-copy-link",card).onclick=()=>copy(referralLink(seller.code));
      q(".udv2-save-seller",card).onclick=async()=>{
        const rate=Number(q(".udv2-rate",card).value),active=q(".udv2-active",card).value==="true";
        if(!Number.isFinite(rate)||rate<0||rate>100) return toast("Comisión inválida.",true);
        const btn=q(".udv2-save-seller",card);btn.disabled=true;btn.textContent="Guardando…";
        const db=await getDb();const {error}=await db.from("affiliate_sellers").update({commission_rate:rate,is_active:active}).eq("id",seller.id);
        if(error){toast(error.message,true);btn.disabled=false;btn.textContent="Guardar";return}
        toast("Vendedor actualizado.");await loadSellers();
      };
    });
  }

  function renderCommissions(){
    const root=$("udv2CommissionList");
    if(!root)return;

    const filterNode=$("udv2CommissionFilter");
    const searchNode=$("udv2CommissionSearch");

    // Preserve UI state even when the list itself re-renders.
    if(searchNode&&document.activeElement!==searchNode){
      searchNode.value=state.commissionSearch||"";
    }

    // Build available states from real database values so a new/legacy status
    // can never make the filter appear broken.
    const known=[
      ["all","Todos los estados"],
      ["pending","Pendiente"],
      ["approved","Aprobada"],
      ["paid","Pagada"],
      ["cancelled","Cancelada"]
    ];
    const actual=[...new Set(state.commissions.map(x=>String(x.status||"").trim()).filter(Boolean))];
    const labels={pending:"Pendiente",approved:"Aprobada",paid:"Pagada",cancelled:"Cancelada"};
    actual.forEach(status=>{
      if(!known.some(([value])=>value===status))known.push([status,status]);
    });

    if(filterNode){
      filterNode.innerHTML=known.map(([value,label])=>`<option value="${escapeHtml(value)}">${escapeHtml(label)}</option>`).join("");
      if(!known.some(([value])=>value===state.commissionFilter))state.commissionFilter="all";
      filterNode.value=state.commissionFilter||"all";
    }

    const search=String(state.commissionSearch||"").trim().toLowerCase();
    const filter=String(state.commissionFilter||"all");

    const visible=state.commissions.filter(x=>{
      const status=String(x.status||"").trim();
      const order=String(x.orders?.order_number||x.order_id||"");
      const hay=[
        x.seller_code,
        x.affiliate_sellers?.name,
        x.affiliate_sellers?.code,
        order,
        `pedido ${order}`,
        status,
        labels[status]
      ].filter(Boolean).join(" ").toLowerCase();

      const statusMatch=filter==="all"||status===filter;
      const searchMatch=!search||hay.includes(search);
      return statusMatch&&searchMatch;
    });

    $("udv2CommissionCount").textContent=`${visible.length} de ${state.commissions.length} comisión${state.commissions.length===1?"":"es"}`;

    if(!visible.length){
      root.innerHTML=`<div class="udv2-empty">
        ${state.commissions.length
          ?"No hay comisiones que coincidan con estos filtros."
          :"Todavía no hay comisiones registradas."}
      </div>`;
      return;
    }

    root.innerHTML=visible.map(x=>{
      const orderRaw=x.orders?.order_number||x.order_id||"—";
      const order=String(orderRaw).length<6&&!String(orderRaw).includes("-")
        ?String(orderRaw).padStart(5,"0")
        :String(orderRaw);
      const status=String(x.status||"pending");
      return `<article class="udv2-commission-card" data-commission-id="${x.id}">
        <div class="udv2-commission-head">
          <div>
            <h3>Pedido #${escapeHtml(order)}</h3>
            <div class="udv2-meta">${escapeHtml(x.affiliate_sellers?.name||"Vendedor")} · ${escapeHtml(x.seller_code||x.affiliate_sellers?.code||"")}</div>
          </div>
          <span class="udv2-badge ${status==="cancelled"?"off":""}">${escapeHtml(labels[status]||status)}</span>
        </div>
        <div class="udv2-commission-meta">
          <div><span>Venta</span><strong>${money(x.order_total,x.currency)}</strong></div>
          <div><span>Porcentaje</span><strong>${Number(x.commission_rate||0)}%</strong></div>
          <div><span>Comisión</span><strong>${money(x.commission_amount,x.currency)}</strong></div>
          <div><span>Fecha</span><strong>${dateTime(x.created_at)}</strong></div>
        </div>
        <div class="udv2-actions" style="margin-top:9px">
          <select class="udv2-status">
            <option value="pending" ${status==="pending"?"selected":""}>Pendiente</option>
            <option value="approved" ${status==="approved"?"selected":""}>Aprobada</option>
            <option value="paid" ${status==="paid"?"selected":""}>Pagada</option>
            <option value="cancelled" ${status==="cancelled"?"selected":""}>Cancelada</option>
            ${!["pending","approved","paid","cancelled"].includes(status)?`<option value="${escapeHtml(status)}" selected>${escapeHtml(status)}</option>`:""}
          </select>
          <button class="udv2-btn primary udv2-save-commission" type="button">Guardar estado</button>
        </div>
      </article>`;
    }).join("");

    qa("[data-commission-id]",root).forEach(card=>{
      const id=card.dataset.commissionId;
      q(".udv2-save-commission",card).onclick=async()=>{
        const btn=q(".udv2-save-commission",card);
        const status=q(".udv2-status",card).value;
        btn.disabled=true;btn.textContent="Guardando…";
        const db=await getDb();
        const {error}=await db.from("affiliate_commissions").update({status}).eq("id",id);
        if(error){
          toast(error.message,true);
          btn.disabled=false;btn.textContent="Guardar estado";
          return;
        }
        toast("Comisión actualizada.");
        await loadSellers();
      };
    });
  }

  async function createSeller(event){
    event.preventDefault();
    const btn=$("udv2CreateSeller");
    btn.disabled=true;btn.textContent="Creando…";
    try{
      await verifyAdmin();
      const db=await getDb();
      const {data,error}=await db.functions.invoke("create-affiliate-seller",{body:{
        name:$("udv2SellerName").value.trim(),
        email:$("udv2SellerEmail").value.trim(),
        phone:$("udv2SellerPhone").value.trim(),
        code:normalizeCode($("udv2SellerCode").value),
        commission_rate:Number($("udv2SellerRate").value),
        password:$("udv2SellerPassword").value
      }});
      if(error){
        let message=error.message||"No fue posible crear el vendedor.";
        try{
          if(error.context&&typeof error.context.json==="function"){const body=await error.context.json();message=body?.error||message}
        }catch{}
        throw new Error(message);
      }
      if(data?.error) throw new Error(data.error);
      $("udv2SellerForm").reset();$("udv2SellerRate").value="10";
      toast("Vendedor y acceso creados.");
      await loadSellers();
    }catch(e){toast(e.message||"No fue posible crear vendedor.",true)}
    finally{btn.disabled=false;btn.textContent="Crear vendedor"}
  }

  async function mount(){
    if(state.mounted) return;
    const admin=$("updown-admin");
    if(!admin) return;
    injectStyles();
    if(!createShell()) return;
    bindShell();
    state.mounted=true;

    // Respect ?section=vendedores/content for old redirects/bookmarks.
    const section=new URLSearchParams(location.search).get("section");
    if(section==="vendedores") switchView("sellers");
    if(section==="contenido") switchView("content");
    if(section==="clases") switchView("lessons");
    if(section==="pos") switchView("pos");
  }

  function boot(){
    let tries=0;
    const timer=setInterval(()=>{
      tries++;
      if($("updown-admin")&&$("udDashboard")&&q("#updown-admin .u-admin-nav")){
        clearInterval(timer);mount();
      }else if(tries>100){clearInterval(timer)}
    },100);
  }

  if(document.readyState==="loading") document.addEventListener("DOMContentLoaded",boot,{once:true});
  else boot();
})();
