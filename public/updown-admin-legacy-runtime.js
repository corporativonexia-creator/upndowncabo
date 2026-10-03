
(function(){
  const SUPABASE_URL=window.__UPDOWN_SUPABASE_URL__;
  const SUPABASE_KEY=window.__UPDOWN_SUPABASE_PUBLISHABLE_KEY__;
  const db=window.supabase.createClient(SUPABASE_URL,SUPABASE_KEY,{
    auth:{
      storageKey:"updown-admin-auth",
      persistSession:true,
      autoRefreshToken:true,
      detectSessionInUrl:true
    }
  });
  const el=id=>document.getElementById(id);
  let products=[];
  let orders=[];
  let productGalleryState=[];
  let currentProductSpecifications={};

  const slugify=v=>String(v).normalize("NFD").replace(/[\u0300-\u036f]/g,"").toLowerCase().trim().replace(/[^a-z0-9]+/g,"-").replace(/^-+|-+$/g,"");
  const money=(value,currency="MXN")=>new Intl.NumberFormat("es-MX",{
    style:"currency",
    currency:String(currency||"MXN").toUpperCase()
  }).format(Number(value||0));

  const dateTime=value=>new Intl.DateTimeFormat("es-MX",{
    dateStyle:"medium",
    timeStyle:"short"
  }).format(new Date(value));

  const escapeHtml=(value="")=>String(value)
    .replaceAll("&","&amp;")
    .replaceAll("<","&lt;")
    .replaceAll(">","&gt;")
    .replaceAll('"',"&quot;")
    .replaceAll("'","&#039;");

  const orderStatusLabels={
    processing:"En proceso",
    completed:"Completado",
    needs_review:"Requiere revisión",
    cancelled:"Cancelado"
  };

  function setMessage(node,text="",isError=false){
    node.textContent=text;
    node.classList.toggle("u-show",!!text);
    node.classList.toggle("u-error",isError);
  }

  function showToast(text,isError=false){
    const node=el("udToast");
    node.textContent=text;
    node.classList.toggle("u-error",isError);
    node.classList.add("u-show");
    clearTimeout(showToast.timer);
    showToast.timer=setTimeout(()=>node.classList.remove("u-show"),2400);
  }

  async function verifyAdmin(user){
    const {data,error}=await db.from("profiles").select("role,is_active").eq("id",user.id).single();
    if(error) throw error;
    if(data.role!=="admin"||!data.is_active) throw new Error("Este usuario no tiene permisos de administrador.");
  }

  async function showDashboard(email){
    el("udLoginScreen").classList.add("u-hidden");
    el("udDashboard").classList.remove("u-hidden");
    el("udLogout").classList.remove("u-hidden");
    el("udSessionLabel").textContent=`Sesión activa: ${email}`;
    await Promise.all([loadCategories(),loadProducts(),loadOrders()]);
  }

  async function initialize(){
    const {data:{session}}=await db.auth.getSession();
    if(!session) return;
    try{
      await verifyAdmin(session.user);
      await showDashboard(session.user.email||"Administrador");
    }catch(error){
      await db.auth.signOut();
      setMessage(el("udLoginMessage"),error.message,true);
    }
  }

  el("udLoginForm").addEventListener("submit",async event=>{
    event.preventDefault();
    setMessage(el("udLoginMessage"));
    const button=event.currentTarget.querySelector('button[type="submit"]');
    button.disabled=true;
    button.textContent="Ingresando…";

    const {data,error}=await db.auth.signInWithPassword({
      email:el("udEmail").value.trim(),
      password:el("udPassword").value
    });

    if(error){
      setMessage(el("udLoginMessage"),error.message,true);
    }else{
      try{
        await verifyAdmin(data.user);
        await showDashboard(data.user.email||"Administrador");
      }catch(adminError){
        await db.auth.signOut();
        setMessage(el("udLoginMessage"),adminError.message,true);
      }
    }

    button.disabled=false;
    button.textContent="Iniciar sesión";
  });

  el("udLogout").addEventListener("click",async()=>{
    await db.auth.signOut();
    location.reload();
  });

  function normalizedCategoryName(){
    const select=el("udCategory");
    const option=select?.options?.[select.selectedIndex];
    return String(option?.textContent||"").trim().toLowerCase();
  }

  function isClubCategory(){
    const text=normalizedCategoryName();
    return /(driver|hierro|iron|wedge|putter|hibrid|hybrid|madera|wood|palo|club)/.test(text);
  }

  function updateGolfSpecsVisibility(){
    const club=isClubCategory();
    const condition=el("udCondition")?.value||"new";
    document.querySelectorAll("#updown-admin .u-club-specs").forEach(node=>node.classList.toggle("is-hidden",!club));
    document.querySelectorAll("#updown-admin .u-condition-spec").forEach(node=>node.classList.toggle("is-hidden",condition==="new"));
    const badge=el("udSpecsMode");
    if(badge) badge.textContent=club?"Equipo técnico":"Datos generales";
    const help=el("udSpecsHelp");
    if(help){
      help.textContent=club
        ? "Estos datos aparecerán automáticamente en filtros, cards y detalle de producto de la HOME V9 cuando estén capturados."
        : "Para esta categoría conservamos únicamente información general. Los campos técnicos de palos se ocultan para evitar datos irrelevantes.";
    }
  }

  function specFromObject(specs,aliases=[]){
    if(!specs||typeof specs!=="object"||Array.isArray(specs)) return "";
    const normalize=value=>String(value||"").normalize("NFD").replace(/[\u0300-\u036f]/g,"").toLowerCase().replace(/[_-]+/g," ").trim();
    const wanted=aliases.map(normalize);
    for(const [key,value] of Object.entries(specs)){
      const nk=normalize(key);
      if(wanted.some(alias=>nk===alias||nk.includes(alias)||alias.includes(nk))){
        if(value===null||value===undefined) return "";
        if(typeof value==="object") return JSON.stringify(value);
        return String(value);
      }
    }
    return "";
  }

  function setSelectValueOrCustom(selectId,value){
    const select=el(selectId);if(!select)return;
    const raw=String(value||"").trim();
    if(!raw){select.value="";return}
    const normalized=raw.toLowerCase();
    const match=[...select.options].find(option=>{
      const ov=String(option.value||"").toLowerCase();
      const ot=String(option.textContent||"").toLowerCase();
      return ov===normalized||ot.includes(normalized)||normalized.includes(ov);
    });
    select.value=match?match.value:"";
  }

  function fillGolfSpecifications(specs={}){
    currentProductSpecifications=(specs&&typeof specs==="object"&&!Array.isArray(specs))?{...specs}:{};
    const hand=specFromObject(specs,["hand","mano","dexterity","orientacion"]);
    const loft=specFromObject(specs,["loft","grados","degree"]);
    const flex=specFromObject(specs,["flex","shaft flex","flexibilidad"]);
    const shaft=specFromObject(specs,["shaft","varilla","eje"]);
    const grip=specFromObject(specs,["grip","empunadura"]);
    const conditionScore=specFromObject(specs,["condition score","condition_score","calificacion condicion","estado real"]);
    const player=specFromObject(specs,["ideal para","para que jugador","jugador","player profile","player_profile","recommended for","recomendado para"]);
    const notes=specFromObject(specs,["observaciones","notes","notas","equipment notes","detalles de condicion"]);

    if(/right|rh|diestro|derech/i.test(hand)) el("udSpecHand").value="Right";
    else if(/left|lh|zurdo|izquierd/i.test(hand)) el("udSpecHand").value="Left";
    else el("udSpecHand").value="";
    el("udSpecLoft").value=loft;
    setSelectValueOrCustom("udSpecFlex",flex);
    el("udSpecShaft").value=shaft;
    el("udSpecGrip").value=grip;
    el("udSpecConditionScore").value=conditionScore;
    el("udSpecPlayerProfile").value=player;
    el("udSpecNotes").value=notes;
    updateGolfSpecsVisibility();
  }

  function deleteSpecificationAliases(target,aliases=[]){
    const normalize=value=>String(value||"").normalize("NFD").replace(/[\u0300-\u036f]/g,"").toLowerCase().replace(/[_-]+/g," ").trim();
    const wanted=aliases.map(normalize);
    Object.keys(target).forEach(key=>{
      const nk=normalize(key);
      if(wanted.some(alias=>nk===alias||nk.includes(alias)||alias.includes(nk))) delete target[key];
    });
  }

  function buildGolfSpecifications(){
    const specs={...(currentProductSpecifications||{})};
    const definitions=[
      {key:"hand",value:el("udSpecHand").value,aliases:["hand","mano","dexterity","orientacion"],club:true},
      {key:"loft",value:el("udSpecLoft").value.trim(),aliases:["loft","grados","degree"],club:true},
      {key:"flex",value:el("udSpecFlex").value,aliases:["flex","shaft flex","flexibilidad"],club:true},
      {key:"shaft",value:el("udSpecShaft").value.trim(),aliases:["shaft","varilla","eje"],club:true},
      {key:"grip",value:el("udSpecGrip").value.trim(),aliases:["grip","empunadura"],club:true},
      {key:"condition_score",value:el("udCondition").value==="new"?"":el("udSpecConditionScore").value.trim(),aliases:["condition score","condition_score","calificacion condicion","estado real"]},
      {key:"player_profile",value:el("udSpecPlayerProfile").value.trim(),aliases:["ideal para","para que jugador","jugador","player profile","player_profile","recommended for","recomendado para"]},
      {key:"observations",value:el("udSpecNotes").value.trim(),aliases:["observaciones","observations","notes","notas","equipment notes","detalles de condicion"]}
    ];
    const club=isClubCategory();
    definitions.forEach(def=>{
      deleteSpecificationAliases(specs,def.aliases);
      if(def.club&&!club) return;
      if(def.value) specs[def.key]=def.value;
    });
    return specs;
  }

  async function loadCategories(){
    const {data,error}=await db.from("categories").select("id,name,sort_order").order("sort_order");
    if(error){showToast(error.message,true);return}
    el("udCategory").innerHTML='<option value="">Selecciona una categoría</option>';
    (data||[]).forEach(category=>{
      const option=document.createElement("option");
      option.value=category.id;
      option.textContent=category.name;
      el("udCategory").appendChild(option);
    });
    updateGolfSpecsVisibility();
  }

  async function loadProducts(){
    const {data,error}=await db.from("products").select("*,categories(name),product_images(id,image_url,alt_text,sort_order,is_primary)").order("created_at",{ascending:false});
    if(error){el("udList").innerHTML=`<div class="u-empty">${error.message}</div>`;return}
    products=data||[];
    renderProducts();
  }

  async function loadOrders(){
    el("udOrdersList").innerHTML='<div class="u-empty">Cargando pedidos…</div>';

    const {data,error}=await db
      .from("orders")
      .select(`
        id,
        order_number,
        stripe_checkout_session_id,
        customer_email,
        customer_name,
        customer_phone,
        currency,
        subtotal,
        total,
        payment_status,
        order_status,
        affiliate_seller_id,
        seller_ref,
        affiliate_commission_rate,
        affiliate_commission_amount,
        shipping_carrier,
        tracking_number,
        shipped_at,
        notes,
        created_at,
        order_items(
          id,
          product_name,
          sku,
          unit_price,
          quantity,
          line_total,
          product_snapshot
        ),
        order_activity_log(
          id,
          event_type,
          title,
          details,
          old_value,
          new_value,
          created_by_email,
          created_at
        ),
        affiliate_seller:affiliate_sellers(
          id,
          code,
          name,
          email
        )
      `)
      .order("created_at",{ascending:false});

    if(error){
      el("udOrdersList").innerHTML=`<div class="u-empty">${escapeHtml(error.message)}</div>`;
      return;
    }

    orders=data||[];
    renderOrders();
  }

  function renderOrderMetrics(){
    const paidOrders=orders.filter(order=>order.payment_status==="paid");
    const sales=paidOrders.reduce((sum,order)=>sum+Number(order.total||0),0);

    el("udSalesMetric").textContent=money(sales,"MXN");
    el("udOrdersMetric").textContent=String(orders.length);
    el("udProcessingMetric").textContent=String(
      orders.filter(order=>order.order_status==="processing").length
    );
    el("udReviewMetric").textContent=String(
      orders.filter(order=>order.order_status==="needs_review").length
    );
  }

  function sortedOrderActivity(order){
    return [...(order.order_activity_log||[])]
      .sort((a,b)=>new Date(b.created_at)-new Date(a.created_at));
  }

  function activityStatusLabel(value){
    return orderStatusLabels[value]||value||"—";
  }

  function activityPlainText(activity){
    const oldValue=activity.old_value||{};
    const newValue=activity.new_value||{};

    if(activity.event_type==="status_change"){
      return (
        `${activityStatusLabel(oldValue.order_status)} → ` +
        `${activityStatusLabel(newValue.order_status)}`
      );
    }

    if(activity.event_type==="payment_status_change"){
      return (
        `${oldValue.payment_status||"—"} → ` +
        `${newValue.payment_status||"—"}`
      );
    }

    if(activity.event_type==="shipping_update"){
      const carrier=newValue.shipping_carrier||"Sin paquetería";
      const tracking=newValue.tracking_number||"Sin guía";
      return `Paquetería: ${carrier} · Guía: ${tracking}`;
    }

    if(activity.event_type==="order_created"){
      const total=newValue.total!==undefined
        ? money(newValue.total,newValue.currency||"MXN")
        : "";

      return total
        ? `Pedido registrado por ${total}.`
        : activity.details||"Pedido registrado.";
    }

    return activity.details||activity.title||"Actualización registrada.";
  }

  function activityCssClass(eventType){
    if(eventType==="note") return "is-note";
    if(eventType==="shipping_update") return "is-shipping";
    if(
      eventType==="status_change"||
      eventType==="payment_status_change"
    ) return "is-status";

    return "";
  }

  function renderOrderTimeline(order){
    const activities=sortedOrderActivity(order);

    if(!activities.length){
      return `
        <div class="u-activity-empty">
          Todavía no hay actualizaciones registradas.
        </div>
      `;
    }

    return activities.map(activity=>`
      <div class="u-activity-item ${activityCssClass(activity.event_type)}">
        <span class="u-activity-dot"></span>

        <div class="u-activity-title">
          ${escapeHtml(activity.title||"Actualización")}
        </div>

        <div class="u-activity-details">
          ${escapeHtml(activityPlainText(activity))}
        </div>

        <div class="u-activity-meta">
          ${escapeHtml(dateTime(activity.created_at))}
          ·
          ${escapeHtml(activity.created_by_email||"Sistema")}
        </div>
      </div>
    `).join("");
  }

  async function refreshOrderActivity(orderId){
    const {data,error}=await db
      .from("order_activity_log")
      .select(`
        id,
        event_type,
        title,
        details,
        old_value,
        new_value,
        created_by_email,
        created_at
      `)
      .eq("order_id",orderId)
      .order("created_at",{ascending:false});

    if(error){
      showToast(
        `La actualización se guardó, pero no pudimos refrescar la bitácora: ${error.message}`,
        true
      );
      return;
    }

    const order=orders.find(item=>item.id===orderId);
    if(order){
      order.order_activity_log=data||[];
    }
  }

  function getOrderAffiliate(order){
    const relation=Array.isArray(order.affiliate_seller)
      ? order.affiliate_seller[0]
      : order.affiliate_seller;

    const code=String(
      order.seller_ref||relation?.code||""
    ).trim().toUpperCase();

    const name=String(
      relation?.name||""
    ).trim();

    const isAffiliate=Boolean(
      order.affiliate_seller_id||code
    );

    return {
      isAffiliate,
      id:order.affiliate_seller_id||relation?.id||null,
      code,
      name:name||code||"Vendedor afiliado",
      email:relation?.email||"",
      rate:Number(order.affiliate_commission_rate||0),
      amount:Number(order.affiliate_commission_amount||0)
    };
  }

  function renderOrders(){
    renderOrderMetrics();

    const search=el("udOrderSearch").value.trim().toLowerCase();
    const status=el("udOrderFilter").value;

    // 3, 00003, #00003 y "Pedido 3" se interpretan
    // exclusivamente como número de pedido.
    const orderSearchCandidate=search
      .replace(/^pedido\s*/i,"")
      .replace(/^#/,"")
      .trim();

    const isOrderNumberSearch=/^\d+$/.test(orderSearchCandidate);
    const normalizedOrderSearch=isOrderNumberSearch
      ? String(Number(orderSearchCandidate))
      : "";

    const visibleOrders=orders.filter(order=>{
      const statusOk=status==="all"||order.order_status===status;
      const itemsText=(order.order_items||[])
        .map(item=>`${item.product_name||""} ${item.sku||""}`)
        .join(" ");

      const affiliate=getOrderAffiliate(order);
      const affiliateText=affiliate.isAffiliate
        ? `${affiliate.name} ${affiliate.code} ${affiliate.email}`
        : "venta directa sin afiliado";

      const activityText=sortedOrderActivity(order)
        .map(activity=>[
          activity.title,
          activity.details,
          activity.created_by_email,
          activityPlainText(activity)
        ].filter(Boolean).join(" "))
        .join(" ");

      const haystack=[
        order.order_number,
        order.customer_name,
        order.customer_email,
        order.customer_phone,
        order.stripe_checkout_session_id,
        order.shipping_carrier,
        order.tracking_number,
        itemsText,
        affiliateText,
        activityText
      ].filter(Boolean).join(" ").toLowerCase();

      const normalizedOrderNumber=String(
        Number(order.order_number)
      );

      const orderNumberMatches=
        isOrderNumberSearch &&
        normalizedOrderNumber===normalizedOrderSearch;

      const textMatches=
        !isOrderNumberSearch &&
        haystack.includes(search);

      return statusOk&&(
        !search ||
        orderNumberMatches ||
        textMatches
      );
    });

    if(!visibleOrders.length){
      el("udOrdersList").innerHTML=
        '<div class="u-empty">No encontramos pedidos con esos filtros.</div>';
      return;
    }

    el("udOrdersList").innerHTML="";

    visibleOrders.forEach(order=>{
      const card=document.createElement("article");
      card.className="u-order-card";

      const orderNumber=String(order.order_number||"").padStart(5,"0");
      const affiliate=getOrderAffiliate(order);
      const affiliateBadge=affiliate.isAffiliate
        ? `Afiliado: ${escapeHtml(affiliate.code||"—")}`
        : "Venta directa";

      const affiliateDetail=affiliate.isAffiliate
        ? `Código ${escapeHtml(affiliate.code||"—")} · Comisión ${affiliate.rate}% (${money(affiliate.amount,order.currency)})`
        : "Sin referencia de vendedor";

      const items=(order.order_items||[]).map(item=>`
        <div class="u-order-item">
          <div>
            <strong>${escapeHtml(item.product_name||"Producto")}</strong>
            <small>SKU ${escapeHtml(item.sku||"—")} · ${item.quantity} unidad${Number(item.quantity)===1?"":"es"}</small>
          </div>
          <strong>${money(item.line_total,order.currency)}</strong>
        </div>
      `).join("");

      const statusClass=
        order.order_status==="needs_review"
          ?"is-warning"
          :order.order_status==="cancelled"
            ?"is-danger"
            :"";

      const paymentClass=
        order.payment_status==="paid"
          ?""
          :"is-warning";

      card.innerHTML=`
        <div class="u-order-head">
          <div>
            <div class="u-order-number">Pedido #${orderNumber}</div>
            <div class="u-order-date">${dateTime(order.created_at)}</div>
          </div>

          <div class="u-order-head-actions">
            <div class="u-badges">
              <span class="u-badge ${paymentClass}">
                Pago: ${escapeHtml(order.payment_status||"—")}
              </span>
              <span class="u-badge ${statusClass}">
                ${escapeHtml(orderStatusLabels[order.order_status]||order.order_status||"—")}
              </span>
              <span class="u-badge ${affiliate.isAffiliate?"is-affiliate":"is-direct"}">
                ${affiliateBadge}
              </span>
            </div>

            <span class="u-order-lock-status ud-order-lock-status">
              🔒 Pedido bloqueado
            </span>

            <button
              class="u-btn u-edit-order u-small ud-toggle-order-edit"
              type="button"
            >
              Editar pedido
            </button>
          </div>
        </div>

        <div class="u-order-body">
          <div class="u-order-customer">
            <div class="u-detail">
              <span>Cliente</span>
              <strong>${escapeHtml(order.customer_name||"No especificado")}</strong>
            </div>
            <div class="u-detail">
              <span>Correo</span>
              <strong>${escapeHtml(order.customer_email||"No especificado")}</strong>
            </div>
            <div class="u-detail">
              <span>Teléfono</span>
              <strong>${escapeHtml(order.customer_phone||"No especificado")}</strong>
            </div>

            <div class="u-detail ${affiliate.isAffiliate?"is-affiliate":"is-direct"}">
              <span>Canal de venta</span>
              <strong>${escapeHtml(affiliate.isAffiliate?affiliate.name:"Venta directa")}</strong>
              <small>${affiliateDetail}</small>
            </div>
          </div>

          <div class="u-order-items">
            ${items||'<div class="u-muted">Sin productos registrados.</div>'}
          </div>

          <div class="u-order-footer">
            <div>
              <div class="u-muted">Total pagado</div>
              <div class="u-order-total">${money(order.total,order.currency)}</div>
            </div>

            <div class="u-order-status-actions">
              <select class="ud-order-status" disabled>
                <option value="processing" ${order.order_status==="processing"?"selected":""}>En proceso</option>
                <option value="completed" ${order.order_status==="completed"?"selected":""}>Completado</option>
                <option value="needs_review" ${order.order_status==="needs_review"?"selected":""}>Requiere revisión</option>
                <option value="cancelled" ${order.order_status==="cancelled"?"selected":""}>Cancelado</option>
              </select>
              <button class="u-btn u-primary u-small ud-save-order" type="button">
                Guardar estado
              </button>
            </div>
          </div>

          <div class="u-shipping-box">
            <div class="u-shipping-title">Información de envío</div>

            <div class="u-order-edit-help">
              Modo edición activo. Revisa los datos antes de guardarlos.
              Después de guardar, el pedido se bloqueará nuevamente.
            </div>

            <div class="u-shipping-grid">
              <label>
                Paquetería
                <select class="ud-shipping-carrier" disabled>
                  <option
                    value=""
                    ${!order.shipping_carrier?"selected":""}
                  >
                    Selecciona paquetería
                  </option>
                  ${[
                    "DHL Express",
                    "Baja Pack Express",
                    "Paquetexpress",
                    "Estafeta",
                    "Paquetería Tresguerras",
                    "AQUÍ CON ZEPEDA LOGISTIC",
                    "Cabo Mail & Shipping",
                    "Grupo AMPM",
                    "Correos de México",
                    "Paquetería JyT",
                    "Express Cabo San Lucas",
                    "Otra"
                  ].map(carrier=>`
                    <option
                      value="${escapeHtml(carrier)}"
                      ${order.shipping_carrier===carrier?"selected":""}
                    >
                      ${escapeHtml(carrier)}
                    </option>
                  `).join("")}
                </select>
              </label>

              <label>
                Número de guía
                <input
                  class="ud-tracking-number"
                  type="text"
                  placeholder="Pega aquí la guía de rastreo"
                  value="${escapeHtml(order.tracking_number||"")}"
                  disabled
                >
              </label>
            </div>

            <div class="u-shipping-actions">
              <button class="u-btn u-primary u-small ud-save-shipping" type="button">
                Guardar envío
              </button>
            </div>

            <div class="u-share-actions">
              <button class="u-btn u-copy u-small ud-copy-order" type="button">
                Copiar pedido completo
              </button>

              <button class="u-btn u-whatsapp u-small ud-whatsapp-order" type="button">
                Enviar resumen al cliente
              </button>
            </div>
          </div>

          <div class="u-order-notes-box">
            <div class="u-order-notes-title">
              Agregar actualización al pedido
            </div>

            <div class="u-order-notes-help">
              Cada entrada se registra por separado con fecha, hora y usuario.
              Las entradas anteriores no se reemplazan.
            </div>

            <textarea
              class="ud-new-order-note"
              placeholder="Presiona Editar pedido para agregar una actualización."
              disabled
            ></textarea>

            <div class="u-notes-actions">
              <button
                class="u-btn u-primary u-small ud-add-order-note"
                type="button"
              >
                Agregar a la bitácora
              </button>
            </div>

            <div class="u-activity-heading">
              <strong>Bitácora del pedido</strong>
              <span>${sortedOrderActivity(order).length} evento${sortedOrderActivity(order).length===1?"":"s"}</span>
            </div>

            <div class="u-order-timeline ud-order-timeline">
              ${renderOrderTimeline(order)}
            </div>
          </div>
        </div>
      `;

      const statusSelect=card.querySelector(".ud-order-status");
      const saveButton=card.querySelector(".ud-save-order");
      const toggleEditButton=card.querySelector(".ud-toggle-order-edit");
      const lockStatusNode=card.querySelector(".ud-order-lock-status");

      saveButton.onclick=()=>updateOrderStatus(
        order.id,
        statusSelect.value,
        saveButton
      );

      const carrierInput=card.querySelector(".ud-shipping-carrier");
      const trackingInput=card.querySelector(".ud-tracking-number");
      const saveShippingButton=card.querySelector(".ud-save-shipping");
      const copyOrderButton=card.querySelector(".ud-copy-order");
      const whatsappOrderButton=card.querySelector(".ud-whatsapp-order");
      const newNoteTextarea=card.querySelector(".ud-new-order-note");
      const addNoteButton=card.querySelector(".ud-add-order-note");
      const timelineNode=card.querySelector(".ud-order-timeline");

      function setOrderEditing(isEditing){
        card.classList.toggle("is-editing",isEditing);

        statusSelect.disabled=!isEditing;
        carrierInput.disabled=!isEditing;
        trackingInput.disabled=!isEditing;
        newNoteTextarea.disabled=!isEditing;

        toggleEditButton.textContent=isEditing
          ?"Cancelar edición"
          :"Editar pedido";

        lockStatusNode.textContent=isEditing
          ?"✎ Modo edición"
          :"🔒 Pedido bloqueado";

        if(!isEditing){
          // Descarta valores que no hayan sido guardados.
          statusSelect.value=order.order_status||"processing";
          carrierInput.value=order.shipping_carrier||"";
          trackingInput.value=order.tracking_number||"";
          newNoteTextarea.value="";
        }
      }

      toggleEditButton.onclick=()=>{
        const willEdit=!card.classList.contains("is-editing");
        setOrderEditing(willEdit);

        if(willEdit){
          statusSelect.focus();
        }
      };

      saveShippingButton.onclick=()=>saveShippingData(
        order,
        carrierInput.value,
        trackingInput.value,
        saveShippingButton
      );

      copyOrderButton.onclick=()=>copyOrderDetails(
        order,
        carrierInput.value,
        trackingInput.value,
        statusSelect.value
      );

      whatsappOrderButton.onclick=()=>sendOrderByWhatsApp(
        order,
        carrierInput.value,
        trackingInput.value,
        statusSelect.value
      );

      addNoteButton.onclick=()=>addOrderNote(
        order,
        newNoteTextarea,
        addNoteButton,
        timelineNode
      );

      el("udOrdersList").appendChild(card);
    });
  }

  function buildOrderMessage(
    order,
    shippingCarrier="",
    trackingNumber="",
    selectedStatus=null
  ){
    const orderNumber=String(order.order_number||"").padStart(5,"0");
    const orderStatus=selectedStatus||order.order_status||"processing";
    const affiliate=getOrderAffiliate(order);

    const lines=[
      "🏌️ *UP AND DOWN · CABO GOLF SHOP*",
      "",
      `*Pedido #${orderNumber}*`,
      `Fecha: ${dateTime(order.created_at)}`,
      "",
      `Cliente: ${order.customer_name||"No especificado"}`,
      `Teléfono: ${order.customer_phone||"No especificado"}`,
      `Correo: ${order.customer_email||"No especificado"}`,
      "",
      "*Productos:*"
    ];

    (order.order_items||[]).forEach(item=>{
      lines.push(
        `• ${item.product_name||"Producto"} · ` +
        `SKU ${item.sku||"—"} · ` +
        `${item.quantity} pza${Number(item.quantity)===1?"":"s"} · ` +
        `${money(item.line_total,order.currency)}`
      );
    });

    lines.push(
      "",
      `*Total pagado:* ${money(order.total,order.currency)}`,
      `*Pago:* ${order.payment_status||"—"}`,
      `*Estado:* ${orderStatusLabels[orderStatus]||orderStatus}`
    );

    if(affiliate.isAffiliate){
      lines.push(
        "",
        "*Vendedor afiliado:*",
        `Nombre: ${affiliate.name}`,
        `Código: ${affiliate.code||"—"}`,
        `Comisión: ${affiliate.rate}% · ${money(affiliate.amount,order.currency)}`
      );
    }else{
      lines.push(
        "",
        "*Canal de venta:* Venta directa"
      );
    }

    const carrier=String(shippingCarrier||"").trim();
    const tracking=String(trackingNumber||"").trim();

    if(carrier||tracking){
      lines.push(
        "",
        "*Información de envío:*",
        `Paquetería: ${carrier||"Pendiente"}`,
        `Guía: ${tracking||"Pendiente"}`
      );
    }

    const activity=sortedOrderActivity(order);

    if(activity.length){
      lines.push(
        "",
        "*Bitácora del pedido:*"
      );

      activity.forEach(event=>{
        lines.push(
          `• ${dateTime(event.created_at)} · ` +
          `${event.title||"Actualización"}: ` +
          `${activityPlainText(event)} ` +
          `(${event.created_by_email||"Sistema"})`
        );
      });
    }

    lines.push(
      "",
      "Gracias por comprar en UP AND DOWN."
    );

    return lines.join("\n");
  }

  async function copyTextToClipboard(text){
    if(navigator.clipboard&&window.isSecureContext){
      await navigator.clipboard.writeText(text);
      return;
    }

    const textarea=document.createElement("textarea");
    textarea.value=text;
    textarea.style.position="fixed";
    textarea.style.opacity="0";
    textarea.style.pointerEvents="none";

    document.body.appendChild(textarea);
    textarea.focus();
    textarea.select();

    const copied=document.execCommand("copy");
    textarea.remove();

    if(!copied){
      throw new Error("No fue posible copiar el pedido.");
    }
  }

  async function copyOrderDetails(
    order,
    shippingCarrier,
    trackingNumber,
    selectedStatus
  ){
    try{
      const message=buildOrderMessage(
        order,
        shippingCarrier,
        trackingNumber,
        selectedStatus
      );

      await copyTextToClipboard(message);
      showToast("Pedido copiado al portapapeles.");
    }catch(error){
      showToast(
        error.message||"No fue posible copiar el pedido.",
        true
      );
    }
  }

  function customerPaymentStatusLabel(status){
    const labels={
      paid:"Confirmado",
      succeeded:"Confirmado",
      complete:"Confirmado",
      completed:"Confirmado",
      pending:"Pendiente de confirmación",
      unpaid:"Pendiente de confirmación",
      failed:"No confirmado",
      cancelled:"Cancelado",
      canceled:"Cancelado",
      refunded:"Reembolsado",
      partially_refunded:"Reembolso parcial"
    };

    return labels[String(status||"").toLowerCase()]
      ||"Confirmado";
  }

  function customerOrderStatusLabel(status){
    const labels={
      processing:"En preparación",
      completed:"Completado",
      needs_review:"En revisión",
      cancelled:"Cancelado"
    };

    return labels[String(status||"").toLowerCase()]
      ||"En preparación";
  }

  function cleanCustomerName(fullName){
    return String(fullName||"")
      .trim()
      .replace(/\s+/g," ");
  }

  function isGenericCustomerName(fullName){
    const normalized=cleanCustomerName(fullName)
      .toLocaleLowerCase("es-MX");

    return [
      "",
      "cliente",
      "customer",
      "no especificado",
      "sin nombre",
      "prueba"
    ].includes(normalized);
  }

  function customerFirstName(fullName){
    const cleanName=cleanCustomerName(fullName);

    if(isGenericCustomerName(cleanName)){
      return "";
    }

    return cleanName.split(/\s+/)[0];
  }

  async function resolveCustomerNameForWhatsApp(order){
    const storedName=cleanCustomerName(order.customer_name);

    if(!isGenericCustomerName(storedName)){
      return storedName;
    }

    const enteredName=window.prompt(
      "Escribe el nombre del cliente para personalizar el mensaje:",
      ""
    );

    const customerName=cleanCustomerName(enteredName);

    if(!customerName){
      return "";
    }

    const {data,error}=await db
      .from("orders")
      .update({customer_name:customerName})
      .eq("id",order.id)
      .select("customer_name")
      .single();

    if(error){
      // El mensaje se personaliza aunque el guardado falle.
      showToast(
        `El nombre se usará en el mensaje, pero no pudo guardarse: ${error.message}`,
        true
      );
      return customerName;
    }

    order.customer_name=data.customer_name;
    showToast("Nombre del cliente guardado.");

    return data.customer_name;
  }

  function buildCustomerWhatsAppMessage(
    order,
    shippingCarrier="",
    trackingNumber="",
    selectedStatus=null,
    customerNameOverride=""
  ){
    const orderNumber=String(
      order.order_number||""
    ).padStart(5,"0");

    const firstName=customerFirstName(
      customerNameOverride||order.customer_name
    );

    const orderStatus=
      selectedStatus ||
      order.order_status ||
      "processing";

    const carrier=String(
      shippingCarrier||""
    ).trim();

    const tracking=String(
      trackingNumber||""
    ).trim();

    const lines=[
      firstName
        ? `Hola ${firstName} 👋`
        : "Hola 👋",
      "",
      "Gracias por tu compra en *UP AND DOWN · CABO GOLF SHOP*.",
      "",
      `Te compartimos el resumen de tu *pedido #${orderNumber}*:`,
      "",
      "*Productos:*"
    ];

    (order.order_items||[]).forEach(item=>{
      lines.push(
        `• ${Number(item.quantity)||1} × ` +
        `${item.product_name||"Producto"} — ` +
        `${money(item.line_total,order.currency)}`
      );
    });

    lines.push(
      "",
      `*Total pagado:* ${money(order.total,order.currency)}`,
      `*Estado del pago:* ${customerPaymentStatusLabel(order.payment_status)}`,
      `*Estado del pedido:* ${customerOrderStatusLabel(orderStatus)}`
    );

    if(carrier||tracking){
      lines.push(
        "",
        "*Información de envío:*",
        `Paquetería: ${carrier||"Por confirmar"}`,
        `Número de guía: ${tracking||"Por confirmar"}`
      );

      if(tracking){
        lines.push(
          "",
          "Puedes utilizar este número de guía para consultar el avance directamente con la paquetería."
        );
      }
    }else{
      lines.push(
        "",
        "Te avisaremos por este medio cuando tu pedido sea enviado y tengamos disponible el número de guía."
      );
    }

    lines.push(
      "",
      "Conserva este mensaje como referencia de tu compra.",
      "Si tienes alguna duda sobre tu pedido, responde por este medio y con gusto te apoyamos.",
      "",
      "*UP AND DOWN · CABO GOLF SHOP*"
    );

    return lines.join("\n");
  }

  function normalizeWhatsAppPhone(phone){
    let digits=String(phone||"").replace(/\D/g,"");

    if(digits.length===10){
      digits=`52${digits}`;
    }

    return digits;
  }

  async function sendOrderByWhatsApp(
    order,
    shippingCarrier,
    trackingNumber,
    selectedStatus
  ){
    const customerName=
      await resolveCustomerNameForWhatsApp(order);

    const message=buildCustomerWhatsAppMessage(
      order,
      shippingCarrier,
      trackingNumber,
      selectedStatus,
      customerName
    );

    const phone=normalizeWhatsAppPhone(
      order.customer_phone
    );

    const whatsappUrl=phone
      ? `https://wa.me/${phone}?text=${encodeURIComponent(message)}`
      : `https://wa.me/?text=${encodeURIComponent(message)}`;

    window.open(
      whatsappUrl,
      "_blank",
      "noopener,noreferrer"
    );
  }

  async function addOrderNote(
    order,
    textarea,
    button,
    timelineNode
  ){
    const details=String(textarea.value||"").trim();

    if(!details){
      showToast("Escribe la actualización antes de guardarla.",true);
      textarea.focus();
      return;
    }

    button.disabled=true;
    button.textContent="Guardando…";

    const {data,error}=await db
      .from("order_activity_log")
      .insert({
        order_id:order.id,
        event_type:"note",
        title:"Nota administrativa",
        details
      })
      .select(`
        id,
        event_type,
        title,
        details,
        old_value,
        new_value,
        created_by_email,
        created_at
      `)
      .single();

    if(error){
      showToast(error.message,true);
      button.disabled=false;
      button.textContent="Agregar a la bitácora";
      return;
    }

    order.order_activity_log=[
      data,
      ...(order.order_activity_log||[])
    ];

    textarea.value="";
    timelineNode.innerHTML=renderOrderTimeline(order);

    const counter=timelineNode
      .closest(".u-order-notes-box")
      ?.querySelector(".u-activity-heading span");

    if(counter){
      const total=sortedOrderActivity(order).length;
      counter.textContent=`${total} evento${total===1?"":"s"}`;
    }

    button.disabled=false;
    button.textContent="Agregar a la bitácora";

    showToast("Actualización agregada a la bitácora.");
    renderOrders();
  }

  async function saveShippingData(
    order,
    shippingCarrier,
    trackingNumber,
    button
  ){
    if(button.disabled) return;

    const carrier=String(shippingCarrier||"").trim();
    const tracking=String(trackingNumber||"").trim();

    button.disabled=true;
    button.textContent="Guardando…";

    const payload={
      shipping_carrier:carrier||null,
      tracking_number:tracking||null,
      shipped_at:carrier||tracking
        ? new Date().toISOString()
        : null
    };

    const {data,error}=await db
      .from("orders")
      .update(payload)
      .eq("id",order.id)
      .select("shipping_carrier,tracking_number,shipped_at")
      .single();

    if(error){
      showToast(error.message,true);
      button.disabled=false;
      button.textContent="Guardar envío";
      return;
    }

    order.shipping_carrier=data.shipping_carrier;
    order.tracking_number=data.tracking_number;
    order.shipped_at=data.shipped_at;

    await refreshOrderActivity(order.id);

    showToast("Datos de envío guardados y registrados en la bitácora.");
    button.disabled=false;
    button.textContent="Guardar envío";
    renderOrders();
  }

  async function updateOrderStatus(orderId,newStatus,button){
    if(button.disabled) return;

    button.disabled=true;
    button.textContent="Guardando…";

    const {error}=await db
      .from("orders")
      .update({order_status:newStatus})
      .eq("id",orderId);

    if(error){
      showToast(error.message,true);
      button.disabled=false;
      button.textContent="Guardar estado";
      return;
    }

    const order=orders.find(item=>item.id===orderId);
    if(order) order.order_status=newStatus;

    await refreshOrderActivity(orderId);

    showToast("Estado actualizado y registrado en la bitácora.");
    renderOrders();
  }

  function switchAdminView(view){
    const showProducts=view==="products";

    el("udProductsView").classList.toggle("u-hidden",!showProducts);
    el("udOrdersView").classList.toggle("u-hidden",showProducts);
    el("udProductsTab").classList.toggle("is-active",showProducts);
    el("udOrdersTab").classList.toggle("is-active",!showProducts);

    if(!showProducts){
      loadOrders();
    }
  }

  function normalizedProductGallery(product){
    const rows=Array.isArray(product?.product_images)?[...product.product_images]:[];
    rows.sort((a,b)=>Number(Boolean(b.is_primary))-Number(Boolean(a.is_primary))||Number(a.sort_order||0)-Number(b.sort_order||0));
    const gallery=rows.map((row,index)=>({key:`existing:${row.id||index}`,source:"existing",id:row.id||null,url:row.image_url||"",file:null,is_primary:Boolean(row.is_primary),removed:false})).filter(item=>item.url);
    if(product?.cover_image_url&&!gallery.some(item=>item.url===product.cover_image_url))gallery.unshift({key:"cover:legacy",source:"existing",id:null,url:product.cover_image_url,file:null,is_primary:true,removed:false});
    if(gallery.length&&!gallery.some(item=>item.is_primary))gallery[0].is_primary=true;
    return gallery.slice(0,10);
  }
  function activeGalleryItems(){return productGalleryState.filter(item=>!item.removed)}
  function ensureGalleryPrimary(){
    const active=activeGalleryItems();
    if(!active.length)return;
    if(!active.some(item=>item.is_primary))active[0].is_primary=true;
    const primary=active.find(item=>item.is_primary);
    productGalleryState.forEach(item=>{if(!item.removed)item.is_primary=item===primary});
  }
  function renderGalleryEditor(){
    ensureGalleryPrimary();
    const grid=el("udGalleryGrid"),active=activeGalleryItems();
    el("udGalleryCount").textContent=`${active.length} / 10`;
    if(!active.length){grid.innerHTML='<div class="u-gallery-empty">Agrega al menos una imagen para mostrar el producto correctamente.</div>';return}
    grid.innerHTML=active.map(item=>`<article class="u-gallery-item ${item.is_primary?"is-primary":""}" data-gallery-key="${escapeHtml(item.key)}"><img src="${escapeHtml(item.url)}" alt="Vista previa">${item.is_primary?'<span class="u-gallery-badge">Principal</span>':""}<div class="u-gallery-actions"><button class="make-primary" type="button">${item.is_primary?"Principal":"Hacer principal"}</button><button class="remove" type="button">×</button></div></article>`).join("");
    grid.querySelectorAll("[data-gallery-key]").forEach(card=>{
      const item=productGalleryState.find(entry=>entry.key===card.dataset.galleryKey);if(!item)return;
      card.querySelector(".make-primary").onclick=()=>{productGalleryState.forEach(entry=>entry.is_primary=false);item.is_primary=true;renderGalleryEditor()};
      card.querySelector(".remove").onclick=()=>{item.removed=true;item.is_primary=false;renderGalleryEditor()};
    });
  }
  function addGalleryFiles(fileList){
    const files=[...(fileList||[])];
    if(!files.length)return;
    const activeCount=activeGalleryItems().length;
    const available=Math.max(0,10-activeCount);
    if(!available){showToast("Ya alcanzaste el máximo de 10 imágenes.",true);return}
    const accepted=files.slice(0,available);
    if(files.length>available)showToast(`Solo se agregaron ${available} imagen${available===1?"":"es"}; el máximo es 10.`,true);
    for(const file of accepted){
      if(file.size>10*1024*1024){showToast(`${file.name} supera 10 MB y no se agregó.`,true);continue}
      const url=URL.createObjectURL(file);
      productGalleryState.push({key:`new:${crypto.randomUUID()}`,source:"new",id:null,url,file,is_primary:activeGalleryItems().length===0,removed:false});
    }
    renderGalleryEditor();
  }

  function renderProducts(){
    el("udCount").textContent=`${products.filter(p=>p.status==="active").length} activos · ${products.filter(p=>p.status==="draft").length} borradores por completar · ${products.length} en total`;
    if(!products.length){
      el("udList").innerHTML='<div class="u-empty">No hay productos registrados.</div>';
      return;
    }

    el("udList").innerHTML="";
    products.forEach(product=>{
      const item=document.createElement("article");
      item.className="u-item";
      item.innerHTML=`
        <img src="${product.cover_image_url||""}" alt="">
        <div>
          <h3>${product.name}</h3>
          <div class="u-meta">${product.categories?.name||"Sin categoría"} · SKU ${product.sku} · Stock ${product.stock} · ${product.status==="draft"?"Borrador · Pendiente de completar":product.status}</div>
          <div class="u-meta u-price">${money(product.sale_price??product.price)}</div>
          ${(()=>{
            const specs=product.specifications||{};
            const values=[
              specFromObject(specs,["loft","grados","degree"]),
              specFromObject(specs,["hand","mano","dexterity","orientacion"]),
              specFromObject(specs,["flex","shaft flex","flexibilidad"])
            ].filter(Boolean);
            return values.length?`<div class="u-product-spec-summary">${values.map(value=>`<span class="u-product-spec-chip">${escapeHtml(value)}</span>`).join("")}</div>`:"";
          })()}
        </div>
        <div class="u-item-actions">
          <button class="u-btn u-secondary u-small ud-edit" type="button">Editar</button>
          <button class="u-btn u-danger u-small ud-delete" type="button">Eliminar</button>
        </div>`;
      item.querySelector(".ud-edit").onclick=()=>editProduct(product.id);
      item.querySelector(".ud-delete").onclick=()=>deleteProduct(product.id);
      el("udList").appendChild(item);
    });
  }

  function editProduct(id){
    const p=products.find(item=>item.id===id);
    if(!p) return;
    el("udProductId").value=p.id;
    el("udExistingImage").value=p.cover_image_url||"";
    el("udName").value=p.name||"";
    el("udSku").value=p.sku||"";
    el("udCategory").value=p.category_id||"";
    el("udCondition").value=p.item_condition||"new";
    el("udBrand").value=p.brand||"";
    el("udModel").value=p.model||"";
    el("udPrice").value=p.price??"";
    el("udSalePrice").value=p.sale_price??"";
    el("udStock").value=p.stock??0;
    el("udStatus").value=p.status||"active";
    el("udShort").value=p.short_description||"";
    el("udDescription").value=p.description||"";
    fillGolfSpecifications(p.specifications||{});
    el("udFeatured").checked=!!p.featured;
    el("udImage").value="";
    productGalleryState=normalizedProductGallery(p);
    renderGalleryEditor();

    el("udFormTitle").textContent="Editar producto";
    el("udSave").textContent="Actualizar producto";
    el("udCancel").classList.remove("u-hidden");
    window.scrollTo({top:0,behavior:"smooth"});
  }

  function resetForm(){
    el("udProductForm").reset();
    el("udProductId").value="";
    el("udExistingImage").value="";
    el("udStock").value=0;
    el("udStatus").value="active";
    el("udCondition").value="new";
    currentProductSpecifications={};
    fillGolfSpecifications({});
    productGalleryState=[];
    renderGalleryEditor();
    el("udPreview").removeAttribute("src");
    el("udPreview").classList.remove("u-show");
    el("udFormTitle").textContent="Nuevo producto";
    el("udSave").textContent="Guardar producto";
    el("udCancel").classList.add("u-hidden");
    setMessage(el("udFormMessage"));
  }

  el("udCategory").addEventListener("change",updateGolfSpecsVisibility);
  el("udCondition").addEventListener("change",updateGolfSpecsVisibility);

  el("udNew").onclick=()=>{resetForm();window.scrollTo({top:0,behavior:"smooth"})};
  el("udCancel").onclick=resetForm;

  el("udImage").addEventListener("change",()=>{
    addGalleryFiles(el("udImage").files);
    el("udImage").value="";
  });

  async function uploadImage(file,slug){
    const extension=(file.name.split(".").pop()||"jpg").toLowerCase();
    const path=`products/${slug}/${Date.now()}-${crypto.randomUUID()}.${extension}`;
    const {error}=await db.storage.from("product-media").upload(path,file,{upsert:false,contentType:file.type});
    if(error) throw error;
    const {data}=db.storage.from("product-media").getPublicUrl(path);
    return data.publicUrl;
  }

  el("udProductForm").addEventListener("submit",async event=>{
    event.preventDefault();
    setMessage(el("udFormMessage"));

    const id=el("udProductId").value;
    const name=el("udName").value.trim();
    const slug=slugify(name);
    const previousImage=el("udExistingImage").value;
    const price=Number(el("udPrice").value);
    const saleRaw=el("udSalePrice").value.trim();
    const salePrice=saleRaw===""?null:Number(saleRaw);

    if(!activeGalleryItems().length){setMessage(el("udFormMessage"),"Agrega al menos una imagen del producto.",true);return}
    if(salePrice!==null&&salePrice>price){setMessage(el("udFormMessage"),"El precio de oferta no puede superar el precio normal.",true);return}

    el("udSave").disabled=true;
    el("udSave").textContent="Guardando…";

    try{
      const activeGallery=activeGalleryItems();
      for(const item of activeGallery){
        if(item.source==="new"&&item.file){
          item.uploaded_url=await uploadImage(item.file,slug);
        }
      }
      const galleryForSave=activeGallery.map(item=>({...item,final_url:item.source==="new"?item.uploaded_url:item.url})).filter(item=>item.final_url);
      ensureGalleryPrimary();
      const primaryItem=galleryForSave.find(item=>item.is_primary)||galleryForSave[0];
      const imageUrl=primaryItem?.final_url||previousImage;

      const payload={
        category_id:el("udCategory").value,
        sku:el("udSku").value.trim(),
        name,slug,
        brand:el("udBrand").value.trim()||null,
        model:el("udModel").value.trim()||null,
        item_condition:el("udCondition").value,
        short_description:el("udShort").value.trim()||null,
        description:el("udDescription").value.trim()||null,
        specifications:buildGolfSpecifications(),
        currency:"MXN",
        price,
        sale_price:salePrice,
        stock:Number(el("udStock").value),
        low_stock_threshold:2,
        cover_image_url:imageUrl,
        featured:el("udFeatured").checked,
        status:el("udStatus").value,
        seo_title:`${name} | UP AND DOWN`,
        seo_description:el("udShort").value.trim()||null
      };

      let saved;
      if(id){
        const {data,error}=await db.from("products").update(payload).eq("id",id).select().single();
        if(error) throw error;
        saved=data;
      }else{
        const {data,error}=await db.from("products").insert(payload).select().single();
        if(error) throw error;
        saved=data;
      }

      const {error:deleteError}=await db.from("product_images").delete().eq("product_id",saved.id);
      if(deleteError) throw deleteError;

      const galleryRows=galleryForSave.slice(0,10).map((item,index)=>({
        product_id:saved.id,
        image_url:item.final_url,
        alt_text:`${name} · imagen ${index+1}`,
        sort_order:index+1,
        is_primary:item===primaryItem
      }));
      const {error:galleryError}=await db.from("product_images").insert(galleryRows);
      if(galleryError) throw galleryError;

      showToast(id?"Producto actualizado.":"Producto creado.");
      resetForm();
      await loadProducts();
    }catch(error){
      setMessage(el("udFormMessage"),error.message,true);
    }finally{
      el("udSave").disabled=false;
      el("udSave").textContent=el("udProductId").value?"Actualizar producto":"Guardar producto";
    }
  });

  async function deleteProduct(id){
    const product=products.find(item=>item.id===id);
    if(!product||!confirm(`¿Eliminar "${product.name}"?`)) return;
    const {error}=await db.from("products").delete().eq("id",id);
    if(error){showToast(error.message,true);return}
    showToast("Producto eliminado.");
    resetForm();
    await loadProducts();
  }

  el("udProductsTab").onclick=()=>switchAdminView("products");
  el("udOrdersTab").onclick=()=>switchAdminView("orders");
  el("udRefreshOrders").onclick=loadOrders;
  el("udOrderSearch").addEventListener("input",renderOrders);
  el("udOrderFilter").addEventListener("change",renderOrders);

  fillGolfSpecifications({});
  updateGolfSpecsVisibility();
  initialize();
})();
