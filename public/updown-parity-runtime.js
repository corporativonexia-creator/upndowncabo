(function(){
  window.__UPDOWN_PARITY_VERSION__="2B.1-UX5.0-H54";

  const SUPABASE_URL=window.__UPDOWN_SUPABASE_URL__;
  const SUPABASE_KEY=window.__UPDOWN_SUPABASE_PUBLISHABLE_KEY__;
  if(!SUPABASE_URL||!SUPABASE_KEY)throw new Error("UP AND DOWN: faltan variables pÃºblicas de Supabase.");
  const db=window.supabase.createClient(SUPABASE_URL,SUPABASE_KEY);
  const el=id=>document.getElementById(id);
  let products=[],filteredProducts=[],categories=[],activeCategory="all",modalProduct=null;
  let modalGalleryImages=[],modalGalleryIndex=0;
  let udsViewerScrollY=0;
  let udsViewerPreviousBodyStyle=null;
  let currentLanguage=localStorage.getItem("upDownLanguage")||"es";
  let activeCollection="";
  let cart=JSON.parse(localStorage.getItem("upDownCart")||"[]");
  const conditionLabels={new:"Nuevo",preowned:"Seminuevo",demo:"Demo"};
  const conditionLabelsEn={new:"New",preowned:"Pre-owned",demo:"Demo"};
  const AFFILIATE_STORAGE_KEY="upDownAffiliateReferral",AFFILIATE_DURATION_DAYS=30;
  const CATALOG_CACHE_KEY="upDownCatalogCacheV1";
  const QUERY_TIMEOUT_MS=8000;

  function timeoutSignal(ms=QUERY_TIMEOUT_MS){
    if(typeof AbortSignal!=="undefined"&&typeof AbortSignal.timeout==="function"){
      return AbortSignal.timeout(ms);
    }
    const controller=new AbortController();
    setTimeout(()=>controller.abort(),ms);
    return controller.signal;
  }

  function revealCatalog(){
    el("udsStatus")?.classList.add("uds-hidden");
    el("udsGrid")?.classList.remove("uds-hidden");
  }

  function renderCatalogState(){
    filteredProducts=[...products];
    renderCategories();
    renderCommerceFilters();
    renderPicks();
    renderNewArrivals();
    renderAdvisorBar();
    applyFilters();
    localizeStaticDom(currentLanguage);
    localizeWhatsAppLinks(currentLanguage);
  }

  function restoreCatalogCache(){
    try{
      const cached=JSON.parse(localStorage.getItem(CATALOG_CACHE_KEY)||"null");
      if(!Array.isArray(cached?.products)||!Array.isArray(cached?.categories))return false;
      products=cached.products;
      categories=cached.categories;
      renderCatalogState();
      revealCatalog();
      return true;
    }catch(error){
      localStorage.removeItem(CATALOG_CACHE_KEY);
      return false;
    }
  }

  function saveCatalogCache(){
    try{
      localStorage.setItem(CATALOG_CACHE_KEY,JSON.stringify({
        savedAt:Date.now(),
        products,
        categories
      }));
    }catch(error){
      console.warn("[UPDOWN catalog cache]",error);
    }
  }

  function escapeHtml(value=""){return String(value).replaceAll("&","&amp;").replaceAll("<","&lt;").replaceAll(">","&gt;").replaceAll('"',"&quot;").replaceAll("'","&#039;")}
  function money(value,currency="MXN"){
    const code=String(currency||"MXN").toUpperCase();
    const locale=currentLanguage==="en"?"en-US":"es-MX";
    const formatted=new Intl.NumberFormat(locale,{style:"currency",currency:code,currencyDisplay:"narrowSymbol",maximumFractionDigits:2}).format(Number(value||0));
    return `${code} ${formatted}`;
  }
  function showToast(message){const n=el("udsToast");n.textContent=message;n.classList.add("is-show");clearTimeout(showToast.timer);showToast.timer=setTimeout(()=>n.classList.remove("is-show"),2600)}
  function normalizeAffiliateCode(v){return String(v||"").trim().toUpperCase().replace(/\s+/g,"").replace(/[^A-Z0-9_-]/g,"")}
  function readAffiliateCodeFromUrl(){
    const candidates=[];try{candidates.push(window.location.href)}catch(e){}
    try{if(window.top&&window.top.location)candidates.push(window.top.location.href)}catch(e){}
    for(const candidate of [...new Set(candidates.filter(Boolean))]){
      try{const u=new URL(candidate,window.location.origin),code=normalizeAffiliateCode(u.searchParams.get("ref"));if(code)return code}catch(e){}
      const m=String(candidate).match(/[?&#]ref=([^&#]+)/i);if(m){const code=normalizeAffiliateCode(decodeURIComponent(m[1]));if(code)return code}
    }return "";
  }
  function getStoredAffiliate(){
    try{const s=JSON.parse(localStorage.getItem(AFFILIATE_STORAGE_KEY)||"null");if(!s?.code||!s?.expires_at)return null;
      if(Date.now()>=Number(s.expires_at)){localStorage.removeItem(AFFILIATE_STORAGE_KEY);return null}return s
    }catch(e){localStorage.removeItem(AFFILIATE_STORAGE_KEY);return null}
  }
  function setAffiliateCodeInLocation(targetWindow,code){
    try{const c=normalizeAffiliateCode(code);if(!c)return false;const u=new URL(targetWindow.location.href);
      if(normalizeAffiliateCode(u.searchParams.get("ref"))===c)return false;u.searchParams.set("ref",c);
      const replacement=u.pathname+(u.searchParams.toString()?`?${u.searchParams}`:"")+u.hash;
      targetWindow.history.replaceState({},targetWindow.document?.title||document.title,replacement);return true
    }catch(e){return false}
  }
  function syncStoredAffiliateReferenceInUrl(){
    const a=getStoredAffiliate();if(!a?.code)return false;let changed=setAffiliateCodeInLocation(window,a.code);
    try{if(window.top&&window.top!==window)changed=setAffiliateCodeInLocation(window.top,a.code)||changed}catch(e){}return changed
  }
  async function captureAffiliateReference(){
    const code=readAffiliateCodeFromUrl();if(!code)return getStoredAffiliate();
    const {data,error}=await db.rpc("resolve_affiliate_ref",{p_code:code}).abortSignal(timeoutSignal());if(error){console.warn(error);return getStoredAffiliate()}
    const seller=Array.isArray(data)?data[0]:null;if(!seller?.code)return getStoredAffiliate();
    const ref={seller_id:seller.seller_id,code:seller.code,seller_name:seller.seller_name,seller_phone:seller.seller_phone||seller.phone||null,captured_at:Date.now(),expires_at:Date.now()+AFFILIATE_DURATION_DAYS*86400000};
    localStorage.setItem(AFFILIATE_STORAGE_KEY,JSON.stringify(ref));return ref
  }

  function cartUnits(){return cart.reduce((s,i)=>s+Number(i.quantity||0),0)}
  function cartTotal(){return cart.reduce((s,i)=>s+Number(i.price||0)*Number(i.quantity||0),0)}
  function saveCart(){localStorage.setItem("upDownCart",JSON.stringify(cart));renderCart()}
  async function reconcileCart(options={}){
    const silent=Boolean(options.silent);

    if(!cart.length){
      renderCart();
      return {changed:false,adjustments:[]};
    }

    const productIds=[
      ...new Set(
        cart
          .map(item=>item.id)
          .filter(Boolean)
      )
    ];

    const {data,error}=await db
      .from("products")
      .select(`
        id,
        name,
        slug,
        currency,
        price,
        sale_price,
        stock,
        cover_image_url,
        specifications,
        brand,
        model,
        item_condition,
        status
      `)
      .in("id",productIds)
      .eq("status","active")
      .abortSignal(timeoutSignal());

    if(error) throw error;

    const currentProducts=new Map(
      (data||[]).map(product=>[product.id,product])
    );

    const reconciled=[];
    const adjustments=[];
    let changed=false;

    cart.forEach(item=>{
      const current=currentProducts.get(item.id);

      if(!current){
        adjustments.push(
          currentLanguage==="en"?`${item.name} is no longer available and was removed from your cart.`:`${item.name} ya no está disponible y se retirÃ³ del carrito.`
        );
        changed=true;
        return;
      }

      const currentStock=Number(current.stock||0);

      if(currentStock<=0){
        adjustments.push(
          currentLanguage==="en"?`${current.name} is sold out and was removed from your cart.`:`${current.name} está agotado y se retirÃ³ del carrito.`
        );
        changed=true;
        return;
      }

      const previousQuantity=Math.max(
        1,
        Number(item.quantity||1)
      );

      const validQuantity=Math.min(
        previousQuantity,
        currentStock
      );

      const currentPrice=Number(
        current.sale_price??current.price
      );

      if(validQuantity!==previousQuantity){
        adjustments.push(
          currentLanguage==="en"?`${current.name} was adjusted to ${validQuantity} unit${validQuantity===1?"":"s"} based on availability.`:`${current.name} se ajustÃ³ a ${validQuantity} unidad${validQuantity===1?"":"es"} por disponibilidad.`
        );
        changed=true;
      }

      if(
        Number(item.price)!==currentPrice ||
        Number(item.stock)!==currentStock ||
        item.name!==current.name ||
        item.image!==current.cover_image_url
      ){
        changed=true;
      }

      reconciled.push({
        id:current.id,
        name:current.name,
        slug:current.slug,
        image:current.cover_image_url,
        price:currentPrice,
        currency:current.currency||"MXN",
        stock:currentStock,
        quantity:validQuantity,
        summary:golfSummary(current)
      });
    });

    cart=reconciled;

    localStorage.setItem(
      "upDownCart",
      JSON.stringify(cart)
    );

    renderCart();

    if(!silent&&adjustments.length){
      const message=
        adjustments.length===1
          ? adjustments[0]
          : currentLanguage==="en"?`We updated ${adjustments.length} items in your cart due to inventory changes.`:`Actualizamos ${adjustments.length} artÃ­culos de tu carrito por cambios de inventario.`;

      showToast(message);
    }

    return {changed,adjustments};
  }

  function renderCart(){
    const units=cartUnits(),total=cartTotal();

    const cartCount=el("udsCartCount");
    const floatingCount=el("udsFloatingCount");
    const floatingTotal=el("udsFloatingTotal");
    const dockCount=el("udsDockCount");
    const checkoutButton=el("udsCheckoutButton");
    const cartTotalNode=el("udsCartTotal");
    const cartList=el("udsCartList");

    if(cartCount)cartCount.textContent=units;
    if(floatingCount)floatingCount.textContent=units;
    if(floatingTotal)floatingTotal.textContent=money(total);
    if(dockCount)dockCount.textContent=units;
    if(checkoutButton)checkoutButton.disabled=!cart.length;
    if(cartTotalNode)cartTotalNode.textContent=money(total);

    if(!cartList)return;

    if(!cart.length){
      cartList.innerHTML=`<div class="uds-no-results">${currentLanguage==="en"?"Your cart is ready for your next selection.":"Tu carrito está listo para tu prÃ³xima selecciÃ³n."}</div>`;
      return;
    }

    cartList.innerHTML="";
    cart.forEach(item=>{const row=document.createElement("article");row.className="uds-cart-item";
      row.innerHTML=`<img src="${escapeHtml(item.image||"")}" alt="${escapeHtml(item.name)}"><div><h4>${escapeHtml(item.name)}</h4><div class="uds-cart-meta">${item.summary?`${escapeHtml(item.summary)} · `:""}${money(item.price,item.currency)} ${currentLanguage==="en"?"each":"c/u"}</div><div class="uds-qty"><button class="uds-minus" type="button" aria-label="${currentLanguage==="en"?"Decrease quantity":"Restar"}">âˆ’</button><strong>${item.quantity}</strong><button class="uds-plus" type="button" aria-label="${currentLanguage==="en"?"Increase quantity":"Sumar"}">+</button></div></div><button class="uds-remove" type="button" aria-label="${currentLanguage==="en"?"Remove":"Eliminar"}">Ã—</button>`;
      row.querySelector(".uds-minus").onclick=()=>changeQty(item.id,-1);row.querySelector(".uds-plus").onclick=()=>changeQty(item.id,1);row.querySelector(".uds-remove").onclick=()=>removeFromCart(item.id);el("udsCartList").appendChild(row)
    })
  }
  function addToCart(product){
    if(Number(product.stock)<=0){showToast(currentLanguage==="en"?"This product is sold out.":"Este producto está agotado.");return}
    const ex=cart.find(i=>i.id===product.id);if(ex){if(ex.quantity>=Number(product.stock)){showToast(currentLanguage==="en"?"You have reached the available stock.":"Ya alcanzaste el stock disponible.");return}ex.quantity+=1}
    else cart.push({id:product.id,name:product.name,slug:product.slug,image:product.cover_image_url,price:Number(product.sale_price??product.price),currency:product.currency||"MXN",stock:Number(product.stock),quantity:1,summary:golfSummary(product)});
    saveCart();showToast(currentLanguage==="en"?`${product.name} added to cart.`:`${product.name} agregado al carrito.`)
  }
  function changeQty(id,d){const item=cart.find(i=>i.id===id);if(!item)return;const next=item.quantity+d;if(next<=0)return removeFromCart(id);if(next>item.stock)return showToast(currentLanguage==="en"?"No more units are available.":"No hay mÃ¡s unidades disponibles.");item.quantity=next;saveCart()}
  function removeFromCart(id){cart=cart.filter(i=>i.id!==id);saveCart()}

  function openOverlay(){el("udsOverlay").classList.add("is-open");document.body.style.overflow="hidden"}
  function openCart(){closePanels(false);openOverlay();el("udsCart").classList.add("is-open");el("udsCart").setAttribute("aria-hidden","false")}
  function openMenu(){
    closePanels(false);
    openOverlay();

    const mobileMenu=el("udsMobileMenu");
    const mobileMenuContent=el("udsMobileCategories");

    mobileMenu.classList.add("is-open");
    mobileMenu.setAttribute("aria-hidden","false");

    if(mobileMenuContent){
      mobileMenuContent.scrollTop=0;
    }
  }
  function closePanels(closeOverlay=true){
    el("udsCart").classList.remove("is-open");el("udsMobileMenu").classList.remove("is-open");el("udsModal").classList.remove("is-open");el("udsSuccessModal").classList.remove("is-open");
    ["udsCart","udsMobileMenu","udsModal","udsSuccessModal"].forEach(id=>el(id).setAttribute("aria-hidden","true"));

    const viewer=el("udsImageViewer");
    if(viewer){
      const viewerWasOpen=viewer.classList.contains("is-open");
      viewer.classList.remove("is-open");
      viewer.setAttribute("aria-hidden","true");
      if(viewerWasOpen)unlockDocumentFromImageViewer();
    }

    if(closeOverlay){el("udsOverlay").classList.remove("is-open");document.body.style.overflow=""}
  }

  function normalizeSpecKey(value=""){
    return String(value).normalize("NFD").replace(/[\u0300-\u036f]/g,"").toLowerCase().replace(/[^a-z0-9]+/g," ").trim();
  }
  function displaySpecValue(value){
    if(value===null||value===undefined) return "";
    if(Array.isArray(value)) return value.map(displaySpecValue).filter(Boolean).join(" / ");
    if(typeof value==="object") return "";
    return String(value).trim();
  }
  function specValue(product,aliases=[]){
    const specs=product?.specifications&&typeof product.specifications==="object"?product.specifications:{};
    const normalizedAliases=aliases.map(normalizeSpecKey);
    for(const [key,value] of Object.entries(specs)){
      const nk=normalizeSpecKey(key);
      if(normalizedAliases.some(alias=>nk===alias||nk.includes(alias)||alias.includes(nk))){
        const display=displaySpecValue(value);if(display)return display;
      }
    }
    return "";
  }
  function normalizeHand(value=""){
    const raw=String(value).trim();const n=normalizeSpecKey(raw);
    if(!raw)return "";
    if(/right|rh|diestro|derech/.test(n))return currentLanguage==="en"?"RH":"Diestro";
    if(/left|lh|zurdo|izquierd/.test(n))return currentLanguage==="en"?"LH":"Zurdo";
    return raw;
  }
  function rawGolfSpecs(product){
    return {
      hand:specValue(product,["hand","mano","dexterity","orientacion"]),
      loft:specValue(product,["loft","grados","degree"]),
      flex:specValue(product,["flex","shaft flex","flexibilidad"]),
      shaft:specValue(product,["shaft","varilla","eje"]),
      grip:specValue(product,["grip","empunadura"]),
      player:specValue(product,["ideal para","para que jugador","jugador","player profile","player","recommended for","recomendado para"])
    };
  }
  function golfSpecChips(product,limit=3){
    const g=rawGolfSpecs(product);const values=[];
    if(g.loft)values.push(g.loft);
    if(g.hand)values.push(normalizeHand(g.hand));
    if(g.flex)values.push(g.flex);
    if(g.shaft)values.push(g.shaft);
    return [...new Set(values.filter(Boolean))].slice(0,limit);
  }
  function golfSummary(product){return golfSpecChips(product,3).join(" · ")}
  function isClubProduct(product){
    const text=[product?.categories?.name,product?.categories?.slug,product?.name].filter(Boolean).join(" ").toLowerCase();
    return /(driver|hierro|iron|wedge|putter|hibrid|hybrid|madera|wood|palo|club)/.test(text);
  }
  function productGallery(product){
    const rows=Array.isArray(product?.product_images)?[...product.product_images]:[];
    rows.sort((a,b)=>Number(Boolean(b.is_primary))-Number(Boolean(a.is_primary))||Number(a.sort_order||0)-Number(b.sort_order||0));
    const urls=[];
    const add=url=>{const clean=String(url||"").trim();if(clean&&!urls.includes(clean))urls.push(clean)};
    add(product?.cover_image_url);
    rows.forEach(row=>add(row?.image_url));
    return urls.slice(0,10);
  }
  function renderModalGallery(index=0){
    const images=modalGalleryImages.length?modalGalleryImages:[modalProduct?.cover_image_url||""];
    modalGalleryIndex=Math.max(0,Math.min(Number(index)||0,images.length-1));
    const image=images[modalGalleryIndex]||"";

    el("udsModalImage").src=image;
    el("udsModalImage").alt=`${modalProduct?.name||(currentLanguage==="en"?"Product":"Producto")} · ${currentLanguage==="en"?"image":"imagen"} ${modalGalleryIndex+1}`;
    el("udsModalGalleryCount").textContent=`${modalGalleryIndex+1} / ${images.length}`;

    const single=images.length<=1;
    el("udsModalPrev").disabled=single;
    el("udsModalNext").disabled=single;

    // Thumbnails are intentionally retired from the premium product view.
    // Navigation now lives on top of the image itself.
    const thumbs=el("udsModalThumbs");
    if(thumbs)thumbs.innerHTML="";

    if(el("udsImageViewer")?.classList.contains("is-open")){
      renderImageViewer();
    }
  }

  function moveModalGallery(delta){
    if(modalGalleryImages.length<=1)return;
    const next=(modalGalleryIndex+delta+modalGalleryImages.length)%modalGalleryImages.length;
    renderModalGallery(next);
  }

  function renderImageViewer(){
    const images=modalGalleryImages.length?modalGalleryImages:[modalProduct?.cover_image_url||""];
    const image=images[modalGalleryIndex]||"";
    const viewerImage=el("udsImageViewerImage");
    if(viewerImage){
      viewerImage.src=image;
      viewerImage.alt=`${modalProduct?.name||(currentLanguage==="en"?"Product":"Producto")} · ${currentLanguage==="en"?"image":"imagen"} ${modalGalleryIndex+1}`;
    }
    el("udsImageViewerCount").textContent=`${modalGalleryIndex+1} / ${images.length}`;
    const single=images.length<=1;
    el("udsImageViewerPrev").disabled=single;
    el("udsImageViewerNext").disabled=single;
  }

  function lockDocumentForImageViewer(){
    udsViewerScrollY=window.scrollY||window.pageYOffset||0;

    if(!udsViewerPreviousBodyStyle){
      udsViewerPreviousBodyStyle={
        position:document.body.style.position,
        top:document.body.style.top,
        left:document.body.style.left,
        right:document.body.style.right,
        width:document.body.style.width,
        overflow:document.body.style.overflow
      };
    }

    document.documentElement.classList.add("uds-image-viewer-open");
    document.body.classList.add("uds-image-viewer-open");

    document.body.style.position="fixed";
    document.body.style.top=`-${udsViewerScrollY}px`;
    document.body.style.left="0";
    document.body.style.right="0";
    document.body.style.width="100%";
    document.body.style.overflow="hidden";
  }

  function unlockDocumentFromImageViewer(){
    document.documentElement.classList.remove("uds-image-viewer-open");
    document.body.classList.remove("uds-image-viewer-open");

    if(udsViewerPreviousBodyStyle){
      document.body.style.position=udsViewerPreviousBodyStyle.position;
      document.body.style.top=udsViewerPreviousBodyStyle.top;
      document.body.style.left=udsViewerPreviousBodyStyle.left;
      document.body.style.right=udsViewerPreviousBodyStyle.right;
      document.body.style.width=udsViewerPreviousBodyStyle.width;
      document.body.style.overflow=udsViewerPreviousBodyStyle.overflow;
      udsViewerPreviousBodyStyle=null;
    }

    window.scrollTo(0,udsViewerScrollY);
  }

  let udsProductModalSavedScroll=0;

  function openImageViewer(){
    if(!modalProduct)return;
    renderImageViewer();
    const viewer=el("udsImageViewer");
    if(!viewer)return;

    const productModal=el("udsModal"); udsProductModalSavedScroll=productModal?.scrollTop||0; lockDocumentForImageViewer();
    viewer.classList.add("is-open");
    viewer.setAttribute("aria-hidden","false");
  }

  function closeImageViewer(){
    const viewer=el("udsImageViewer");
    if(!viewer)return;

    viewer.classList.remove("is-open");
    viewer.setAttribute("aria-hidden","true");
    unlockDocumentFromImageViewer(); requestAnimationFrame(()=>{const productModal=el("udsModal");if(productModal?.classList.contains("is-open"))productModal.scrollTop=udsProductModalSavedScroll;});

    // Product modal stays open behind the viewer.
    if(el("udsModal")?.classList.contains("is-open")){
      document.body.style.overflow="hidden";
    }
  }

  function moveImageViewer(delta){
    if(modalGalleryImages.length<=1)return;
    moveModalGallery(delta);
    renderImageViewer();
  }

  function bindHorizontalSwipe(target,onSwipe){
    if(!target)return;
    let startX=0;
    let startY=0;
    let tracking=false;

    target.addEventListener("touchstart",event=>{
      const touch=event.touches?.[0];
      if(!touch)return;
      startX=touch.clientX;
      startY=touch.clientY;
      tracking=true;
    },{passive:true});

    target.addEventListener("touchend",event=>{
      if(!tracking)return;
      tracking=false;
      const touch=event.changedTouches?.[0];
      if(!touch)return;

      const dx=touch.clientX-startX;
      const dy=touch.clientY-startY;

      // Only treat a deliberate horizontal gesture as gallery navigation.
      if(Math.abs(dx)<46||Math.abs(dx)<=Math.abs(dy))return;
      onSwipe(dx<0?1:-1);
    },{passive:true});
  }

  function stockCopy(stock){
    stock=Number(stock||0);
    if(stock<=0)return {text:currentLanguage==="en"?"Sold out":"Agotado",cls:"is-out"};
    if(stock===1)return {text:currentLanguage==="en"?"Last one":"Ãšltima pieza",cls:"is-low"};
    if(stock<=3)return {text:currentLanguage==="en"?"Low stock":"Pocas unidades",cls:"is-low"};
    return {text:currentLanguage==="en"?"Available":"Disponible",cls:""};
  }
  function cardHtml(product){
    const price=product.sale_price??product.price;
    const discount=product.sale_price!==null&&Number(product.sale_price)<Number(product.price);
    const stock=stockCopy(product.stock);
    const condition=(currentLanguage==="en"?conditionLabelsEn:conditionLabels)[product.item_condition]||(currentLanguage==="en"?"Product":"Producto");
    const pick="";
    return `<div class="uds-card-media"><img src="${escapeHtml(product.cover_image_url||"")}" alt="${escapeHtml(product.name)}" loading="lazy" decoding="async">${pick}<span class="uds-condition">${escapeHtml(condition)}</span></div><div class="uds-card-body"><div class="uds-category">${escapeHtml(product.brand||categoryLabel(product.categories)||"Golf")}</div><h3>${escapeHtml(product.name)}</h3><p class="uds-description">${escapeHtml(localizedProductText(product,"short_description")||product.model||(currentLanguage==="en"?"Curated for your game.":"Seleccionado para tu juego."))}</p><div class="uds-price-row"><span class="uds-price">${money(price,product.currency)}</span>${discount?`<span class="uds-old-price">${money(product.price,product.currency)}</span>`:""}</div><div class="uds-stock ${stock.cls}">${stock.text}</div><div class="uds-card-actions is-clean"><button class="uds-view-equipment" type="button">${currentLanguage==="en"?"View equipment":"Ver equipo"}</button></div></div>`;
  }
  function markImageFallback(img,host){
    if(!img||!host)return;
    img.addEventListener("error",()=>{
      img.style.display="none";
      host.classList.add("is-media-fallback");
    },{once:true});
  }
  function bindCard(card,product){
    const media=card.querySelector(".uds-card-media");
    const mediaImage=media?.querySelector("img");
    markImageFallback(mediaImage,media);
    card.querySelector(".uds-add")?.addEventListener("click",()=>addToCart(product));
    card.querySelector(".uds-details")?.addEventListener("click",()=>openProduct(product));
    card.querySelector(".uds-view-equipment")?.addEventListener("click",()=>openProduct(product));
    card.querySelector(".uds-quick-add")?.addEventListener("click",()=>addToCart(product));
    media?.addEventListener("click",()=>openProduct(product));
  }
  function renderProducts(){
    const grid=el("udsGrid");grid.innerHTML="";el("udsResultsCount").textContent=currentLanguage==="en"?`${filteredProducts.length} product${filteredProducts.length===1?"":"s"}`:`${filteredProducts.length} producto${filteredProducts.length===1?"":"s"}`;
    if(!filteredProducts.length){grid.innerHTML=`<div class="uds-no-results">${currentLanguage==="en"?"No products match these filters.":"No encontramos productos con esos filtros."}</div>`;return}
    filteredProducts.forEach(p=>{const card=document.createElement("article");card.className="uds-card";card.innerHTML=cardHtml(p);bindCard(card,p);grid.appendChild(card)})
  }
  function renderNewArrivals(){
    const rail=el("udsNewRail");
    if(!rail)return;
    const offers=[...products]
      .filter(p=>p.sale_price!==null&&Number(p.sale_price)<Number(p.price))
      .sort((a,b)=>new Date(b.created_at)-new Date(a.created_at));
    const latest=[...products].sort((a,b)=>new Date(b.created_at)-new Date(a.created_at));
    const seen=new Set();
    const selection=[...offers,...latest].filter(p=>{
      if(seen.has(p.id))return false;
      seen.add(p.id);
      return true;
    }).slice(0,4);
    rail.innerHTML="";
    selection.forEach(p=>{const card=document.createElement("article");card.className="uds-card";card.innerHTML=cardHtml(p);bindCard(card,p);rail.appendChild(card)});
    if(!selection.length)rail.innerHTML=`<div class="uds-no-results">${currentLanguage==="en"?"No new arrivals or offers yet.":"AÃºn no hay novedades u ofertas."}</div>`;
  }
  function renderPicks(){
    const grid=el("udsPicksGrid");if(!grid)return;
    const picks=products.filter(p=>p.featured).slice(0,4);
    const selected=picks.length?picks:products.slice(0,4);
    grid.innerHTML="";
    selected.forEach(p=>{const card=document.createElement("article");card.className="uds-card";card.innerHTML=cardHtml(p);bindCard(card,p);grid.appendChild(card)});
    if(!selected.length)grid.innerHTML=`<div class="uds-no-results">${currentLanguage==="en"?"No highlighted products yet.":"AÃºn no hay productos destacados."}</div>`;
  }
  function categoryImage(category,index){
    const p=products.find(x=>x.categories?.slug===category.slug&&x.cover_image_url);
    const fallbacks=[
      "https://images.unsplash.com/photo-1591491719565-1ef4ef9a5422?auto=format&fit=crop&w=1300&q=85",
      "https://images.unsplash.com/photo-1592919505780-303950717480?auto=format&fit=crop&w=1300&q=85",
      "https://images.unsplash.com/photo-1587174486073-ae5e5cff23aa?auto=format&fit=crop&w=1300&q=85",
      "https://images.unsplash.com/photo-1593111774240-d529f12cf4bb?auto=format&fit=crop&w=1300&q=85"
    ];return p?.cover_image_url||fallbacks[index%fallbacks.length]
  }
  function appendMobileMenuButton({
    label,
    target,
    className="",
    onClick=null
  }){
    const button=document.createElement("button");
    button.type="button";
    button.className=`uds-mobile-category ${className}`.trim();
    button.innerHTML=`<span>${escapeHtml(label)}</span><span aria-hidden="true">â†’</span>`;

    button.onclick=()=>{
      if(typeof onClick==="function"){
        onClick();
      }

      closePanels();

      if(target){
        window.setTimeout(()=>{
          el(target)?.scrollIntoView({
            behavior:"smooth",
            block:"start"
          });
        },120);
      }
    };

    el("udsMobileCategories").appendChild(button);
  }

  function appendMobileSection(title){
    const section=document.createElement("div");
    section.className="uds-mobile-menu-section";
    section.textContent=title;
    el("udsMobileCategories").appendChild(section);
  }

  function renderCategories(){
    const grid=el("udsCategoryGrid");
    const menu=el("udsMobileCategories");
    const select=el("udsCategorySelect");
    const mobileSelect=el("udsCategoryMobileFilter");

    grid.innerHTML="";
    menu.innerHTML="";
    select.innerHTML=`<option value="all">${currentLanguage==="en"?"All categories":"Todas las categorías"}</option>`;
    if(mobileSelect)mobileSelect.innerHTML=`<option value="all">${currentLanguage==="en"?"Category: all":"CategorÃ­a: todas"}</option>`;

    appendMobileSection(currentLanguage==="en"?"Explore":"Explorar");

    appendMobileMenuButton({
      label:currentLanguage==="en"?"New arrivals":"Novedades",
      target:"udsNew",
      className:"is-editorial"
    });

    appendMobileMenuButton({
      label:currentLanguage==="en"?"Shop":"Tienda",
      target:"udsCatalog",
      className:"is-editorial"
    });

    appendMobileMenuButton({
      label:currentLanguage==="en"?"Services":"Servicios",
      target:"udsServices",
      className:"is-editorial"
    });

    appendMobileMenuButton({
      label:currentLanguage==="en"?"Golf courses":"Campos de golf",
      target:"udsCourses",
      className:"is-editorial"
    });

    appendMobileMenuButton({
      label:"Cabo Journal",
      target:"udsJournal",
      className:"is-editorial is-journal"
    });

    appendMobileMenuButton({
      label:"GHIN",
      className:"is-editorial",
      onClick:()=>window.open(buildGhinWhatsAppUrl(),"_blank","noopener,noreferrer")
    });

    appendMobileMenuButton({
      label:currentLanguage==="en"?"About us":"QuiÃ©nes somos",
      target:"udsAbout",
      className:"is-editorial"
    });

    appendMobileSection(currentLanguage==="en"?"Shop by category":"Comprar por categorÃ­a");

    appendMobileMenuButton({
      label:currentLanguage==="en"?"All products":"Todos los productos",
      target:"udsCatalog",
      onClick:()=>setCategory("all")
    });

    categories.forEach((category,index)=>{
      const tile=document.createElement("button");
      tile.type="button";
      tile.className="uds-category-tile";
      tile.innerHTML=`
        <img
          src="${escapeHtml(categoryImage(category,index))}"
          alt="${escapeHtml(categoryLabel(category))}"
          loading="lazy"
          decoding="async"
        >
        <span class="uds-category-tile-content">
          <small>${currentLanguage==="en"?"Explore collection":"Explorar colecciÃ³n"}</small>
          <strong>${escapeHtml(categoryLabel(category))}</strong>
        </span>
      `;

      markImageFallback(tile.querySelector("img"),tile);

      tile.onclick=()=>{
        setCategory(category.slug);
        el("udsCatalog").scrollIntoView({
          behavior:"smooth"
        });
      };

      grid.appendChild(tile);

      appendMobileMenuButton({
        label:categoryLabel(category),
        target:"udsCatalog",
        onClick:()=>setCategory(category.slug)
      });

      const option=document.createElement("option");
      option.value=category.slug;
      option.textContent=categoryLabel(category);
      select.appendChild(option);
      if(mobileSelect){const mobileOption=option.cloneNode(true);mobileSelect.appendChild(mobileOption)}
    });

    const categoryToggle=el("udsCategoriesToggle");
    if(categoryToggle){
      const hasMore=categories.length>6;
      categoryToggle.classList.toggle("uds-hidden",!hasMore);
      grid.classList.remove("is-expanded");
      categoryToggle.setAttribute("aria-expanded","false");
      categoryToggle.textContent=currentLanguage==="en"?"View all categories":"Ver todas las categorías";
    }
  }

  function setSelectOptions(node,values,label){
    if(!node)return;
    const current=node.value||"all";
    node.innerHTML=`<option value="all">${escapeHtml(label)}</option>`+values.map(value=>`<option value="${escapeHtml(value)}">${escapeHtml(value)}</option>`).join("");
    node.value=values.includes(current)?current:"all";
  }
  function productsForActiveCategory(){
    if(activeCategory==="all")return products;
    return products.filter(p=>p.categories?.slug===activeCategory);
  }
  function setFilterVisibility(ids,visible){
    ids.forEach(id=>{
      const node=el(id);
      if(!node)return;
      node.classList.toggle("uds-filter-hidden",!visible);
      node.disabled=!visible;
      if(!visible)node.value="all";
    });
  }
  function updateFilterApplicability(){
    const scoped=productsForActiveCategory();
    const clubContext=activeCategory!=="all"&&scoped.some(isClubProduct);
    const hasHand=clubContext&&scoped.some(p=>Boolean(normalizeHand(rawGolfSpecs(p).hand)));
    const hasFlex=clubContext&&scoped.some(p=>Boolean(rawGolfSpecs(p).flex));
    const hasLoft=clubContext&&scoped.some(p=>Boolean(rawGolfSpecs(p).loft));

    setFilterVisibility(["udsHandFilter","udsCatalogHand"],hasHand);
    setFilterVisibility(["udsFlexFilter","udsCatalogFlex"],hasFlex);
    setFilterVisibility(["udsLoftFilter","udsCatalogLoft"],hasLoft);

    const hint=el("udsFilterHint");
    if(hint){
      if(activeCategory==="all"){
        hint.textContent=currentLanguage==="en"
          ?"Choose a category to reveal only the technical filters that apply."
          :"Elige una categorÃ­a para mostrar Ãºnicamente los filtros tÃ©cnicos que correspondan.";
      }else if(clubContext){
        hint.textContent=currentLanguage==="en"
          ?"Only technical filters available for this club category are shown."
          :"Mostramos Ãºnicamente los filtros tÃ©cnicos disponibles para esta categorÃ­a de palos.";
      }else{
        hint.textContent=currentLanguage==="en"
          ?"Club-specific filters are hidden because they do not apply to this category."
          :"Ocultamos mano, flex y loft porque no corresponden a esta categorÃ­a.";
      }
    }
  }
  function renderCommerceFilters(){
    const scoped=productsForActiveCategory();
    const brands=[...new Set(scoped.map(p=>String(p.brand||"").trim()).filter(Boolean))].sort((a,b)=>a.localeCompare(b));
    const hands=[...new Set(scoped.map(p=>normalizeHand(rawGolfSpecs(p).hand)).filter(Boolean))].sort();
    const flexes=[...new Set(scoped.map(p=>rawGolfSpecs(p).flex).filter(Boolean))].sort((a,b)=>a.localeCompare(b));
    const lofts=[...new Set(scoped.map(p=>rawGolfSpecs(p).loft).filter(Boolean))].sort((a,b)=>a.localeCompare(b,undefined,{numeric:true}));

    setSelectOptions(el("udsBrandFilter"),brands,currentLanguage==="en"?"All brands":"Todas las marcas");
    setSelectOptions(el("udsHandFilter"),hands,currentLanguage==="en"?"Any hand":"Cualquier mano");
    setSelectOptions(el("udsFlexFilter"),flexes,currentLanguage==="en"?"Any flex":"Cualquier flex");
    setSelectOptions(el("udsLoftFilter"),lofts,currentLanguage==="en"?"Any loft":"Cualquier loft");
    setSelectOptions(el("udsCatalogBrand"),brands,currentLanguage==="en"?"All brands":"Todas las marcas");
    setSelectOptions(el("udsCatalogHand"),hands,currentLanguage==="en"?"Any hand":"Cualquier mano");
    setSelectOptions(el("udsCatalogFlex"),flexes,currentLanguage==="en"?"Any flex":"Cualquier flex");
    setSelectOptions(el("udsCatalogLoft"),lofts,currentLanguage==="en"?"Any loft":"Cualquier loft");
    if(el("udsCatalogCategory")){
      el("udsCatalogCategory").innerHTML=`<option value="all">${currentLanguage==="en"?"All categories":"Todas las categorías"}</option>`+categories.map(c=>`<option value="${escapeHtml(c.slug)}">${escapeHtml(categoryLabel(c))}</option>`).join("");
    }
    updateFilterApplicability();
    syncFilterUi();
  }
  function currentFilterCount(){
    return [el("udsBrandFilter")?.value,el("udsHandFilter")?.value,el("udsFlexFilter")?.value,el("udsLoftFilter")?.value,el("udsConditionFilter")?.value]
      .filter(v=>v&&v!=="all").length+(activeCategory!=="all"?1:0);
  }
  function isFocusedSearch(){
    const search=(el("udsSearch")?.value||"").trim();
    const condition=el("udsConditionFilter")?.value||"all";
    const brand=el("udsBrandFilter")?.value||"all";
    const hand=el("udsHandFilter")?.value||"all";
    const flex=el("udsFlexFilter")?.value||"all";
    const loft=el("udsLoftFilter")?.value||"all";
    const sort=el("udsSortFilter")?.value||"featured";
    return Boolean(
      search||
      activeCategory!=="all"||
      condition!=="all"||
      brand!=="all"||
      hand!=="all"||
      flex!=="all"||
      loft!=="all"||
      sort!=="featured"
    );
  }
  function updateFocusedSearchMode(){
    const focused=isFocusedSearch();
    const root=document.getElementById("updown-store");
    root?.classList.toggle("uds-search-focus",focused);

    if(el("udsClearFilters")){
      el("udsClearFilters").textContent=focused
        ?(currentLanguage==="en"?"Close search":"Cerrar bÃºsqueda")
        :(currentLanguage==="en"?"Clear filters":"Limpiar filtros");
    }
    if(el("udsDiscoveryClear")){
      el("udsDiscoveryClear").textContent=focused
        ?(currentLanguage==="en"?"Close search":"Cerrar bÃºsqueda")
        :(currentLanguage==="en"?"Clear filters":"Borrar filtros");
    }
  }
  function syncFilterUi(){
    if(el("udsFilterCount"))el("udsFilterCount").textContent=String(currentFilterCount());
    if(el("udsCategoryMobileFilter"))el("udsCategoryMobileFilter").value=activeCategory;
    if(el("udsConditionMobileFilter"))el("udsConditionMobileFilter").value=el("udsConditionFilter")?.value||"all";
    const syncMap={
      udsCatalogSearch:el("udsSearch")?.value||"",
      udsCatalogCategory:activeCategory,
      udsCatalogCondition:el("udsConditionFilter")?.value||"all",
      udsCatalogBrand:el("udsBrandFilter")?.value||"all",
      udsCatalogHand:el("udsHandFilter")?.value||"all",
      udsCatalogFlex:el("udsFlexFilter")?.value||"all",
      udsCatalogLoft:el("udsLoftFilter")?.value||"all",
      udsCatalogSort:el("udsSortFilter")?.value||"featured"
    };
    Object.entries(syncMap).forEach(([id,value])=>{if(el(id)&&el(id).value!==String(value))el(id).value=String(value)});
  }
  function setCategory(category){
    activeCategory=category;
    if(el("udsCategorySelect"))el("udsCategorySelect").value=category;
    if(el("udsCategoryMobileFilter"))el("udsCategoryMobileFilter").value=category;
    activeCollection="";
    renderCommerceFilters();
    applyFilters();
  }
  function applyFilters(){
    const search=el("udsSearch").value.trim().toLowerCase();
    const condition=el("udsConditionFilter").value;
    const brand=el("udsBrandFilter")?.value||"all";
    const hand=el("udsHandFilter")?.value||"all";
    const flex=el("udsFlexFilter")?.value||"all";
    const loft=el("udsLoftFilter")?.value||"all";
    const sort=el("udsSortFilter")?.value||"featured";
    filteredProducts=products.filter(p=>{
      const specs=rawGolfSpecs(p);
      const cat=activeCategory==="all"||p.categories?.slug===activeCategory;
      const cond=condition==="all"||p.item_condition===condition;
      const brandOk=brand==="all"||String(p.brand||"")===brand;
      const handOk=hand==="all"||normalizeHand(specs.hand)===hand;
      const flexOk=flex==="all"||specs.flex===flex;
      const loftOk=loft==="all"||specs.loft===loft;
      const hay=[p.name,p.brand,p.model,p.short_description,p.categories?.name,...Object.values(p.specifications||{}).map(displaySpecValue)].filter(Boolean).join(" ").toLowerCase();
      return cat&&cond&&brandOk&&handOk&&flexOk&&loftOk&&(!search||hay.includes(search));
    });
    if(activeCollection==="newest")filteredProducts=[...filteredProducts].sort((a,b)=>new Date(b.created_at)-new Date(a.created_at));
    if(sort==="newest")filteredProducts=[...filteredProducts].sort((a,b)=>new Date(b.created_at)-new Date(a.created_at));
    if(sort==="price_asc")filteredProducts=[...filteredProducts].sort((a,b)=>Number(a.sale_price??a.price)-Number(b.sale_price??b.price));
    if(sort==="price_desc")filteredProducts=[...filteredProducts].sort((a,b)=>Number(b.sale_price??b.price)-Number(a.sale_price??a.price));
    if(sort==="featured")filteredProducts=[...filteredProducts].sort((a,b)=>Number(Boolean(b.featured))-Number(Boolean(a.featured))||new Date(b.created_at)-new Date(a.created_at));
    syncFilterUi();
    updateFocusedSearchMode();
    renderProducts();
  }
  function productAdvisor(){
    const affiliate=getStoredAffiliate();
    return affiliate?.seller_name?{name:affiliate.seller_name,code:affiliate.code,phone:affiliate.seller_phone||""}:{name:"UP AND DOWN · Los Cabos",code:"",phone:""};
  }
  function conditionNote(product){
    if(product.item_condition==="new")return currentLanguage==="en"?"New product as listed in the catalog.":"Producto nuevo segÃºn la condición registrada en catálogo.";
    if(product.item_condition==="demo")return currentLanguage==="en"?"Demo unit. Ask for current cosmetic details before purchase.":"Unidad demo. Solicita detalles estéticos actuales antes de comprar.";
    if(product.item_condition==="preowned")return currentLanguage==="en"?"Pre-owned. Ask for current photos and wear details before purchase.":"Seminuevo. Solicita fotos actuales y detalle de desgaste antes de comprar.";
    return currentLanguage==="en"?"Ask our team for current condition details.":"Consulta con nuestro equipo los detalles actuales de condición.";
  }
  function buildWhatsAppUrl(product=null,purpose="question"){
    const affiliate=getStoredAffiliate();
    const advisor=productAdvisor();
    let phone=String(advisor.phone||"526243554700").replace(/\D/g,"")||"526243554700";
    if(phone.length===10)phone=`52${phone}`;

    const hasSellerReferral=Boolean(
      affiliate?.seller_name &&
      affiliate?.code &&
      advisor?.name &&
      advisor?.phone
    );

    // Referred product question: speak directly to the assigned seller.
    if(product&&purpose!=="trade"&&hasSellerReferral){
      const summary=golfSummary(product);
      const lines=currentLanguage==="en"
        ?[
            `Hi ${advisor.name} ðŸ‘‹`,
            "",
            "Iâ€™m looking at this equipment:",
            `*${product.name}*`,
            `SKU: ${product.sku||"â€”"}`,
            ...(summary?[`Configuration: ${summary}`]:[]),
            `Price: ${money(product.sale_price??product.price,product.currency)}`,
            "",
            "Can you help me confirm whether this configuration is right for my game?"
          ]
        :[
            `Hola ${advisor.name} ðŸ‘‹`,
            "",
            "Estoy viendo este equipo:",
            `*${product.name}*`,
            `SKU: ${product.sku||"â€”"}`,
            ...(summary?[`Configuración: ${summary}`]:[]),
            `Precio: ${money(product.sale_price??product.price,product.currency)}`,
            "",
            "Â¿Me ayudas a confirmar si esta configuraciÃ³n es adecuada para mi juego?"
          ];

      return `https://wa.me/${phone}?text=${encodeURIComponent(lines.join("\n"))}`;
    }

    // General UP AND DOWN / Concierge flow remains unchanged.
    const lines=currentLanguage==="en"?["Hi UP AND DOWN ðŸ‘‹"]:["Hola UP AND DOWN ðŸ‘‹"];
    if(affiliate?.seller_name)lines.push(currentLanguage==="en"?`Iâ€™m shopping with ${affiliate.seller_name}'s referral (${affiliate.code}).`:`Estoy comprando con la referencia de ${affiliate.seller_name} (${affiliate.code}).`);
    if(product){
      lines.push("",currentLanguage==="en"?"Iâ€™m looking at this equipment:":"Estoy viendo este equipo:",`*${product.name}*`,`SKU: ${product.sku||"â€”"}`);
      const summary=golfSummary(product);if(summary)lines.push(currentLanguage==="en"?`Configuration: ${summary}`:`Configuración: ${summary}`);
      lines.push(currentLanguage==="en"?`Price: ${money(product.sale_price??product.price,product.currency)}`:`Precio: ${money(product.sale_price??product.price,product.currency)}`);
    }
    lines.push("");
    if(purpose==="trade")lines.push(currentLanguage==="en"?"I have golf equipment I may want to trade in. Can you tell me how the in-store evaluation works?":"Tengo equipo de golf que podrÃ­a dar a cuenta. Â¿Me explican cÃ³mo funciona la valoraciÃ³n en tienda?");
    else if(product)lines.push(currentLanguage==="en"?"Can you help me confirm whether this configuration fits my game?":"Â¿Me ayudan a confirmar si esta configuraciÃ³n es adecuada para mi juego?");
    else lines.push(currentLanguage==="en"?"Iâ€™d like help choosing the right golf equipment for my game.":"Quiero asesorÃ­a para elegir el equipo correcto para mi juego.");
    return `https://wa.me/${phone}?text=${encodeURIComponent(lines.join("\n"))}`;
  }
  function openConcierge(product=null,purpose="question"){
    window.open(buildWhatsAppUrl(product,purpose),"_blank","noopener,noreferrer");
  }
  function renderAdvisorBar(){
    const affiliate=getStoredAffiliate(),bar=el("udsAdvisorBar");
    if(!bar)return;
    bar.classList.remove("uds-hidden");
    const name=affiliate?.seller_name||(currentLanguage==="en"?"UP AND DOWN · Los Cabos":"UP AND DOWN · Los Cabos");
    el("udsAdvisorName").textContent=name;
    el("udsAdvisorInitial").textContent=affiliate?.seller_name?String(affiliate.seller_name).trim().charAt(0).toUpperCase()||"U":"U";
    el("udsAdvisorLabel").textContent=affiliate?.seller_name?(currentLanguage==="en"?"Your Golf Advisor":"Tu Golf Advisor"):(currentLanguage==="en"?"Golf Advisor":"Golf Advisor");
    el("udsAdvisorContact").textContent=affiliate?.seller_name?(currentLanguage==="en"?"Contact my advisor":"Consultar con mi asesor"):(currentLanguage==="en"?"Talk to an advisor":"Hablar con un asesor");
  }
  function modalSpecEntries(product){
    const preferred=[
      [currentLanguage==="en"?"Brand":"Marca",product.brand],
      [currentLanguage==="en"?"Model":"Modelo",product.model]
    ];
    const g=rawGolfSpecs(product);
    if(g.hand)preferred.push([currentLanguage==="en"?"Hand":"Mano",normalizeHand(g.hand)]);
    if(g.loft)preferred.push(["Loft",g.loft]);
    if(g.flex)preferred.push(["Flex",g.flex]);
    if(g.shaft)preferred.push(["Shaft",g.shaft]);
    if(g.grip)preferred.push(["Grip",g.grip]);
    const used=new Set(preferred.map(([k])=>normalizeSpecKey(k)));
    Object.entries(product.specifications||{}).forEach(([key,value])=>{
      const display=displaySpecValue(value);if(!display)return;
      const nk=normalizeSpecKey(key);
      if(["marca","brand","modelo","model","mano","hand","dexterity","loft","grados","flex","shaft","varilla","grip","ideal para","jugador","player profile","recommended for","recomendado para"].some(a=>nk.includes(normalizeSpecKey(a))))return;
      if(!used.has(nk))preferred.push([key,display]);
    });
    return preferred.filter(([,v])=>v!==null&&v!==undefined&&String(v).trim()).slice(0,10);
  }
  function openProduct(product){
    modalProduct=product;
    const advisor=productAdvisor(),specs=rawGolfSpecs(product),chips=golfSpecChips(product,4),stock=stockCopy(product.stock);
    modalGalleryImages=productGallery(product);
    modalGalleryIndex=0;
    renderModalGallery(0);
    el("udsModalPick")?.classList.add("uds-hidden");
    el("udsModalCategory").textContent=`${categoryLabel(product.categories)||"Golf"} · ${(currentLanguage==="en"?conditionLabelsEn:conditionLabels)[product.item_condition]||""}`;
    el("udsModalTitle").textContent=product.name||"";
    el("udsModalSummaryChips").innerHTML=chips.map(v=>`<span class="uds-spec-chip">${escapeHtml(v)}</span>`).join("");
    const hasDiscount=product.sale_price!==null&&Number(product.sale_price)<Number(product.price);
    el("udsModalPrice").innerHTML=`<span class="uds-price">${money(product.sale_price??product.price,product.currency)}</span>${hasDiscount?`<span class="uds-old-price">${money(product.price,product.currency)}</span>`:""}`;
    el("udsModalCurrencyNote").textContent=currentLanguage==="en"?`Price shown in ${String(product.currency||"MXN").toUpperCase()}.`:`Precio expresado en ${String(product.currency||"MXN").toUpperCase()}.`;
    el("udsModalDescription").textContent=localizedProductText(product,"description")||localizedProductText(product,"short_description")||(currentLanguage==="en"?"Ask our team about availability and specifications.":"Consulta disponibilidad y especificaciones con nuestro equipo.");
    const player=specs.player;
    el("udsPlayerFitWrap").classList.toggle("uds-hidden",!player);
    el("udsPlayerFit").textContent=player||"";
    el("udsPlayerFitLabel").textContent=currentLanguage==="en"?"Who it fits":"Para qué jugador";
    el("udsSpecsLabel").textContent=currentLanguage==="en"?"Configuration":"Configuración";
    const entries=modalSpecEntries(product);
    el("udsModalSpecs").innerHTML=entries.length?entries.map(([key,value])=>`<div class="uds-modal-spec-item"><span>${escapeHtml(key)}</span><strong>${escapeHtml(value)}</strong></div>`).join(""):`<div class="uds-modal-spec-item"><span>${currentLanguage==="en"?"Product":"Producto"}</span><strong>${escapeHtml(product.name||"")}</strong></div>`;
    el("udsModalCondition").textContent=(currentLanguage==="en"?conditionLabelsEn:conditionLabels)[product.item_condition]||(currentLanguage==="en"?"Product":"Producto");
    el("udsModalConditionNote").textContent=conditionNote(product);
    el("udsModalStock").textContent=stock.text;
    el("udsModalAdvisorLabel").textContent=advisor.code?(currentLanguage==="en"?"Assisted by":"Atendido por"):(currentLanguage==="en"?"Golf Concierge":"Golf Concierge");
    el("udsModalAdvisorName").textContent=advisor.name;
    const isSoldOut=Number(product.stock)<=0;
    el("udsModal").classList.toggle("is-sold-out",isSoldOut);
    el("udsModalAdd").disabled=isSoldOut;
    el("udsModalAdd").innerHTML=isSoldOut
  ? `<span>${currentLanguage==="en"?"Sold out":"Agotado"}</span>`
  : `<svg class="uds-modal-cart-icon" viewBox="0 0 24 24" aria-hidden="true">
       <path d="M3 4h2l2.2 10.2a2 2 0 0 0 2 1.6h7.9a2 2 0 0 0 1.9-1.4L21 8H7"/>
       <circle cx="10" cy="20" r="1.4"/>
       <circle cx="18" cy="20" r="1.4"/>
     </svg>
     <span>${currentLanguage==="en"?"Add to cart":"Agregar al carrito"}</span>`;
    el("udsModalConcierge").textContent=currentLanguage==="en"?"Ask about this equipment":"Preguntar sobre este equipo";
    el("udsModalTrade").textContent=currentLanguage==="en"?"Have equipment to trade in?":"¿Tienes equipo para intercambiar?";
    el("udsTrustInventory").textContent=currentLanguage==="en"?"Updated inventory":"Inventario actualizado";
    el("udsTrustPayment").textContent=currentLanguage==="en"?"Secure Stripe payment":"Pago seguro con Stripe";
    el("udsTrustAdvice").textContent=currentLanguage==="en"?"Personal advice":"AsesorÃ­a personal";
    closePanels(false);openOverlay();el("udsModal").classList.add("is-open");el("udsModal").setAttribute("aria-hidden","false"); requestAnimationFrame(()=>{const m=el("udsModal");if(m)m.scrollTop=0;const g=m?.querySelector(".uds-modal-grid");if(g)g.scrollTop=0;});
  }

  function cleanLocationParameters(targetWindow){
    try{
      const url=new URL(
        targetWindow.location.href
      );

      let cleanSearch=url.search;

      cleanSearch=cleanSearch
        .replace(
          /([?&])(?:checkout|status)=(success|cancelled)(&|$)/gi,
          "$1"
        )
        .replace(
          /([?&])session_id=[^&]*(&|$)/gi,
          "$1"
        )
        .replace(/[?&]+$/,"")
        .replace("?&","?");

      const cleanUrl=
        url.pathname+
        cleanSearch+
        url.hash;

      targetWindow.history.replaceState(
        {},
        targetWindow.document?.title||document.title,
        cleanUrl
      );
    }catch(error){
      // HighLevel puede impedir el acceso a la ventana superior.
    }
  }

  function cleanCheckoutParameters(){
    cleanLocationParameters(window);

    try{
      if(window.top&&window.top!==window){
        cleanLocationParameters(window.top);
      }
    }catch(error){}

    // Conserva visible la referencia del vendedor despuÃ©s de Stripe.
    syncStoredAffiliateReferenceInUrl();
  }

  const processedCheckoutStorageKey=
    "upDownProcessedCheckoutSessions";

  function getProcessedSessions(){
    try{
      const parsed=JSON.parse(
        localStorage.getItem(
          processedCheckoutStorageKey
        )||"[]"
      );

      return Array.isArray(parsed)
        ? parsed.filter(
            value=>typeof value==="string"
          )
        : [];
    }catch(error){
      return [];
    }
  }

  function hasProcessedSession(sessionId){
    if(!sessionId) return false;

    return getProcessedSessions()
      .includes(sessionId);
  }

  function rememberProcessedSession(sessionId){
    if(!sessionId) return;

    const current=getProcessedSessions();

    const updated=[
      sessionId,
      ...current.filter(id=>id!==sessionId)
    ].slice(0,30);

    localStorage.setItem(
      processedCheckoutStorageKey,
      JSON.stringify(updated)
    );
  }

  function showCheckoutSuccess(sessionId){
    cart=[];

    localStorage.removeItem(
      "upDownCart"
    );

    renderCart();
    rememberProcessedSession(sessionId);

    if(sessionId){
      el("udsSuccessReference").textContent=
        currentLanguage==="en"?`Stripe reference: ${sessionId}`:`Referencia de Stripe: ${sessionId}`;

      el("udsSuccessReference")
        .classList.remove("uds-hidden");
    }else{
      el("udsSuccessReference").textContent="";

      el("udsSuccessReference")
        .classList.add("uds-hidden");
    }

    openOverlay();

    el("udsSuccessModal")
      .classList.add("is-open");

    el("udsSuccessModal")
      .setAttribute("aria-hidden","false");
  }

  function readCheckoutReturn(){
    const candidates=[];

    try{
      candidates.push(
        window.location.href
      );
    }catch(error){}

    try{
      if(window.top&&window.top.location){
        candidates.push(
          window.top.location.href
        );
      }
    }catch(error){}

    if(document.referrer){
      candidates.push(
        document.referrer
      );
    }

    for(
      const rawCandidate of [
        ...new Set(candidates.filter(Boolean))
      ]
    ){
      const decodedCandidates=[
        rawCandidate
      ];

      try{
        decodedCandidates.push(
          decodeURIComponent(rawCandidate)
        );
      }catch(error){}

      for(const candidate of decodedCandidates){
        try{
          const parsed=new URL(
            candidate,
            window.location.origin
          );

          const status=(
            parsed.searchParams.get("checkout") ||
            parsed.searchParams.get("status") ||
            ""
          ).toLowerCase();

          const sessionId=
            parsed.searchParams.get("session_id");

          if(
            status==="success" ||
            status==="cancelled"
          ){
            return {
              status,
              sessionId
            };
          }
        }catch(error){}

        // Respaldo para URLs mal formadas por el preview de HighLevel.
        const statusMatch=String(candidate).match(
          /[?&#](?:checkout|status)=(success|cancelled)(?:[&#]|$)/i
        );

        if(statusMatch){
          const sessionMatch=String(candidate).match(
            /[?&#]session_id=([^&#]+)/i
          );

          return {
            status:statusMatch[1].toLowerCase(),
            sessionId:sessionMatch
              ? decodeURIComponent(sessionMatch[1])
              : null
          };
        }
      }
    }

    return {
      status:null,
      sessionId:null
    };
  }

  function handleCheckoutReturn(){
    const {
      status,
      sessionId
    }=readCheckoutReturn();

    if(status==="success"){
      // Una sesiÃ³n ya procesada no debe vaciar ni abrir el aviso otra vez.
      if(
        sessionId &&
        hasProcessedSession(sessionId)
      ){
        cleanCheckoutParameters();
        return false;
      }

      showCheckoutSuccess(sessionId);
      cleanCheckoutParameters();
      return true;
    }

    if(status==="cancelled"){
      cleanCheckoutParameters();

      const cancellationKey=
        sessionId
          ? `upDownCancelledCheckout:${sessionId}`
          : "upDownCancelledCheckout:last";

      if(
        sessionStorage.getItem(
          cancellationKey
        )
      ){
        return false;
      }

      sessionStorage.setItem(
        cancellationKey,
        "1"
      );

      showToast(
        currentLanguage==="en"?"Payment was cancelled. We kept your cart so you can try again.":"El pago fue cancelado. Conservamos tu carrito para que puedas intentarlo nuevamente."
      );

      return true;
    }

    return false;
  }

  async function loadStore(){
    const restoredFromCache=restoreCatalogCache();
    if(el("udsStatus")&&!restoredFromCache){el("udsStatus").className="uds-status";el("udsStatus").textContent=currentLanguage==="en"?"Checking catalog…":"Consultando catálogo…";}
    const [{data:cats,error:ce},{data:prods,error:pe}]=await Promise.all([
      db.from("categories").select("id,name,slug,sort_order").eq("is_active",true).order("sort_order",{ascending:true}).abortSignal(timeoutSignal()),
      db.from("products").select(`id,category_id,sku,name,slug,brand,model,item_condition,short_description,description,specifications,currency,price,sale_price,stock,cover_image_url,featured,status,created_at,categories(name,slug),product_images(id,image_url,alt_text,sort_order,is_primary)`).eq("status","active").order("featured",{ascending:false}).order("created_at",{ascending:false}).abortSignal(timeoutSignal())
    ]);
    if(ce||pe){
      const error=ce||pe;
      if(restoredFromCache){
        console.warn("[UPDOWN catalog refresh]",error);
        showToast(currentLanguage==="en"?"Showing the latest saved catalog while the connection recovers.":"Mostramos el Ãºltimo catálogo guardado mientras se recupera la conexiÃ³n.");
        return;
      }
      el("udsStatus").className="uds-status is-error";
      el("udsStatus").innerHTML=`<strong>${currentLanguage==="en"?"We could not load the catalog.":"No fue posible cargar el catálogo."}</strong><br>${escapeHtml(error.message)}`;
      return;
    }
    categories=cats||[];
    products=prods||[];
    renderCatalogState();
    saveCatalogCache();
    revealCatalog();
    reconcileCart({silent:false}).catch(e=>{
      console.error("[UPDOWN cart reconcile]",e);
      showToast(currentLanguage==="en"?"The catalog loaded, but we could not update your cart.":"El catálogo cargÃ³, pero no pudimos actualizar tu carrito.");
    });
  }

  function syncCatalogFiltersToMaster(){
    if(el("udsCatalogSearch"))el("udsSearch").value=el("udsCatalogSearch").value;
    activeCategory=el("udsCatalogCategory")?.value||"all";
    if(el("udsCategorySelect"))el("udsCategorySelect").value=activeCategory;
    if(el("udsCategoryMobileFilter"))el("udsCategoryMobileFilter").value=activeCategory;
    const pairs=[
      ["udsCatalogCondition","udsConditionFilter"],
      ["udsCatalogBrand","udsBrandFilter"],
      ["udsCatalogHand","udsHandFilter"],
      ["udsCatalogFlex","udsFlexFilter"],
      ["udsCatalogLoft","udsLoftFilter"],
      ["udsCatalogSort","udsSortFilter"]
    ];
    pairs.forEach(([from,to])=>{if(el(from)&&el(to))el(to).value=el(from).value});
    if(el("udsConditionMobileFilter"))el("udsConditionMobileFilter").value=el("udsConditionFilter").value;
    activeCollection="";
    renderCommerceFilters();
  }
  function applyCatalogFilters(scroll=true){
    syncCatalogFiltersToMaster();applyFilters();
    if(scroll)el("udsCatalog").scrollIntoView({behavior:"smooth",block:"start"});
  }
  function focusDiscoverySearch(){
    el("udsAdvancedFilters")?.classList.add("is-open");
    el("udsFiltersToggle")?.setAttribute("aria-expanded","true");
    el("udsHome")?.querySelector(".uds-discovery")?.scrollIntoView({behavior:"smooth",block:"center"});
    setTimeout(()=>el("udsSearch")?.focus(),450);
  }

  function clearCommerceFilters(){
    activeCategory="all";activeCollection="";
    ["udsCategorySelect","udsCategoryMobileFilter","udsConditionFilter","udsConditionMobileFilter","udsBrandFilter","udsHandFilter","udsFlexFilter","udsLoftFilter"].forEach(id=>{if(el(id))el(id).value="all"});
    if(el("udsSortFilter"))el("udsSortFilter").value="featured";
    el("udsSearch").value="";
    document.querySelectorAll("#updown-store .uds-collection-chip").forEach(n=>n.classList.remove("is-active"));
    renderCommerceFilters();
    applyFilters();
  }
  function findCategoryByKeyword(keyword){
    const k=String(keyword||"").toLowerCase();
    return categories.find(x=>String(x.name||"").toLowerCase().includes(k)||String(x.slug||"").toLowerCase().includes(k));
  }
  function shopByKeyword(keyword){
    const category=findCategoryByKeyword(keyword);
    if(category){setCategory(category.slug);}
    else{clearCommerceFilters();el("udsSearch").value=keyword;applyFilters();}
    el("udsCatalog").scrollIntoView({behavior:"smooth",block:"start"});
  }
  function shopByCondition(condition){
    clearCommerceFilters();el("udsConditionFilter").value=condition;if(el("udsConditionMobileFilter"))el("udsConditionMobileFilter").value=condition;applyFilters();el("udsCatalog").scrollIntoView({behavior:"smooth",block:"start"});
  }
  function setCollection(collection,node=null){
    clearCommerceFilters();activeCollection=collection;
    document.querySelectorAll("#updown-store .uds-collection-chip").forEach(n=>n.classList.toggle("is-active",n===node));
    applyFilters();el("udsCatalog").scrollIntoView({behavior:"smooth",block:"start"});
  }

  el("udsSearch")?.addEventListener("input",()=>{activeCollection="";applyFilters()});
  el("udsCategorySelect")?.addEventListener("change",e=>setCategory(e.target.value));
  el("udsCategoryMobileFilter")?.addEventListener("change",e=>setCategory(e.target.value));
  el("udsConditionFilter")?.addEventListener("change",()=>{if(el("udsConditionMobileFilter"))el("udsConditionMobileFilter").value=el("udsConditionFilter").value;activeCollection="";applyFilters()});
  el("udsConditionMobileFilter")?.addEventListener("change",()=>{el("udsConditionFilter").value=el("udsConditionMobileFilter").value;activeCollection="";applyFilters()});
  ["udsBrandFilter","udsHandFilter","udsFlexFilter","udsLoftFilter","udsSortFilter"].forEach(id=>el(id)?.addEventListener("change",()=>{activeCollection="";applyFilters()}));
  if(el("udsFiltersToggle"))el("udsFiltersToggle").onclick=()=>{const panel=el("udsAdvancedFilters"),open=!panel.classList.contains("is-open");panel.classList.toggle("is-open",open);el("udsFiltersToggle").setAttribute("aria-expanded",String(open))};
  if(el("udsDiscoveryApply"))el("udsDiscoveryApply").onclick=()=>{applyFilters();el("udsCatalog").scrollIntoView({behavior:"smooth",block:"start"})};
  if(el("udsDiscoveryClear"))el("udsDiscoveryClear").onclick=clearCommerceFilters;
  if(el("udsCatalogFilterToggle"))el("udsCatalogFilterToggle").onclick=()=>{const box=el("udsCatalogFilterBox"),open=!box.classList.contains("is-open");box.classList.toggle("is-open",open);el("udsCatalogFilterToggle").setAttribute("aria-expanded",String(open))};
  if(el("udsCatalogApply"))el("udsCatalogApply").onclick=()=>applyCatalogFilters(false);
  if(el("udsCatalogClear"))el("udsCatalogClear").onclick=clearCommerceFilters;
  el("udsCatalogSearch")?.addEventListener("input",()=>{syncCatalogFiltersToMaster();applyFilters()});
  ["udsCatalogCategory","udsCatalogCondition","udsCatalogBrand","udsCatalogHand","udsCatalogFlex","udsCatalogLoft","udsCatalogSort"].forEach(id=>el(id)?.addEventListener("change",()=>applyCatalogFilters(false)));
  if(el("udsClearFilters"))el("udsClearFilters").onclick=clearCommerceFilters;
  if(el("udsCartButton"))if(el("udsCartButton"))el("udsCartButton").onclick=openCart;if(el("udsFloatingCart"))if(el("udsFloatingCart"))el("udsFloatingCart").onclick=openCart;if(el("udsCloseCart"))if(el("udsCloseCart"))el("udsCloseCart").onclick=()=>closePanels();if(el("udsMenuButton"))if(el("udsMenuButton"))el("udsMenuButton").onclick=openMenu;if(el("udsCloseMenu"))if(el("udsCloseMenu"))el("udsCloseMenu").onclick=()=>closePanels();if(el("udsOverlay"))if(el("udsOverlay"))el("udsOverlay").onclick=()=>closePanels();if(el("udsCloseModal"))if(el("udsCloseModal"))el("udsCloseModal").onclick=()=>closePanels();if(el("udsModalPrev"))if(el("udsModalPrev"))el("udsModalPrev").onclick=()=>moveModalGallery(-1);if(el("udsModalNext"))if(el("udsModalNext"))el("udsModalNext").onclick=()=>moveModalGallery(1);

  el("udsModalImage").onclick=openImageViewer;
  el("udsImageViewerClose").onclick=closeImageViewer;
  el("udsImageViewerPrev").onclick=()=>moveImageViewer(-1);
  el("udsImageViewerNext").onclick=()=>moveImageViewer(1);

  bindHorizontalSwipe(el("udsImageViewerStage"),moveImageViewer);
  bindHorizontalSwipe(el("udsModalMedia"),moveModalGallery);

  const udsImageViewerNode=el("udsImageViewer");
  udsImageViewerNode?.addEventListener("wheel",event=>{
    if(udsImageViewerNode.classList.contains("is-open"))event.preventDefault();
  },{passive:false});

  // HOTFIX46: touchmove allowed for native pinch-to-zoom.
  if(el("udsSearchTop"))if(el("udsSearchTop"))el("udsSearchTop").onclick=focusDiscoverySearch;
  if(el("udsCategoryNavButton"))if(el("udsCategoryNavButton"))el("udsCategoryNavButton").onclick=()=>{el("udsCategoryGrid").scrollIntoView({behavior:"smooth"})};
  if(el("udsCategoriesToggle"))el("udsCategoriesToggle").onclick=()=>{
    const grid=el("udsCategoryGrid");
    if(!grid)return;
    const expanded=!grid.classList.contains("is-expanded");
    grid.classList.toggle("is-expanded",expanded);
    el("udsCategoriesToggle").setAttribute("aria-expanded",String(expanded));
    el("udsCategoriesToggle").textContent=expanded
      ?(currentLanguage==="en"?"View fewer categories":"Ver menos categorías")
      :(currentLanguage==="en"?"View all categories":"Ver todas las categorías");
  };
  if(el("udsExploreButton"))el("udsExploreButton").onclick=()=>el("udsCatalog").scrollIntoView({behavior:"smooth"});
  if(el("udsFeaturedButton"))if(el("udsFeaturedButton"))el("udsFeaturedButton").onclick=()=>setCollection("featured");
  document.querySelectorAll("#updown-store [data-shop-keyword]").forEach(b=>b.addEventListener("click",()=>shopByKeyword(b.dataset.shopKeyword)));
  document.querySelectorAll("#updown-store [data-shop-condition]").forEach(b=>b.addEventListener("click",()=>shopByCondition(b.dataset.shopCondition)));
  document.querySelectorAll("#updown-store [data-collection]").forEach(b=>b.addEventListener("click",()=>setCollection(b.dataset.collection,b)));
  document.querySelectorAll("#updown-store .uds-editorial-shop").forEach(b=>b.onclick=()=>shopByKeyword(b.dataset.categoryKeyword));
  if(el("udsModalAdd"))el("udsModalAdd").onclick=()=>{if(modalProduct)addToCart(modalProduct)};
  if(el("udsModalConcierge"))el("udsModalConcierge").onclick=()=>{if(modalProduct)openConcierge(modalProduct,"question")};
  if(el("udsModalTrade"))el("udsModalTrade").onclick=()=>{if(modalProduct)openConcierge(modalProduct,"trade")};
  if(el("udsAdvisorContact"))el("udsAdvisorContact").onclick=()=>openConcierge(null,"question");
  if(el("udsWhatsApp"))el("udsWhatsApp").onclick=event=>{event.preventDefault();openConcierge(null,"question")};
  if(el("udsContinueShopping"))el("udsContinueShopping").onclick=()=>{closePanels();el("udsCatalog").scrollIntoView({behavior:"smooth"})};
  if(el("udsDockShop"))el("udsDockShop").onclick=openMenu;
  if(el("udsDockSearch"))el("udsDockSearch").onclick=focusDiscoverySearch;
  if(el("udsDockAdvisor"))el("udsDockAdvisor").onclick=()=>openConcierge(modalProduct&&el("udsModal").classList.contains("is-open")?modalProduct:null,"question");
  if(el("udsDockCart"))el("udsDockCart").onclick=openCart;
  if(el("udsCheckoutButton"))el("udsCheckoutButton").onclick=async()=>{
    if(!cart.length)return showToast(currentLanguage==="en"?"Your cart is empty.":"Tu carrito está vacÃ­o.");
    if(window.__UPDOWN_CHECKOUT_ENABLED__!==true){
      return showToast(currentLanguage==="en"?"Checkout is disabled in this migration preview.":"El checkout está desactivado en esta vista de migración.");
    }
    const b=el("udsCheckoutButton");b.disabled=true;b.textContent=currentLanguage==="en"?"Validating inventory…":"Validando inventario…";
    try{await reconcileCart({silent:false});if(!cart.length)return showToast(currentLanguage==="en"?"No products remain available.":"No quedaron productos disponibles.");b.textContent=currentLanguage==="en"?"Preparing secure checkout…":"Preparando pago seguro…";
      const {data,error}=await db.functions.invoke("create-checkout-session",{body:{items:cart.map(i=>({id:i.id,quantity:i.quantity})),seller_ref:getStoredAffiliate()?.code||null}});
      if(error){let msg=error.message||(currentLanguage==="en"?"We could not start the payment.":"No fue posible iniciar el pago.");try{if(error.context&&typeof error.context.json==="function"){const body=await error.context.json();msg=body?.error||msg}}catch(e){}try{await reconcileCart({silent:false})}catch(e){}throw new Error(msg)}
      if(!data?.url)throw new Error(currentLanguage==="en"?"Stripe did not return a payment URL.":"Stripe no devolviÃ³ una dirección de pago.");window.location.assign(data.url)
    }catch(e){console.error(e);showToast(e instanceof Error?e.message:(currentLanguage==="en"?"We could not start checkout.":"No pudimos iniciar el checkout."))}finally{b.textContent=currentLanguage==="en"?"Secure checkout":"Finalizar compra segura";b.disabled=!cart.length}
  };



  // =========================================================
  // V9.2 · BILINGUAL CONTENT SYSTEM
  // Translates all static commercial/editorial UI and the
  // dynamic labels generated by the storefront.
  // =========================================================
  const STATIC_EN={
    "Golf seleccionado · Pago seguro · AsesorÃ­a personal en Los Cabos":"Curated golf · Secure payment · Personal advice in Los Cabos",
    "Bien elegido.":"Well chosen.",
    "Equipo seleccionado para jugar mejor, con asesorÃ­a personal en Los Cabos.":"Curated equipment to play better, with personal advice in Los Cabos.",
    "Explorar equipo":"Explore equipment",
    "Filtros":"Filters",
    "Encuentra lo que buscas.":"Find what you need.",
    "Elegidos por Coque.":"Chosen by Coque.",
    "Una selecciÃ³n corta de equipo que sÃ­ llevarÃ­amos al campo.":"A short selection of equipment we would take to the course.",
    "Cargando selecciÃ³n…":"Loading selection…",
    "Lo nuevo.":"What's new.",
    "Las incorporaciones mÃ¡s recientes al inventario.":"The newest additions to inventory.",
    "Tu próximo equipo, sin ruido.":"Your next equipment, without the noise.",
    "Busca, filtra y abre cada producto para ver configuraciÃ³n, condición y disponibilidad.":"Search, filter and open each product to view configuration, condition and availability.",
    "MÃ¡s que equipo.":"More than equipment.",
    "ReparaciÃ³n, trade-in, mantenimiento y entrenamiento con atenciÃ³n directa.":"Repair, trade-in, maintenance and training with direct personal service.",
    "Golf en Los Cabos.":"Golf in Los Cabos.",
    "Tres campos para explorar. Confirma horarios y condiciones directamente con cada club.":"Three courses to explore. Confirm schedules and access directly with each club.",
    "Cabo Journal.":"Cabo Journal.",
    "Tres lecturas breves para tomar mejores decisiones dentro y fuera del campo.":"Three short reads for better decisions on and off the course.",
    "Golf seleccionado, servicio personal y experiencia local en Los Cabos.":"Curated golf, personal service and local experience in Los Cabos.",
    "Curated golf equipment · Compra segura con Stripe · AtenciÃ³n personalizada en Los Cabos":"Curated golf equipment · Secure Stripe checkout · Personal service in Los Cabos",
    "Antes de elegir instructor":"Before choosing an instructor",
    "CuÃ©ntanos sobre tu juego.":"Tell us about your game.",
    "Con estos datos podremos orientarte mejor y entender quÃ© buscan los golfistas que llegan a UP AND DOWN.":"This helps us guide you better and understand what golfers coming to UP AND DOWN are looking for.",
    "Nombre":"Name",
    "Tu nombre":"Your name",
    "TelÃ©fono / WhatsApp":"Phone / WhatsApp",
    "Nivel de juego":"Playing level",
    "Selecciona tu nivel":"Select your level",
    "Estoy empezando":"I'm just starting",
    "Principiante":"Beginner",
    "Intermedio":"Intermediate",
    "Avanzado":"Advanced",
    "Competitivo":"Competitive",
    "Â¿QuÃ© te gustarÃ­a mejorar?":"What would you like to improve?",
    "Selecciona un objetivo":"Select a goal",
    "Empezar desde cero":"Start from scratch",
    "Consistencia del swing":"Swing consistency",
    "MÃ¡s distancia / driver":"More distance / driver",
    "Hierros y precisiÃ³n":"Irons and accuracy",
    "Juego corto":"Short game",
    "Estrategia en campo":"Course strategy",
    "Otro":"Other",
    "CuÃ©ntanos un poco mÃ¡s":"Tell us a little more",
    "Ej. Quiero ser mÃ¡s consistente con el driver y perder menos golpes desde el tee.":"E.g. I want to be more consistent with my driver and lose fewer shots off the tee.",
    "Autorizo a UP AND DOWN a contactarme por WhatsApp, SMS o llamada para atender mi solicitud de clases y dar seguimiento relacionado con servicios de golf. Mi informaciÃ³n serÃ¡ utilizada para gestionar esta solicitud, atenciÃ³n comercial y anÃ¡lisis interno; no serÃ¡ vendida a terceros. Puedo solicitar dejar de recibir mensajes en cualquier momento.":"I authorize UP AND DOWN to contact me by WhatsApp, SMS or phone to handle my lesson request and follow up on related golf services. My information will be used to manage this request, commercial service and internal analytics; it will not be sold to third parties. I may ask to stop receiving messages at any time.",
    "Guardar y ver instructores":"Save and view instructors",
    "Instructores UP AND DOWN":"UP AND DOWN instructors",
    "Elige con quiÃ©n quieres trabajar.":"Choose who you'd like to work with.",
    "Tus datos quedaron guardados. Ahora puedes contactar directamente al instructor que prefieras.":"Your information was saved. You can now contact the instructor you prefer directly.",
    "Profesional e instructor":"Golf professional & instructor",
    "Planear una clase con Rodrigo":"Plan a lesson with Rodrigo",
    "Planear una clase con Mario":"Plan a lesson with Mario",
    "CuÃ©ntanos un poco mÃ¡s (opcional)":"Tell us a little more (optional)",
    "Â¿Quieres registrar a otra persona?":"Would you like to register another person?",
    "Puedes registrar a otra persona y los instructores seguirÃ¡n disponibles mientras completas sus datos.":"You can register another person while keeping the instructors available as you complete their details.",
    "Registrar a otra persona":"Register another person",


    "Novedades":"New arrivals","Tienda":"Shop","CategorÃ­as":"Categories","Servicios":"Services","Campos de golf":"Golf courses",
    "Equipo nuevo, seminuevo y piezas seleccionadas para tu juego, con asesorÃ­a personal en Los Cabos.":"New, pre-owned and curated golf equipment for your game, with personal advice in Los Cabos.",
    "Explorar colecciÃ³n":"Explore collection","Hierros":"Irons","Seminuevos":"Pre-owned","Descubre":"Discover",
    "Buscar productos":"Search products","CategorÃ­a":"Category","Todas las categorías":"All categories","CondiciÃ³n":"Condition","Cualquier condición":"Any condition","Nuevo":"New","Seminuevo":"Pre-owned","MÃ¡s filtros":"More filters",
    "CategorÃ­a: todas":"Category: all","CondiciÃ³n: cualquiera":"Condition: any","Todas las marcas":"All brands","Cualquier mano":"Any hand","Cualquier flex":"Any flex","Cualquier loft":"Any loft","Relevancia":"Relevance","MÃ¡s recientes":"Newest","Precio: menor a mayor":"Price: low to high","Precio: mayor a menor":"Price: high to low",
    "Los filtros de mano, loft y flex aparecen automÃ¡ticamente cuando esos datos existen en las especificaciones del producto.":"Hand, loft and flex filters appear automatically when those details exist in the product specifications.",
    "Borrar filtros":"Clear filters","Aplicar filtros y ver productos":"Apply filters & view products","Tu Golf Advisor":"Your Golf Advisor","Consultar con mi asesor":"Contact my advisor","Juego corto":"Short game","Seminuevos seleccionados":"Curated pre-owned",
    "ReciÃ©n llegados":"New arrivals","ReciÃ©n llegados.":"New arrivals.","Una selecciÃ³n dinÃ¡mica de los productos mÃ¡s recientes y piezas destacadas del catálogo.":"A dynamic selection of the newest products and highlighted pieces in the catalog.","Cargando novedades…":"Loading new arrivals…","Compra por categorÃ­a.":"Shop by category.","Ver toda la tienda":"View full shop",
    "El equipo correcto cambia el juego.":"The right equipment changes the game.","Consulta disponibilidad, compara condiciones y arma tu selecciÃ³n con inventario actualizado.":"Check availability, compare conditions and build your selection with updated inventory.","Filtra sin salir del catálogo":"Filter without leaving the catalog","· ajusta tu bÃºsqueda y resultados aquÃ­ mismo":"· refine your search and results right here","Filtrar catálogo":"Filter catalog","Aplicar filtros":"Apply filters",
    "Inventario actualizado":"Updated inventory","Pago seguro con Stripe":"Secure Stripe payment","AsesorÃ­a personal":"Personal advice","Consultando catálogo…":"Checking catalog…","Limpiar filtros":"Clear filters","Conectando con el catálogo…":"Connecting to catalog…",
    "Detalles que bajan golpes.":"Details that can save strokes.","Pelotas, guantes, accesorios y piezas seleccionadas para jugar con mÃ¡s confianza. Menos ruido; mejores decisiones.":"Balls, gloves, accessories and selected essentials to play with more confidence. Less noise; better decisions.","Explorar pelotas y accesorios":"Explore balls & accessories",
    "Servicios UP AND DOWN":"UP AND DOWN Services","MÃ¡s que equipo. AcompaÃ±amiento para tu juego.":"More than equipment. Support for your game.","RevisiÃ³n, valoraciÃ³n, mantenimiento y entrenamiento personalizado con atenciÃ³n directa y procesos sencillos.":"Inspection, trade-in evaluation, maintenance and personalized training with direct service and a simple process.",
    "DiagnÃ³stico inicial sin costo":"Complimentary initial assessment","ReparaciÃ³n de equipo":"Equipment repair","Â¿Tu equipo presenta desgaste, daÃ±o o alguna falla? LlÃ©valo a la tienda para una revisiÃ³n inicial sin costo. Evaluaremos su condición y te explicaremos las alternativas disponibles antes de realizar cualquier trabajo.":"Is your equipment showing wear, damage or a malfunction? Bring it to the shop for a complimentary initial assessment. We will evaluate its condition and explain the available options before any work begins.","RevisiÃ³n fÃ­sica del equipo.":"Physical inspection of the equipment.","DiagnÃ³stico inicial sin compromiso.":"No-obligation initial assessment.","CotizaciÃ³n previa antes de iniciar cualquier reparaciÃ³n.":"Quote provided before any repair begins.","Solicitar informaciÃ³n":"Request information","La reparaciÃ³n y el precio final se confirman Ãºnicamente despuÃ©s de revisar fÃ­sicamente el equipo.":"The repair scope and final price are confirmed only after a physical inspection of the equipment.",
    "ValoraciÃ³n presencial":"In-store evaluation","Intercambios con tienda":"Trade-ins","Trae tus palos, bolsa o equipo participante para una valoraciÃ³n presencial. Revisaremos marca, modelo, condición, antigÃ¼edad y demanda para determinar si puede considerarse como parte de pago en la compra de otro producto.":"Bring your clubs, bag or eligible equipment for an in-store evaluation. We will review brand, model, condition, age and demand to determine whether it can be considered toward the purchase of another product.","ValoraciÃ³n basada en condición real y demanda.":"Evaluation based on actual condition and demand.","Posibilidad de aplicar el valor como crÃ©dito en tienda.":"Potential to apply the value as store credit.","AceptaciÃ³n sujeta a revisiÃ³n y elegibilidad del equipo.":"Acceptance is subject to inspection and equipment eligibility.","Valorar mi equipo":"Evaluate my equipment","La recepciÃ³n del equipo no garantiza su aceptaciÃ³n ni un valor especÃ­fico.":"Receiving the equipment does not guarantee acceptance or a specific value.",
    "PrevenciÃ³n y cuidado":"Care & prevention","Mantenimiento":"Maintenance","MantÃ©n tu equipo listo para la siguiente ronda. Revisamos grips, limpieza general, ajustes bÃ¡sicos y seÃ±ales de desgaste para recomendar el mantenimiento adecuado.":"Keep your equipment ready for the next round. We inspect grips, perform general cleaning, basic adjustments and look for signs of wear to recommend the right maintenance.","Limpieza general de cabezas y varillas.":"General cleaning of clubheads and shafts.","RevisiÃ³n y posible cambio de grips.":"Grip inspection and replacement when needed.","InspecciÃ³n visual de desgaste y ajustes menores.":"Visual wear inspection and minor adjustments.","Consultar mantenimiento":"Ask about maintenance","El alcance del servicio se determina despuÃ©s de revisar el estado actual del equipo.":"The service scope is determined after reviewing the equipment's current condition.",
    "Entrenamiento personalizado":"Personalized training","Clase de entrenamiento":"Training session","Sesiones personalizadas para trabajar tÃ©cnica, consistencia y toma de decisiones. Elige un horario disponible y comparte tus objetivos para preparar mejor la clase.":"Personalized sessions focused on technique, consistency and decision-making. Choose an available time and share your goals so the session can be better prepared.","Opciones para nivel principiante, intermedio o avanzado.":"Options for beginner, intermediate or advanced players.","Objetivos posibles: swing, driver, juego corto, putting o consistencia general.":"Possible goals: swing, driver, short game, putting or overall consistency.","ConfirmaciÃ³n y seguimiento mediante HighLevel.":"Confirmation and follow-up through HighLevel.","Consultar por WhatsApp":"Ask on WhatsApp",
    "Juega donde el desierto toca el mar.":"Play where the desert meets the sea.","Directorio informativo para ubicar algunos de los campos mÃ¡s representativos. Los horarios y condiciones de acceso pueden cambiar; consulta siempre al club.":"An informative directory to help you locate some of the area's most representative courses. Hours and access conditions may change; always confirm directly with the club.",
    "San JosÃ© del Cabo":"San JosÃ© del Cabo","Km 7.5 Carretera Transpeninsular. Campo Jack Nicklaus Signature con 27 hoyos y vistas al mar y al desierto.":"Km 7.5 Transpeninsular Highway. A 27-hole Jack Nicklaus Signature course with ocean and desert views.","CÃ³mo llegar":"Directions","Sitio oficial":"Official website","Corredor TurÃ­stico":"Tourist Corridor","Km 19.5 Carretera Transpeninsular. Trazado de Robert Trent Jones Jr. con fairways amplios y vistas al Mar de CortÃ©s.":"Km 19.5 Transpeninsular Highway. A Robert Trent Jones Jr. layout with generous fairways and Sea of Cortez views.","Complejo de 27 hoyos diseÃ±ado por Jack Nicklaus y Greg Norman, a pocos minutos del centro histÃ³rico de San JosÃ© del Cabo.":"A 27-hole complex designed by Jack Nicklaus and Greg Norman, just minutes from historic downtown San JosÃ© del Cabo.",
    "Historias para jugar mejor.":"Stories to play better.","GuÃ­as breves creadas para disfrutar el golf en Los Cabos con mejores decisiones, mÃ¡s preparaciÃ³n y menos improvisaciÃ³n.":"Short guides created to help you enjoy golf in Los Cabos with better decisions, better preparation and less improvisation.","Destino · Los Cabos":"Destination · Los Cabos","CÃ³mo elegir el campo ideal para tu ronda.":"How to choose the right course for your round.","Mar, desierto, viento y diferentes niveles de dificultad: cada campo de Los Cabos ofrece una experiencia distinta.":"Ocean, desert, wind and different levels of difficulty: every course in Los Cabos offers a different experience.","Leer artÃ­culo":"Read article","Cerrar artÃ­culo":"Close article",
    "Antes de elegir un campo, piensa primero en la experiencia que buscas. Una ronda panorÃ¡mica no siempre es la mÃ¡s indulgente, y un trazado tÃ©cnico puede ser excelente para un jugador experimentado, pero frustrante para quien apenas está retomando el juego.":"Before choosing a course, first think about the experience you want. A scenic round is not always the most forgiving, and a technical layout may be excellent for an experienced player but frustrating for someone just getting back into the game.","Experiencia":"Experience","Consulta dificultad, tipo de terreno y ritmo estimado de juego.":"Check difficulty, terrain type and expected pace of play.","Clima":"Weather","En Los Cabos, el viento y la hora de salida pueden cambiar completamente la ronda.":"In Los Cabos, wind and tee time can completely change the round.","LogÃ­stica":"Logistics","Revisa ubicaciÃ³n, acceso, cÃ³digo de vestimenta y polÃ­ticas del club.":"Check location, access, dress code and club policies.","La recomendaciÃ³n de Coque":"Coque's recommendation","Para una primera visita, prioriza una combinaciÃ³n equilibrada de paisaje, accesibilidad y nivel de dificultad. Cuando ya conozcas cÃ³mo juegas con el viento y la firmeza del terreno local, serÃ¡ mÃ¡s fÃ¡cil buscar retos tÃ©cnicos especÃ­ficos.":"For a first visit, prioritize a balanced combination of scenery, accessibility and difficulty. Once you understand how your game reacts to the local wind and firm conditions, it will be easier to seek out specific technical challenges.","Los horarios, condiciones de acceso y disponibilidad pueden cambiar. UP AND DOWN funciona Ãºnicamente como directorio informativo; confirma siempre los detalles directamente con el campo.":"Hours, access conditions and availability may change. UP AND DOWN serves only as an informational directory; always confirm details directly with the course.",
    "CÃ³mo elegir un driver sin comprar solo distancia.":"How to choose a driver without buying distance alone.","La cabeza mÃ¡s nueva o el loft mÃ¡s bajo no garantizan mejores salidas. El objetivo real es encontrar consistencia.":"The newest head or lowest loft does not guarantee better drives. The real goal is consistency.","Un buen driver debe ayudarte a repetir un patrÃ³n de vuelo Ãºtil, no solamente producir un golpe espectacular de vez en cuando. Loft, flexibilidad de la varilla, longitud, peso y distribuciÃ³n de masa trabajan juntos.":"A good driver should help you repeat a useful ball flight, not just produce one spectacular shot once in a while. Loft, shaft flex, length, weight and mass distribution all work together.","MÃ¡s loft puede facilitar el lanzamiento y reducir la pÃ©rdida de distancia por golpes bajos.":"More loft can help launch the ball and reduce distance loss from low strikes.","Varilla":"Shaft","El flex correcto debe acompaÃ±ar tu velocidad y tempo, no tu ego. El ego rara vez encuentra fairway.":"The right flex should match your speed and tempo, not your ego. Ego rarely finds the fairway.","PerdÃ³n":"Forgiveness","Una cabeza estable conserva mÃ¡s velocidad cuando el impacto no ocurre en el centro.":"A stable head preserves more speed when impact is off-center.","Prioriza dispersiÃ³n":"Prioritize dispersion","Compara la distancia promedio y la dispersiÃ³n, no Ãºnicamente el golpe mÃ¡s largo. Diez metros menos dentro del fairway suelen valer mÃ¡s que veinte metros adicionales desde una posiciÃ³n complicada.":"Compare average distance and dispersion, not only your longest shot. Ten fewer meters from the fairway are often worth more than twenty extra meters from trouble.","Cuando sea posible, prueba distintas configuraciones antes de decidir. La selecciÃ³n correcta debe sentirse repetible y cÃ³moda durante toda la ronda.":"Whenever possible, test different configurations before deciding. The right setup should feel repeatable and comfortable throughout the round.",
    "QuÃ© llevar para jugar bajo el clima de Los Cabos.":"What to carry for golf in Los Cabos weather.","Sol intenso, viento y cambios de temperatura entre la maÃ±ana y la tarde exigen una bolsa bien planeada.":"Strong sun, wind and temperature changes from morning to afternoon call for a well-planned golf bag.","Prepararte para el entorno ayuda tanto como elegir el palo correcto. AdemÃ¡s de tu equipo habitual, considera protecciÃ³n solar, hidrataciÃ³n, capas ligeras y accesorios que mantengan el agarre estable.":"Preparing for the environment matters almost as much as choosing the right club. Along with your usual equipment, consider sun protection, hydration, light layers and accessories that keep your grip secure.","ProtecciÃ³n":"Protection","Gorra, lentes, bloqueador y manga ligera para exposiciÃ³n prolongada.":"Cap, sunglasses, sunscreen and a light sleeve for prolonged exposure.","Agarre":"Grip","Guante adicional y toalla seca para mantener control cuando aumenta el calor.":"An extra glove and dry towel help maintain control as temperatures rise.","HidrataciÃ³n":"Hydration","Agua y electrolitos antes de sentir sed; el clima seco puede engaÃ±ar.":"Water and electrolytes before you feel thirsty; the dry climate can be deceptive.","Menos peso, mejor selecciÃ³n":"Less weight, better selection","No necesitas llenar todos los bolsillos. Lleva solamente lo que resuelva una necesidad real durante la ronda y revisa previamente si el campo ofrece agua, prÃ¡ctica, restaurante o tienda.":"You do not need to fill every pocket. Carry only what solves a real need during the round and check in advance whether the course offers water, practice facilities, a restaurant or a shop.","En salidas tempranas puede sentirse fresco, mientras que al mediodÃ­a la radiaciÃ³n aumenta considerablemente. Una capa ligera y transpirable suele ser la mejor soluciÃ³n.":"Early tee times can feel cool, while midday sun exposure rises considerably. A light, breathable layer is often the best solution.",
    "EnvÃ­o seguro":"Secure shipping","CoordinaciÃ³n personalizada.":"Personalized coordination.","Pago seguro":"Secure payment","Procesado con Stripe.":"Processed with Stripe.","AtenciÃ³n personal":"Personal service","Por golfistas, para golfistas.":"By golfers, for golfers.","Disponibilidad conciliada antes del pago.":"Availability reconciled before payment.","Equipamiento premium para golfistas que viven el juego con pasiÃ³n, precisiÃ³n y estilo.":"Premium equipment for golfers who live the game with passion, precision and style.","Todos los productos":"All products","ConÃ©ctate":"Connect","Golf Concierge":"Golf Concierge","Consulta equipo y configuraciÃ³n":"Ask about equipment & setup",
    "Tu carrito":"Your cart","productos":"products","Buscar":"Search","Asesor":"Advisor","Carrito":"Cart","Subtotal":"Subtotal","Finalizar compra segura":"Secure checkout","Inventario validado antes de continuar a Stripe.":"Inventory is validated before continuing to Stripe.","Precio expresado en pesos mexicanos (MXN).":"Price shown in Mexican pesos (MXN).","Para qué jugador":"Player profile","Configuración":"Configuration","CondiciÃ³n y disponibilidad":"Condition & availability","Producto":"Product","Consulta detalles con nuestro equipo.":"Ask our team for details.","Disponible":"Available","Agregar al carrito":"Add to cart","Consultar este equipo":"Ask about this equipment","Preguntar sobre este equipo":"Ask about this equipment","¿Tienes equipo para intercambiar?":"Have equipment to trade in?","Pago confirmado":"Payment confirmed","Tu pedido está en juego.":"Your order is in play.","Recibimos tu compra correctamente. Nuestro equipo continuarÃ¡ con la preparaciÃ³n y coordinaciÃ³n de entrega.":"Your purchase was received successfully. Our team will continue with preparation and delivery coordination.","Continuar comprando":"Continue shopping"
,
    "Novedades y ofertas.":"New arrivals & offers.",
    "Lo mÃ¡s reciente del inventario y oportunidades con precio especial.":"The newest inventory plus selected opportunities with special pricing.",
    "Cargando novedades y ofertas…":"Loading new arrivals & offers…",
    "ReparaciÃ³n, intercambio, mantenimiento, clases, restauraciones y acceso a GHIN con atenciÃ³n directa.":"Repair, trade-in, maintenance, lessons, restorations and GHIN access with direct service.",
    "Clases de golf":"Golf lessons",
    "Sesiones para trabajar tÃ©cnica, consistencia y toma de decisiones segÃºn tu nivel y objetivos.":"Sessions focused on technique, consistency and decision-making based on your level and goals.",
    "Principiante, intermedio o avanzado.":"Beginner, intermediate or advanced.",
    "Swing, driver, juego corto o putting.":"Swing, driver, short game or putting.",
    "Agenda y seguimiento directo.":"Direct scheduling and follow-up.",
    "Restauraciones de Putters":"Putter restorations",
    "Recupera una pieza especial":"Restore a special piece",
    "Evaluamos tu putter para orientarte sobre opciones de restauraciÃ³n, acabado y recuperaciÃ³n estÃ©tica de acuerdo con su estado actual.":"We evaluate your putter and guide you through restoration, finish and cosmetic recovery options based on its current condition.",
    "RevisiÃ³n previa del putter.":"Initial putter inspection.",
    "Opciones segÃºn material y condición.":"Options based on material and condition.",
    "CotizaciÃ³n antes de iniciar.":"Quote before work begins.",
    "Consultar restauraciÃ³n":"Ask about restoration",
    "La viabilidad del trabajo se confirma despuÃ©s de revisar la pieza.":"Feasibility is confirmed after inspecting the piece.",
    "Handicap oficial":"Official handicap",
    "ObtÃ©n informaciÃ³n para incorporarte a GHIN y llevar un seguimiento reconocido de tu Handicap Index.":"Get information about joining GHIN and maintaining a recognized Handicap Index.",
    "InformaciÃ³n sobre el registro.":"Registration information.",
    "OrientaciÃ³n para comenzar.":"Guidance to get started.",
    "Contacto directo con Carlos.":"Direct contact with Carlos.",
    "Quiero informaciÃ³n de GHIN":"I want GHIN information",
    "Una selecciÃ³n local de campos. Mostramos Ãºnicamente los que estÃ©n publicados por UP AND DOWN.":"A local course selection. We only show courses published by UP AND DOWN.",
    "Historias, guÃ­as y notas para jugar, elegir y disfrutar mejor el golf en Los Cabos.":"Stories, guides and notes to play, choose and enjoy golf in Los Cabos.",
    "Ver mÃ¡s artÃ­culos":"View more articles",
    "Ver menos artÃ­culos":"View fewer articles",
    "Golf, con criterio local.":"Golf, with local perspective.",
    "UP AND DOWN reÃºne tienda, asesorÃ­a y servicios para hacer mÃ¡s simple elegir, cuidar y disfrutar tu equipo de golf en Los Cabos.":"UP AND DOWN brings together shop, advice and services to make choosing, caring for and enjoying your golf equipment in Los Cabos simpler.",
    "No buscamos llenar tu bolsa por llenar. Preferimos ayudarte a encontrar lo que tiene sentido para tu juego, acompaÃ±arte cuando tu equipo necesita atenciÃ³n y conectarte con experiencias que suman dentro y fuera del campo.":"We are not here to fill your bag for the sake of it. We prefer to help you find what makes sense for your game, support you when your equipment needs attention and connect you with experiences that add value on and off the course.",
    "Conoce nuestros servicios":"Explore our services",
    "QuiÃ©nes somos":"About us",
    "Explorar":"Explore",
    "Cerrar bÃºsqueda":"Close search",
    "Elige una categorÃ­a para mostrar Ãºnicamente los filtros tÃ©cnicos que correspondan.":"Choose a category to reveal only the technical filters that apply.",
    "Mostramos Ãºnicamente los filtros tÃ©cnicos disponibles para esta categorÃ­a de palos.":"Only technical filters available for this club category are shown.",
    "Ocultamos mano, flex y loft porque no corresponden a esta categorÃ­a.":"Club-specific filters are hidden because they do not apply to this category."
  };
  const STATIC_ES=Object.fromEntries(Object.entries(STATIC_EN).map(([es,en])=>[en,es]));
  const ATTR_EN={
    "Abrir carrito":"Open cart","Abrir menÃº":"Open menu","Accesos rÃ¡pidos a la tienda":"Quick shop links","Acciones rÃ¡pidas de compra":"Quick purchase actions","Bolsa y equipo de golf en campo":"Golf bag and equipment on the course","Buscar":"Search","Buscar producto, marca, modelo o shaft…":"Search product, brand, model or shaft…","Buscar productos":"Search products","Calendario de clase de entrenamiento UP AND DOWN":"UP AND DOWN training session calendar","Campo de golf costero":"Coastal golf course","Campo de golf en Los Cabos":"Golf course in Los Cabos","Campo de golf entre desierto y mar":"Golf course between desert and sea","Carrito":"Cart","Cerrar carrito":"Close cart","Cerrar detalle":"Close details","Cerrar menÃº":"Close menu","Colecciones rÃ¡pidas":"Quick collections","Compromisos de compra":"Purchase commitments","GalerÃ­a del producto":"Product gallery","Golfista preparando un golpe":"Golfer preparing a shot","Green de golf":"Golf green","Imagen anterior":"Previous image","Ir a tienda":"Go to shop","Marcas de golf":"Golf brands","NavegaciÃ³n mÃ³vil":"Mobile navigation","NavegaciÃ³n principal":"Main navigation","Pelotas de golf sobre green":"Golf balls on a green","Siguiente imagen":"Next image","UP AND DOWN, inicio":"UP AND DOWN, home","Visitar la pÃ¡gina oficial de UP AND DOWN":"Visit the official UP AND DOWN website","Â¿Necesitas asistencia? EscrÃ­benos por WhatsApp":"Need assistance? Message us on WhatsApp"
  };
  const ATTR_ES=Object.fromEntries(Object.entries(ATTR_EN).map(([es,en])=>[en,es]));
  const CATEGORY_EN={
    "driver":"Drivers","drivers":"Drivers","hierro":"Irons","hierros":"Irons","iron":"Irons","irons":"Irons","madera":"Fairway Woods","maderas":"Fairway Woods","wood":"Fairway Woods","woods":"Fairway Woods","hibrido":"Hybrids","hibridos":"Hybrids","hybrid":"Hybrids","hybrids":"Hybrids","wedge":"Wedges","wedges":"Wedges","putter":"Putters","putters":"Putters","pelota":"Golf Balls","pelotas":"Golf Balls","golf balls":"Golf Balls","bola":"Golf Balls","bolas":"Golf Balls","guante":"Gloves","guantes":"Gloves","glove":"Gloves","gloves":"Gloves","bolsa":"Golf Bags","bolsas":"Golf Bags","bag":"Golf Bags","bags":"Golf Bags","accesorio":"Accessories","accesorios":"Accessories","accessories":"Accessories","ropa":"Apparel","apparel":"Apparel","calzado":"Golf Shoes","zapatos":"Golf Shoes","shoes":"Golf Shoes","tees":"Tees","tee":"Tees"
  };
  function categoryLabel(category){
    if(!category)return currentLanguage==="en"?"Golf":"Golf";
    if(currentLanguage!=="en")return category.name||category.slug||"Golf";
    const candidates=[category.slug,category.name].filter(Boolean).map(v=>normalizeSpecKey(v));
    for(const key of candidates){if(CATEGORY_EN[key])return CATEGORY_EN[key];for(const [needle,label] of Object.entries(CATEGORY_EN)){if(key===needle||key.includes(needle))return label}}
    return category.name||"Golf";
  }
  function localizeStaticDom(lang){
    const root=document.getElementById("updown-store");if(!root)return;
    const map=lang==="en"?STATIC_EN:STATIC_ES;
    const walker=document.createTreeWalker(root,NodeFilter.SHOW_TEXT);
    const nodes=[];while(walker.nextNode())nodes.push(walker.currentNode);
    nodes.forEach(node=>{
      if(node.parentElement?.closest("script,style"))return;
      const raw=node.nodeValue||"";const trimmed=raw.trim();if(!trimmed)return;
      const translated=map[trimmed];if(!translated)return;
      node.nodeValue=raw.replace(trimmed,translated);
    });
    const attrMap=lang==="en"?ATTR_EN:ATTR_ES;
    root.querySelectorAll("[aria-label],[placeholder],[title],[alt]").forEach(node=>{
      ["aria-label","placeholder","title","alt"].forEach(attr=>{const value=node.getAttribute(attr);if(value&&attrMap[value])node.setAttribute(attr,attrMap[value])});
    });
  }
  function localizedProductText(product,field){
    if(currentLanguage!=="en")return product?.[field]||"";
    const specs=product?.specifications&&typeof product.specifications==="object"?product.specifications:{};
    const aliases=field==="description"?["description_en","english_description","description english"]:["short_description_en","english_short_description","short description english"];
    for(const key of aliases){if(specs[key])return String(specs[key])}
    return product?.[field]||"";
  }

  function ghinMessage(lang=currentLanguage){
    return lang==="en"
      ?"Hi Carlos ðŸ‘‹ Iâ€™m coming from UP AND DOWN · Coque. Iâ€™d like information about joining GHIN and how registration works. Thank you."
      :"Hola Carlos ðŸ‘‹ Vengo de UP AND DOWN · Coque. Me gustarÃ­a recibir informaciÃ³n para unirme a GHIN y conocer cÃ³mo funciona el registro. Gracias.";
  }
  function buildGhinWhatsAppUrl(lang=currentLanguage){
    return `https://wa.me/526241299870?text=${encodeURIComponent(ghinMessage(lang))}`;
  }

  function localizeWhatsAppLinks(lang){
    const serviceMessages={
      repair:{
        es:"Hola UP AND DOWN, quiero solicitar informaciÃ³n sobre reparaciÃ³n de equipo de golf.",
        en:"Hi UP AND DOWN, I would like information about golf equipment repair."
      },
      trade:{
        es:"Hola UP AND DOWN, quiero llevar mi equipo a valoraciÃ³n para conocer si puede aplicar para intercambio en tienda.",
        en:"Hi UP AND DOWN, I would like to bring in my equipment for an evaluation to see whether it may qualify for a trade-in."
      },
      maintenance:{
        es:"Hola UP AND DOWN, quiero consultar el servicio de mantenimiento para mi equipo de golf.",
        en:"Hi UP AND DOWN, I would like information about maintenance service for my golf equipment."
      },
      classes:{
        es:"Hola UP AND DOWN, quiero informaciÃ³n sobre las clases de golf y los horarios disponibles.",
        en:"Hi UP AND DOWN, I would like information about golf lessons and available times."
      },
      "putter-restoration":{
        es:"Hola UP AND DOWN, quiero consultar el servicio de reparaciÃ³n de Putters para mi equipo de golf.",
        en:"Hi UP AND DOWN, I would like information about the putter restoration service for my golf equipment."
      },
      ghin:{
        es:ghinMessage("es"),
        en:ghinMessage("en")
      }
    };

    document.querySelectorAll("#udsServices [data-service-whatsapp]").forEach(link=>{
      const kind=link.dataset.serviceWhatsapp;
      const message=serviceMessages[kind]?.[lang];
      if(!message)return;
      const phone=kind==="ghin"?"526241299870":"526243554700";
      link.href=`https://wa.me/${phone}?text=${encodeURIComponent(message)}`;
    });

    document.querySelectorAll("#updown-store [data-ghin-contact]").forEach(link=>{
      link.href=buildGhinWhatsAppUrl(lang);
    });

    const footerWa=document.querySelector("#updown-store .uds-footer [data-general-whatsapp]");
    if(footerWa){
      const message=lang==="en"
        ?"Hi UP AND DOWN, I need assistance with the shop."
        :"Hola UP AND DOWN, necesito asistencia con la tienda.";
      footerWa.href=`https://wa.me/526243554700?text=${encodeURIComponent(message)}`;
    }
  }

  const commerceTranslations={
    es:{
      announcement:"Curated golf equipment · Compra segura con Stripe · AtenciÃ³n personalizada en Los Cabos",
      nav:["Novedades","Tienda","CategorÃ­as","Servicios","Clases","Campos de golf","Cabo Journal","GHIN","QuiÃ©nes somos"],
      hero:"Equipo seleccionado para jugar mejor, con asesorÃ­a personal en Los Cabos.",
      explore:"Explorar equipo â†’",featured:"Coqueâ€™s Picks",search:"Buscar producto, marca, modelo o shaft…",filters:"Filtros",
      resultsEmpty:"No encontramos productos con esos filtros.",clear:"Limpiar filtros",
      newEyebrow:"Latest arrivals & offers",newTitle:"Novedades y ofertas.",newIntro:"Lo mÃ¡s reciente del inventario y oportunidades con precio especial.",
      categoryEyebrow:"Shop by category",categoryTitle:"Compra por categorÃ­a.",categoryLink:"Ver toda la tienda",
      catalogEyebrow:"The collection",catalogTitle:"El equipo correcto cambia el juego.",catalogIntro:"Consulta disponibilidad, compara configuraciones y arma tu selecciÃ³n con inventario actualizado."
    },
    en:{
      announcement:"Curated golf equipment · Secure Stripe checkout · Personal service in Los Cabos",
      nav:["New arrivals","Shop","Categories","Services","Lessons","Golf courses","Cabo Journal","GHIN","About us"],
      hero:"Curated equipment to play better, with personal advice in Los Cabos.",
      explore:"Explore equipment â†’",featured:"Coqueâ€™s Picks",search:"Search product, brand, model or shaft…",filters:"Filters",
      resultsEmpty:"No products match these filters.",clear:"Clear filters",
      newEyebrow:"Latest arrivals & offers",newTitle:"New arrivals & offers.",newIntro:"The newest inventory plus selected opportunities with special pricing.",
      categoryEyebrow:"Shop by category",categoryTitle:"Shop by category.",categoryLink:"View full shop",
      catalogEyebrow:"The collection",catalogTitle:"The right equipment changes the game.",catalogIntro:"Check availability, compare configurations and build your selection with updated inventory."
    }
  };
  function applyLanguage(lang){
    currentLanguage=lang==="en"?"en":"es";localStorage.setItem("upDownLanguage",currentLanguage);
    const t=commerceTranslations[currentLanguage];
    document.documentElement.lang=currentLanguage;
    
    const navCopy={
      new:t.nav[0],
      shop:t.nav[1],
      categories:t.nav[2],
      services:t.nav[3],
      classes:t.nav[4],
      courses:t.nav[5],
      journal:t.nav[6]
    };
    document.querySelectorAll("#updown-store .uds-desktop-nav [data-nav-key]").forEach(node=>{
      const key=node.getAttribute("data-nav-key");
      if(key&&navCopy[key])node.textContent=navCopy[key];
    });
    el("udsHeroCopy").textContent=t.hero;el("udsExploreButton").innerHTML=t.explore.replace("â†’","<span>â†’</span>");if(el("udsFeaturedButton"))el("udsFeaturedButton").textContent=t.featured;el("udsSearch").placeholder=t.search;
    el("udsFiltersToggle").childNodes[0].nodeValue=`${t.filters} `;el("udsClearFilters").textContent=t.clear;
    const newHead=document.querySelector("#udsNew .uds-section-head");
    const categoryHead=document.querySelector("#udsCategories .uds-section-head");
    const catalogHead=document.querySelector("#udsCatalog .uds-section-head");
    if(newHead){newHead.querySelector(".uds-eyebrow").textContent=t.newEyebrow;newHead.querySelector("h2").textContent=t.newTitle;newHead.querySelector(".uds-section-intro").textContent=t.newIntro}
    if(categoryHead){
      const eyebrow=categoryHead.querySelector(".uds-eyebrow");
      const heading=categoryHead.querySelector("h2");
      if(eyebrow)eyebrow.textContent=t.categoryEyebrow;
      if(heading)heading.textContent=currentLanguage==="en"?"Find what you need.":"Encuentra lo que buscas.";
      const legacyCategoryLink=categoryHead.querySelector(".uds-text-link");
      if(legacyCategoryLink)legacyCategoryLink.textContent=t.categoryLink;
      const categoryToggle=el("udsCategoriesToggle");
      if(categoryToggle){
        const expanded=el("udsCategoryGrid")?.classList.contains("is-expanded");
        categoryToggle.textContent=expanded
          ?(currentLanguage==="en"?"View fewer categories":"Ver menos categorías")
          :(currentLanguage==="en"?"View all categories":"Ver todas las categorías");
      }
    }
    if(catalogHead){catalogHead.querySelector(".uds-eyebrow").textContent=t.catalogEyebrow;catalogHead.querySelector("h2").textContent=currentLanguage==="en"?"Your next equipment, without the noise.":"Tu próximo equipo, sin ruido.";catalogHead.querySelector(".uds-section-intro").textContent=currentLanguage==="en"?"Search, filter and open each product to view configuration, condition and availability.":"Busca, filtra y abre cada producto para ver configuraciÃ³n, condición y disponibilidad."}
    el("udsLangEs").classList.toggle("is-active",currentLanguage==="es");el("udsLangEn").classList.toggle("is-active",currentLanguage==="en");el("udsLangEs").setAttribute("aria-pressed",String(currentLanguage==="es"));el("udsLangEn").setAttribute("aria-pressed",String(currentLanguage==="en"));
    el("udsConditionFilter").options[0].text=currentLanguage==="en"?"Any condition":"Cualquier condición";el("udsConditionFilter").options[1].text=currentLanguage==="en"?"New":"Nuevo";el("udsConditionFilter").options[2].text=currentLanguage==="en"?"Pre-owned":"Seminuevo";el("udsConditionFilter").options[3].text="Demo";
    el("udsConditionMobileFilter").options[0].text=currentLanguage==="en"?"Condition: any":"CondiciÃ³n: cualquiera";el("udsConditionMobileFilter").options[1].text=currentLanguage==="en"?"New":"Nuevo";el("udsConditionMobileFilter").options[2].text=currentLanguage==="en"?"Pre-owned":"Seminuevo";el("udsConditionMobileFilter").options[3].text="Demo";
    if(el("udsCatalogSearch"))el("udsCatalogSearch").placeholder=t.search;
    if(el("udsDiscoveryApply"))el("udsDiscoveryApply").textContent=currentLanguage==="en"?"Apply filters & view products":"Aplicar filtros y ver productos";
    if(el("udsDiscoveryClear"))el("udsDiscoveryClear").textContent=currentLanguage==="en"?"Clear filters":"Borrar filtros";
    if(el("udsCatalogApply"))el("udsCatalogApply").textContent=currentLanguage==="en"?"Apply filters":"Aplicar filtros";
    if(el("udsCatalogClear"))el("udsCatalogClear").textContent=currentLanguage==="en"?"Clear filters":"Borrar filtros";
    if(el("udsCatalogFilterToggle"))el("udsCatalogFilterToggle").textContent=currentLanguage==="en"?"Filter catalog":"Filtrar catálogo";
    renderCategories();renderCommerceFilters();renderAdvisorBar();renderPicks();renderNewArrivals();applyFilters();renderCart();if(modalProduct&&el("udsModal").classList.contains("is-open"))openProduct(modalProduct);
    localizeStaticDom(currentLanguage);
    localizeWhatsAppLinks(currentLanguage);
    setupJournalVisibility();
  }
  if(el("udsLangEs"))if(el("udsLangEs"))el("udsLangEs").onclick=()=>applyLanguage("es");if(el("udsLangEn"))if(el("udsLangEn"))el("udsLangEn").onclick=()=>applyLanguage("en");

  // NavegaciÃ³n inmersiva y fija.
  const udsHeader=document.querySelector("#updown-store .uds-header");
  const udsAnnouncement=document.querySelector("#updown-store .uds-announcement");
  const udsLogo=document.querySelector("#updown-store .uds-logo");
  let udsLastScrollY=window.scrollY;

  function updateImmersiveNavigation(){
    const isMobile=window.matchMedia("(max-width:760px)").matches;
    const scrolled=window.scrollY>56;

    udsHeader?.classList.toggle("is-scrolled",scrolled);

    if(isMobile){
      udsHeader?.classList.toggle("is-mobile-capsule",scrolled);
      udsAnnouncement?.classList.toggle("is-mobile-hidden",scrolled);
    }else{
      udsHeader?.classList.remove("is-mobile-capsule");
      udsAnnouncement?.classList.remove("is-mobile-hidden");
    }

    udsLastScrollY=window.scrollY;
  }

  window.addEventListener(
    "scroll",
    updateImmersiveNavigation,
    {passive:true}
  );

  window.addEventListener(
    "resize",
    updateImmersiveNavigation
  );

  udsLogo?.addEventListener("click",event=>{
    const isMobileCapsule=
      window.matchMedia("(max-width:760px)").matches &&
      udsHeader?.classList.contains("is-mobile-capsule");

    if(isMobileCapsule){
      event.preventDefault();
      openMenu();
    }
  });

  updateImmersiveNavigation();


  function setupStaticImageFallbacks(){
    document.querySelectorAll("#updown-store .uds-course").forEach(course=>{
      const img=course.querySelector(".uds-course-bg");
      markImageFallback(img,course);
    });
    document.querySelectorAll("#updown-store .uds-journal-media").forEach(media=>{
      const img=media.querySelector("img");
      markImageFallback(img,media);
    });
    document.querySelectorAll("#updown-store .uds-brand-name img").forEach(img=>{
      img.addEventListener("error",()=>{img.style.display="none"},{once:true});
    });
  }

  function applyManagedContentVisibility(){
    document.querySelectorAll("#updown-store [data-content-active]").forEach(node=>{
      const active=String(node.dataset.contentActive||"true").toLowerCase()!=="false";
      node.hidden=!active;
    });
  }

  function setupJournalVisibility(){
    const grid=el("udsJournalGrid");
    const more=el("udsJournalMore");
    if(!grid||!more)return;
    if(grid.dataset.source==="supabase")return;
    grid.innerHTML="";
    more.classList.add("uds-hidden");
    more.hidden=true;
    more.onclick=null;
  }


  // -------------------------------------------------------------------------
  // CLASES · Lead capture -> Supabase -> instructors -> WhatsApp attribution
  // -------------------------------------------------------------------------
  let udsGolfLessonLeadId=null;
  let udsGolfLessonLeadToken=null;
  let udsGolfLessonLeadData=null;
  const udsGolfLessonAccessKey="upDownGolfLessonAccessV1"; // first valid lead = persistent device owner

  const udsSkillLabels={
    es:{new:"Estoy empezando",beginner:"Principiante",intermediate:"Intermedio",advanced:"Avanzado",competitive:"Competitivo"},
    en:{new:"I'm just starting",beginner:"Beginner",intermediate:"Intermediate",advanced:"Advanced",competitive:"Competitive"}
  };
  const udsGoalLabels={
    es:{starting:"empezar desde cero",consistency:"mejorar la consistencia del swing",distance:"ganar distancia con el driver",irons:"mejorar hierros y precisiÃ³n",short_game:"mejorar el juego corto",putting:"mejorar el putting",strategy:"trabajar estrategia en campo",other:"trabajar un objetivo especÃ­fico"},
    en:{starting:"start from scratch",consistency:"improve swing consistency",distance:"gain distance with the driver",irons:"improve irons and accuracy",short_game:"improve the short game",putting:"improve putting",strategy:"work on course strategy",other:"work on a specific goal"}
  };

  function udsClassFormMessage(message,type=""){
    const node=el("udsClassLeadStatus");
    if(!node)return;
    node.textContent=message||"";
    node.className=`uds-class-form-status${type?` is-${type}`:""}`;
  }

  function udsClassRequiredFieldsValid(){
    const name=String(el("udsClassName")?.value||"").trim();
    const phoneDigits=udsClassPhoneDigits(el("udsClassPhone")?.value||"");
    const skill=String(el("udsClassLevel")?.value||"");
    const goal=String(el("udsClassGoal")?.value||"");
    return name.length>=2 && phoneDigits.length>=10 && phoneDigits.length<=15 && !!skill && !!goal;
  }

  function udsClassConsentSync(){
    const submit=el("udsClassLeadSubmit");
    if(!submit)return;
    const consent=!!el("udsClassConsent")?.checked;
    submit.disabled=!(consent && udsClassRequiredFieldsValid());
  }

  function udsGetUtm(name){
    try{return new URLSearchParams(window.location.search).get(name)||null}catch{return null}
  }
  function udsReferrerHost(){
    try{return document.referrer?new URL(document.referrer).hostname:null}catch{return null}
  }
  function udsClassPhoneDigits(value){return String(value||"").replace(/\D/g,"")}
  function udsInstructorPhone(slug){return slug==="rodrigo-uribe"?"526241222731":"526241105711"}

  function udsClassWhatsAppMessage(instructorName){
    const lang=currentLanguage==="en"?"en":"es";
    const d=udsGolfLessonLeadData||{};
    const skill=(udsSkillLabels[lang]||udsSkillLabels.es)[d.skill_level]||d.skill_level||"";
    const goal=(udsGoalLabels[lang]||udsGoalLabels.es)[d.goal_category]||d.goal_category||"";
    const comment=String(d.goal_text||"").trim();
    const shortRef=udsGolfLessonLeadId?String(udsGolfLessonLeadId).slice(0,8).toUpperCase():"";

    if(lang==="en"){
      const lines=[
        d.name
          ?`Hi ${instructorName}, I'm ${d.name} ðŸ‘‹ I came from UP AND DOWN · Coque. I already registered a lesson request on the website and I'd like to coordinate a lesson with you.`
          :`Hi ${instructorName} ðŸ‘‹ I came from UP AND DOWN · Coque. I already registered a lesson request on the website and I'd like to coordinate a lesson with you.`
      ];
      lines.push("");
      if(skill)lines.push(`Playing level: ${skill}`);
      if(goal)lines.push(`What I'd like to improve: ${goal}`);
      if(comment)lines.push(`Comments: ${comment}`);
      if(shortRef)lines.push(`Ref: ${shortRef}`);
      return lines.join("\n");
    }

    const lines=[
      d.name
        ?`Hola ${instructorName}, soy ${d.name} ðŸ‘‹ Vengo de UP AND DOWN · Coque. Ya registrÃ© anteriormente una solicitud de clases en la pÃ¡gina y me gustarÃ­a coordinar una clase contigo.`
        :`Hola ${instructorName} ðŸ‘‹ Vengo de UP AND DOWN · Coque. Ya registrÃ© anteriormente una solicitud de clases en la pÃ¡gina y me gustarÃ­a coordinar una clase contigo.`
    ];
    lines.push("");
    if(skill)lines.push(`Nivel de juego: ${skill}`);
    if(goal)lines.push(`QuÃ© me gustarÃ­a mejorar: ${goal}`);
    if(comment)lines.push(`Comentarios: ${comment}`);
    if(shortRef)lines.push(`Ref: ${shortRef}`);
    return lines.join("\n");
  }

  async function udsHydrateGolfLessonLeadContext(){
    if(!udsGolfLessonLeadId||!udsGolfLessonLeadToken)return false;

    try{
      const {data,error}=await db.rpc("get_golf_lesson_lead_context",{
        p_lead_id:udsGolfLessonLeadId,
        p_lead_token:udsGolfLessonLeadToken
      });
      if(error)throw error;

      const result=Array.isArray(data)?data[0]:data;
      if(!result?.name)return false;

      udsGolfLessonLeadData={
        name:result.name,
        skill_level:result.skill_level,
        goal_category:result.goal_category,
        goal_text:result.goal_text||""
      };

      udsUpdateInstructorLinks();
      return true;
    }catch(error){
      console.warn("Could not hydrate golf lesson lead context",error);
      return false;
    }
  }

  function udsUpdateInstructorLinks(){
    document.querySelectorAll("#updown-store .uds-teacher-whatsapp").forEach(link=>{
      const slug=link.getAttribute("data-instructor-slug")||"";
      const name=link.getAttribute("data-instructor-name")||"";
      link.href=`https://wa.me/${udsInstructorPhone(slug)}?text=${encodeURIComponent(udsClassWhatsAppMessage(name))}`;
    });
  }

  function udsRevealTeachers(shouldScroll=true){
    el("udsClassLeadForm")?.classList.add("is-complete");

    const introCopy=el("udsClassesIntroCopy");
    if(introCopy)introCopy.classList.add("uds-hidden");

    const reregister=el("udsClassReregister");
    reregister?.classList.remove("uds-hidden");

    const teachers=el("udsTeachers");
    if(teachers){
      teachers.classList.remove("uds-hidden");
      teachers.classList.add("is-revealed");
    }

    udsUpdateInstructorLinks();
    if(shouldScroll){
      window.setTimeout(()=>teachers?.scrollIntoView({behavior:"smooth",block:"nearest"}),120);
    }
  }

  function udsStartAdditionalGolfLessonRegistration(){
    const form=el("udsClassLeadForm");
    form?.reset();
    form?.classList.remove("is-complete");

    // Keep the current lead/token active until a new lead is successfully saved.
    // This means instructor access and attribution never disappear while filling
    // a second registration.
    // Keep the last successfully saved student's context active while a new
    // registration is being filled. The new context replaces it only after save.
    const introCopy=el("udsClassesIntroCopy");
    introCopy?.classList.remove("uds-hidden");

    const reregister=el("udsClassReregister");
    reregister?.classList.add("uds-hidden");

    // Intentionally keep instructors visible.
    const teachers=el("udsTeachers");
    if(teachers){
      teachers.classList.remove("uds-hidden");
      teachers.classList.add("is-revealed");
    }

    udsClassFormMessage("");
    const button=el("udsClassLeadSubmit");
    if(button){
      button.textContent=currentLanguage==="en"?"Save and view instructors":"Guardar y ver instructores";
    }
    udsClassConsentSync();
    udsUpdateInstructorLinks();

    window.setTimeout(()=>{
      form?.scrollIntoView({behavior:"smooth",block:"center"});
      el("udsClassName")?.focus({preventScroll:true});
    },80);
  }

  el("udsClassNewRegistration")?.addEventListener("click",udsStartAdditionalGolfLessonRegistration);

  ["udsClassName","udsClassPhone","udsClassLevel","udsClassGoal"].forEach(id=>{
    const node=el(id);
    node?.addEventListener("input",udsClassConsentSync);
    node?.addEventListener("change",udsClassConsentSync);
  });
  el("udsClassConsent")?.addEventListener("change",udsClassConsentSync);
  udsClassConsentSync();

  el("udsClassLeadForm")?.addEventListener("submit",async event=>{
    event.preventDefault();

    if(el("udsClassWebsite")?.value){
      udsClassFormMessage(currentLanguage==="en"?"We could not process this request.":"No pudimos procesar esta solicitud.","error");
      return;
    }

    const name=String(el("udsClassName")?.value||"").trim();
    const phone=String(el("udsClassPhone")?.value||"").trim();
    const phoneDigits=udsClassPhoneDigits(phone);
    const skill=String(el("udsClassLevel")?.value||"");
    const goal=String(el("udsClassGoal")?.value||"");
    const goalText=String(el("udsClassGoalText")?.value||"").trim();
    const consent=!!el("udsClassConsent")?.checked;

    if(name.length<2){
      udsClassFormMessage(currentLanguage==="en"?"Please enter your name.":"Escribe tu nombre.","error");
      el("udsClassName")?.focus();return;
    }
    if(phoneDigits.length<10||phoneDigits.length>15){
      udsClassFormMessage(currentLanguage==="en"?"Enter a valid phone or WhatsApp number.":"Ingresa un telÃ©fono o WhatsApp vÃ¡lido.","error");
      el("udsClassPhone")?.focus();return;
    }
    if(!skill||!goal){
      udsClassFormMessage(currentLanguage==="en"?"Choose your playing level and what you want to improve.":"Selecciona tu nivel de juego y quÃ© te gustarÃ­a mejorar.","error");
      return;
    }
    if(!consent){
      udsClassFormMessage(currentLanguage==="en"?"Please authorize contact to continue.":"Autoriza el contacto para continuar.","error");
      return;
    }

    const button=el("udsClassLeadSubmit");
    if(button){button.disabled=true;button.textContent=currentLanguage==="en"?"Saving…":"Guardando…"}
    udsClassFormMessage(currentLanguage==="en"?"Saving your request…":"Guardando tu solicitud…");

    const affiliate=getStoredAffiliate();

    try{
      const {data,error}=await db.rpc("create_golf_lesson_lead",{
        p_name:name,
        p_phone:phone,
        p_skill_level:skill,
        p_goal_category:goal,
        p_goal_text:goalText||null,
        p_consent:true,
        p_language:currentLanguage==="en"?"en":"es",
        p_affiliate_code:affiliate?.code||null,
        p_utm_source:udsGetUtm("utm_source"),
        p_utm_medium:udsGetUtm("utm_medium"),
        p_utm_campaign:udsGetUtm("utm_campaign"),
        p_utm_content:udsGetUtm("utm_content"),
        p_utm_term:udsGetUtm("utm_term"),
        p_referrer_host:udsReferrerHost()
      });

      if(error)throw error;
      const result=Array.isArray(data)?data[0]:data;
      if(!result?.lead_id||!result?.lead_token)throw new Error("Lead response incomplete");

      udsGolfLessonLeadId=result.lead_id;
      udsGolfLessonLeadToken=result.lead_token;
      udsGolfLessonLeadData={name,phone,skill_level:skill,goal_category:goal,goal_text:goalText};

      try{
        const existingOwner=JSON.parse(localStorage.getItem(udsGolfLessonAccessKey)||"null");

        // The first valid registration becomes the persistent owner of this
        // browser/device. Additional people are valid Supabase leads and become
        // the active WhatsApp context only for the current page session, but
        // they NEVER replace the owner stored in localStorage.
        if(!existingOwner?.id||!existingOwner?.token){
          localStorage.setItem(udsGolfLessonAccessKey,JSON.stringify({
            id:udsGolfLessonLeadId,
            token:udsGolfLessonLeadToken,
            registeredAt:new Date().toISOString(),
            role:"device_owner"
          }));
        }
      }catch{}

      // Remove legacy session-only record if it exists.
      try{sessionStorage.removeItem("upDownGolfLessonLead")}catch{}

      udsClassFormMessage(currentLanguage==="en"?"Saved. Choose your instructor below.":"Listo. Elige a tu instructor abajo.","success");
      udsRevealTeachers();

    }catch(error){
      console.error("Golf lesson lead error",error);
      udsClassFormMessage(currentLanguage==="en"?"We couldn't save your request. Please try again.":"No pudimos guardar tu solicitud. IntÃ©ntalo nuevamente.","error");
      if(button){
        button.textContent=currentLanguage==="en"?"Save and view instructors":"Guardar y ver instructores";
      }
      udsClassConsentSync();
    }
  });

  try{
    // One-time migration from Hotfix06/08 session storage.
    const legacy=JSON.parse(sessionStorage.getItem("upDownGolfLessonLead")||"null");
    if(legacy?.id&&legacy?.token){
      udsGolfLessonLeadId=legacy.id;
      udsGolfLessonLeadToken=legacy.token;
      udsGolfLessonLeadData=legacy.data||null;
      localStorage.setItem(udsGolfLessonAccessKey,JSON.stringify({
        id:legacy.id,
        token:legacy.token,
        registeredAt:new Date().toISOString()
      }));
      sessionStorage.removeItem("upDownGolfLessonLead");
    }

    const saved=JSON.parse(localStorage.getItem(udsGolfLessonAccessKey)||"null");
    if(saved?.id&&saved?.token){
      udsGolfLessonLeadId=saved.id;
      udsGolfLessonLeadToken=saved.token;

      // The "register another person" form-open state is intentionally NOT
      // persisted. Every refresh returns to the compact registered view:
      // instructors visible + "Registrar a otra persona" CTA.
      if(!udsGolfLessonLeadData)udsGolfLessonLeadData=null;

      (async()=>{
        await udsHydrateGolfLessonLeadContext();
        udsRevealTeachers(false);
      })();
    }
  }catch{}

  document.querySelectorAll("#updown-store .uds-teacher-whatsapp").forEach(link=>{
    link.addEventListener("click",()=>{
      if(!udsGolfLessonLeadId||!udsGolfLessonLeadToken)return;
      db.rpc("record_golf_instructor_interest",{
        p_lead_id:udsGolfLessonLeadId,
        p_lead_token:udsGolfLessonLeadToken,
        p_instructor_slug:link.getAttribute("data-instructor-slug")
      }).then(({error})=>{if(error)console.warn("Instructor analytics event failed",error)});
    });
  });

  // Servicios UP AND DOWN: una sola card abierta a la vez.
  document.querySelectorAll("#updown-store [data-service-card]").forEach(card=>{
    const trigger=card.querySelector(".uds-service-head");

    trigger.addEventListener("click",()=>{
      const shouldOpen=!card.classList.contains("is-open");

      document.querySelectorAll("#updown-store [data-service-card]").forEach(other=>{
        other.classList.remove("is-open");
        other.querySelector(".uds-service-head")?.setAttribute("aria-expanded","false");
      });

      if(shouldOpen){
        card.classList.add("is-open");
        trigger.setAttribute("aria-expanded","true");

        window.setTimeout(()=>{
          card.scrollIntoView({
            behavior:"smooth",
            block:"center"
          });
        },180);
      }
    });
  });


  // MenÃº superior -> Clases: abre directamente el servicio y lleva al usuario a la card.
  const udsClassesNav=document.querySelector('#updown-store [data-nav-key="classes"]');
  udsClassesNav?.addEventListener("click",(event)=>{
    event.preventDefault();
    const card=el("udsGolfClasses");
    const trigger=card?.querySelector(".uds-service-head");
    if(!card||!trigger)return;

    if(!card.classList.contains("is-open")){
      document.querySelectorAll("#updown-store [data-service-card]").forEach(other=>{
        other.classList.remove("is-open");
        other.querySelector(".uds-service-head")?.setAttribute("aria-expanded","false");
      });
      card.classList.add("is-open");
      trigger.setAttribute("aria-expanded","true");
    }

    window.setTimeout(()=>{
      card.scrollIntoView({behavior:"smooth",block:"center"});
    },80);
  });

  // Cabo Journal: una sola tarjeta expandida a la vez.
  document.querySelectorAll("#updown-store [data-journal-card]").forEach(card=>{
    const button=card.querySelector(".uds-journal-toggle");
    button.addEventListener("click",()=>{
      const willOpen=!card.classList.contains("is-expanded");
      document.querySelectorAll("#updown-store [data-journal-card]").forEach(other=>{
        other.classList.remove("is-expanded");
        const otherButton=other.querySelector(".uds-journal-toggle");
        otherButton.setAttribute("aria-expanded","false");
        otherButton.querySelector("span:first-child").textContent=currentLanguage==="en"?"Read article":"Leer artÃ­culo";
      });
      if(willOpen){
        card.classList.add("is-expanded");
        button.setAttribute("aria-expanded","true");
        button.querySelector("span:first-child").textContent=currentLanguage==="en"?"Close article":"Cerrar artÃ­culo";
        setTimeout(()=>card.scrollIntoView({behavior:"smooth",block:"center"}),180);
      }
    });
  });

  document.addEventListener("keydown",e=>{
    const viewerOpen=el("udsImageViewer")?.classList.contains("is-open");

    if(e.key==="Escape"){
      if(viewerOpen)closeImageViewer();
      else closePanels();
      return;
    }

    if(viewerOpen&&e.key==="ArrowLeft"){
      e.preventDefault();
      moveImageViewer(-1);
    }
    if(viewerOpen&&e.key==="ArrowRight"){
      e.preventDefault();
      moveImageViewer(1);
    }
  });
  const udsSafeStartup=(label,fn)=>{
    try{return fn()}
    catch(error){
      console.error(`[UPDOWN startup:${label}]`,error);
      return null;
    }
  };

  udsSafeStartup("managed-visibility",()=>applyManagedContentVisibility());
  udsSafeStartup("image-fallbacks",()=>setupStaticImageFallbacks());
  udsSafeStartup("journal-visibility",()=>setupJournalVisibility());
  udsSafeStartup("cart",()=>renderCart());
  udsSafeStartup("checkout-return",()=>handleCheckoutReturn());

  setTimeout(()=>{
    udsSafeStartup("checkout-return-delayed",()=>{
      if(!el("udsSuccessModal")?.classList.contains("is-open")){
        handleCheckoutReturn();
      }
    });
  },600);

  (async()=>{
    try{
      const affiliateCapture=captureAffiliateReference().then(()=>{
        syncStoredAffiliateReferenceInUrl();
        renderAdvisorBar();
      }).catch(e=>{
        console.warn("[UPDOWN affiliate]",e);
      });

      await loadStore();
      await affiliateCapture;

      try{
        applyLanguage(currentLanguage);
      }catch(e){
        console.error("[UPDOWN language]",e);
      }
    }catch(e){
      console.error("[UPDOWN HOME BOOT]",e);
      const status=el("udsStatus");
      if(status){
        status.className="uds-status is-error";
        status.innerHTML=`<strong>No fue posible terminar de cargar el catálogo.</strong><br>${escapeHtml(e?.message||String(e))}`;
      }
      const newRail=el("udsNewRail");
      if(newRail && /Cargando/i.test(newRail.textContent||"")){
        newRail.innerHTML=`<div class="uds-no-results">No fue posible cargar novedades. Revisa el error del catálogo.</div>`;
      }
    }
  })();

})();


/* ==========================================================================
   UP AND DOWN · MANAGED HOME CONTENT · HOTFIX 17
   Supabase becomes source of truth for Golf Courses + Cabo Journal.
   Supabase/Admin is the only source of truth for managed editorial content.
   Static legacy cards are never used as fallback.
   ========================================================================== */
(function(){
  "use strict";

  const MC_SUPABASE_URL=window.__UPDOWN_SUPABASE_URL__;
  const MC_SUPABASE_KEY=window.__UPDOWN_SUPABASE_PUBLISHABLE_KEY__;

  const mcState={courses:[],articles:[],instructors:[],leadContext:null};

  const mcEsc=(v="")=>String(v)
    .replaceAll("&","&amp;").replaceAll("<","&lt;").replaceAll(">","&gt;")
    .replaceAll('"',"&quot;").replaceAll("'","&#039;");

  const mcLang=()=>{
    try{return typeof currentLanguage!=="undefined"&&currentLanguage==="en"?"en":"es"}
    catch{return document.documentElement.lang==="en"?"en":"es"}
  };

  const mcText=(item,key)=>{
    const en=mcLang()==="en";
    return String((en?(item?.[`${key}_en`]||item?.[key]):(item?.[key]||item?.[`${key}_en`]))||"").trim();
  };

  async function mcFetch(table,query){
    if(!MC_SUPABASE_URL||!MC_SUPABASE_KEY)throw new Error("Falta configuraciÃ³n pÃºblica de Supabase para contenido administrado.");
    const response=await fetch(`${MC_SUPABASE_URL}/rest/v1/${table}?${query}`,{
      headers:{
        apikey:MC_SUPABASE_KEY,
        Authorization:`Bearer ${MC_SUPABASE_KEY}`,
        Accept:"application/json"
      },
      cache:"no-store",
      signal:typeof AbortSignal!=="undefined"&&typeof AbortSignal.timeout==="function"
        ? AbortSignal.timeout(8000)
        : undefined
    });
    if(!response.ok)throw new Error(`${table}: ${response.status}`);
    return response.json();
  }

  async function mcRpc(name,payload){
    const response=await fetch(`${MC_SUPABASE_URL}/rest/v1/rpc/${name}`,{
      method:"POST",
      headers:{
        apikey:MC_SUPABASE_KEY,
        Authorization:`Bearer ${MC_SUPABASE_KEY}`,
        "Content-Type":"application/json",
        Accept:"application/json"
      },
      body:JSON.stringify(payload||{}),
      cache:"no-store",
      signal:typeof AbortSignal!=="undefined"&&typeof AbortSignal.timeout==="function"
        ? AbortSignal.timeout(8000)
        : undefined
    });
    if(!response.ok)throw new Error(`${name}: ${response.status}`);
    const text=await response.text();
    return text?JSON.parse(text):null;
  }

  function mcLessonAccess(){
    try{
      const saved=JSON.parse(localStorage.getItem("upDownGolfLessonAccessV1")||"null");
      return saved?.id&&saved?.token?saved:null;
    }catch{return null}
  }

  async function mcLoadLeadContext(){
    const access=mcLessonAccess();
    if(!access)return null;
    try{
      const data=await mcRpc("get_golf_lesson_lead_context",{
        p_lead_id:access.id,
        p_lead_token:access.token
      });
      const row=Array.isArray(data)?data[0]:data;
      if(row?.name){
        mcState.leadContext={
          id:access.id,
          token:access.token,
          name:row.name,
          skill_level:row.skill_level,
          goal_category:row.goal_category,
          goal_text:row.goal_text||""
        };
        return mcState.leadContext;
      }
    }catch(error){
      console.warn("Managed instructor lead context unavailable:",error);
    }
    return null;
  }

  const mcSkillLabels={
    es:{new:"Estoy empezando",beginner:"Principiante",intermediate:"Intermedio",advanced:"Avanzado",competitive:"Competitivo"},
    en:{new:"Just starting",beginner:"Beginner",intermediate:"Intermediate",advanced:"Advanced",competitive:"Competitive"}
  };
  const mcGoalLabels={
    es:{starting:"Empezar desde cero",consistency:"Consistencia del swing",distance:"MÃ¡s distancia / driver",irons:"Hierros y precisiÃ³n",short_game:"Juego corto",putting:"Putting",strategy:"Estrategia en campo",other:"Otro"},
    en:{starting:"Start from zero",consistency:"Swing consistency",distance:"More distance / driver",irons:"Irons and accuracy",short_game:"Short game",putting:"Putting",strategy:"Course strategy",other:"Other"}
  };

  function mcInstructorMessage(instructor){
    const lang=mcLang();
    const d=mcState.leadContext||{};
    const firstName=String(instructor.name||"Instructor").trim().split(/\s+/)[0];
    const skill=(mcSkillLabels[lang]||mcSkillLabels.es)[d.skill_level]||d.skill_level||"";
    const goal=(mcGoalLabels[lang]||mcGoalLabels.es)[d.goal_category]||d.goal_category||"";
    const comment=String(d.goal_text||"").trim();
    const shortRef=d.id?String(d.id).slice(0,8).toUpperCase():"";

    const lines=[];
    if(lang==="en"){
      lines.push(d.name
        ?`Hi ${firstName}, I'm ${d.name} ðŸ‘‹ I came from UP AND DOWN · Coque. I already registered a lesson request on the website and I'd like to coordinate a lesson with you.`
        :`Hi ${firstName} ðŸ‘‹ I came from UP AND DOWN · Coque. I already registered a lesson request on the website and I'd like to coordinate a lesson with you.`);
      lines.push("");
      if(skill)lines.push(`Playing level: ${skill}`);
      if(goal)lines.push(`What I'd like to improve: ${goal}`);
      if(comment)lines.push(`Comments: ${comment}`);
      if(shortRef)lines.push(`Ref: ${shortRef}`);
    }else{
      lines.push(d.name
        ?`Hola ${firstName}, soy ${d.name} ðŸ‘‹ Vengo de UP AND DOWN · Coque. Ya registrÃ© anteriormente una solicitud de clases en la pÃ¡gina y me gustarÃ­a coordinar una clase contigo.`
        :`Hola ${firstName} ðŸ‘‹ Vengo de UP AND DOWN · Coque. Ya registrÃ© anteriormente una solicitud de clases en la pÃ¡gina y me gustarÃ­a coordinar una clase contigo.`);
      lines.push("");
      if(skill)lines.push(`Nivel de juego: ${skill}`);
      if(goal)lines.push(`QuÃ© me gustarÃ­a mejorar: ${goal}`);
      if(comment)lines.push(`Comentarios: ${comment}`);
      if(shortRef)lines.push(`Ref: ${shortRef}`);
    }
    return lines.join("\\n");
  }

  function mcInstructorPhone(instructor){
    let phone=String(instructor.whatsapp_phone||instructor.phone||"").replace(/\D/g,"");
    if(phone.length===10)phone=`52${phone}`;
    return phone;
  }

  function mcInstructorCard(instructor){
    const name=String(instructor.name||"").trim();
    const bio=mcText(instructor,"short_bio");
    const image=String(instructor.image_url||"").trim();
    const specialties=mcLang()==="en"
      ?(Array.isArray(instructor.specialties_en)&&instructor.specialties_en.length?instructor.specialties_en:instructor.specialties)
      :instructor.specialties;
    const firstName=name.split(/\s+/)[0]||name;
    const phone=mcInstructorPhone(instructor);

    return `<article class="uds-teacher-card uds-managed-teacher" data-content-active="true" data-instructor="${mcEsc(instructor.slug)}">
      <div class="uds-teacher-photo">
        ${image?`<img alt="${mcEsc(name)}" loading="lazy" decoding="async" src="${mcEsc(image)}"/>`:""}
        <div class="uds-teacher-photo-fallback">${mcEsc(name.split(/\s+/).slice(0,2).map(x=>x[0]||"").join("").toUpperCase())}</div>
      </div>
      <div class="uds-teacher-copy">
        <div class="uds-eyebrow">${mcLang()==="en"?"Professional instructor":"Profesional e instructor"}</div>
        <h5>${mcEsc(name)}</h5>
        ${bio?`<p>${mcEsc(bio)}</p>`:""}
        ${Array.isArray(specialties)&&specialties.length?`<div class="uds-managed-teacher-specialties">${specialties.map(x=>`<span>${mcEsc(x)}</span>`).join("")}</div>`:""}
        ${instructor.is_active===false
          ?`<div class="uds-managed-teacher-unavailable">${mcLang()==="en"?"Not currently accepting lessons":"No disponible para clases por el momento"}</div>`
          :(phone?`<a class="uds-btn uds-btn-primary uds-teacher-whatsapp uds-managed-teacher-whatsapp"
            data-instructor-name="${mcEsc(firstName)}"
            data-instructor-slug="${mcEsc(instructor.slug)}"
            data-instructor-phone="${mcEsc(phone)}"
            href="https://wa.me/${mcEsc(phone)}"
            rel="noopener" target="_blank">${mcLang()==="en"?`Plan a lesson with ${mcEsc(firstName)}`:`Planear una clase con ${mcEsc(firstName)}`}</a>`:"")}
      </div>
    </article>`;
  }

  function mcUpdateInstructorLinks(){
    const access=mcLessonAccess();
    document.querySelectorAll("#updown-store .uds-managed-teacher-whatsapp").forEach(link=>{
      const instructor=mcState.instructors.find(x=>x.slug===link.dataset.instructorSlug);
      if(!instructor)return;
      const phone=mcInstructorPhone(instructor);
      link.href=`https://wa.me/${phone}?text=${encodeURIComponent(mcInstructorMessage(instructor))}`;

      link.onclick=()=>{
        if(!access?.id||!access?.token)return;
        mcRpc("record_golf_instructor_interest",{
          p_lead_id:access.id,
          p_lead_token:access.token,
          p_instructor_slug:instructor.slug
        }).catch(error=>console.warn("Instructor analytics event failed",error));
      };
    });
  }


  function mcCourseCard(course){
    const name=String(course.name||"").trim();
    const location=String(course.location_label||"").trim();
    const description=mcText(course,"description");
    const image=String(course.image_url||"").trim();
    const map=String(course.map_url||"").trim();
    const official=String(course.official_url||"").trim();

    return `<article class="uds-course uds-managed-course ${image?"":"is-no-image"}" data-content-active="true">
      ${image?`<img alt="${mcEsc(name)}" class="uds-course-bg" loading="lazy" decoding="async" src="${mcEsc(image)}"/>`:""}
      <div class="uds-course-copy">
        ${location?`<div class="uds-eyebrow" style="color:#d9c08c">${mcEsc(location)}</div>`:""}
        <h3>${mcEsc(name)}</h3>
        ${description?`<p>${mcEsc(description)}</p>`:""}
        ${(map||official)?`<div class="uds-course-actions">
          ${map?`<a href="${mcEsc(map)}" rel="noopener noreferrer" target="_blank">${mcLang()==="en"?"Directions":"CÃ³mo llegar"}</a>`:""}
          ${official?`<a href="${mcEsc(official)}" rel="noopener noreferrer" target="_blank">${mcLang()==="en"?"Official site":"Sitio oficial"}</a>`:""}
        </div>`:""}
      </div>
    </article>`;
  }

  function mcParagraphs(text){
    const clean=String(text||"").trim();
    if(!clean)return "";
    return clean.split(/\n{2,}/)
      .map(block=>`<p>${mcEsc(block).replace(/\n/g,"<br>")}</p>`)
      .join("");
  }

  function mcJournalCard(article,index){
    const eyebrow=mcText(article,"eyebrow");
    const title=mcText(article,"title");
    const summary=mcText(article,"summary");
    const body=mcText(article,"body");
    const image=String(article.image_url||"").trim();
    const number=String(index+1).padStart(2,"0");

    return `<article class="uds-journal-card uds-managed-journal-card" data-content-active="true" data-journal-card="" data-priority="${article.is_priority?"true":"false"}" data-managed-journal-id="${mcEsc(article.id)}">
      <div class="uds-journal-media ${image?"":"is-no-image"}">
        ${image?`<img alt="${mcEsc(title)}" loading="lazy" decoding="async" src="${mcEsc(image)}"/>`:""}
        <span class="uds-journal-number">${number}</span>
        <div class="uds-journal-summary">
          ${eyebrow?`<small>${mcEsc(eyebrow)}</small>`:""}
          <h3>${mcEsc(title)}</h3>
        </div>
      </div>
      <div class="uds-journal-body">
        ${summary?`<p class="uds-journal-lead">${mcEsc(summary)}</p>`:""}
        ${body?`<button aria-expanded="false" class="uds-journal-toggle" type="button">
          <span>${mcLang()==="en"?"Read article":"Leer artÃ­culo"}</span>
          <span class="uds-journal-toggle-icon">+</span>
        </button>
        <div class="uds-journal-content">
          <div class="uds-journal-content-inner">
            <div class="uds-journal-article uds-managed-journal-article">
              ${mcParagraphs(body)}
            </div>
          </div>
        </div>`:""}
      </div>
    </article>`;
  }

  let mcJournalExpanded=false;

  function mcBindJournal(){
    const grid=document.getElementById("udsJournalGrid");
    if(!grid)return;

    grid.querySelectorAll(".uds-journal-toggle").forEach(toggle=>{
      toggle.onclick=()=>{
        const card=toggle.closest(".uds-journal-card");
        if(!card)return;
        const opening=!card.classList.contains("is-open");

        grid.querySelectorAll(".uds-journal-card.is-open").forEach(other=>{
          if(other===card)return;
          other.classList.remove("is-open");
          const t=other.querySelector(".uds-journal-toggle");
          if(t){
            t.setAttribute("aria-expanded","false");
            const label=t.querySelector("span:first-child");
            const icon=t.querySelector(".uds-journal-toggle-icon");
            if(label)label.textContent=mcLang()==="en"?"Read article":"Leer artÃ­culo";
            if(icon)icon.textContent="+";
          }
        });

        card.classList.toggle("is-open",opening);
        toggle.setAttribute("aria-expanded",opening?"true":"false");
        const label=toggle.querySelector("span:first-child");
        const icon=toggle.querySelector(".uds-journal-toggle-icon");
        if(label)label.textContent=opening
          ?(mcLang()==="en"?"Close article":"Cerrar artÃ­culo")
          :(mcLang()==="en"?"Read article":"Leer artÃ­culo");
        if(icon)icon.textContent=opening?"âˆ’":"+";
      };
    });

    const more=document.getElementById("udsJournalMore");
    if(more){
      const hasMore=mcState.articles.length>3;
      more.classList.toggle("uds-hidden",!hasMore);
      more.hidden=!hasMore;

      if(hasMore){
        more.textContent=mcJournalExpanded
          ?(mcLang()==="en"?"Show fewer articles":"Ver menos artÃ­culos")
          :(mcLang()==="en"?"View more articles":"Ver mÃ¡s artÃ­culos");

        more.onclick=()=>{
          mcJournalExpanded=!mcJournalExpanded;
          mcRenderJournal();
        };
      }else{
        more.onclick=null;
      }
    }
  }

  function mcRenderJournal(){
    const grid=document.getElementById("udsJournalGrid");
    const more=document.getElementById("udsJournalMore");
    if(!grid)return false;

    const articles=Array.isArray(mcState.articles)?mcState.articles:[];
    if(articles.length<=3)mcJournalExpanded=false;

    const shown=mcJournalExpanded?articles:articles.slice(0,3);
    grid.innerHTML=shown.map(mcJournalCard).join("");
    grid.dataset.source="supabase";
    grid.dataset.managedCount=String(articles.length);

    grid.querySelectorAll(".uds-journal-card").forEach(card=>{
      card.classList.remove("uds-journal-list-hidden","is-expanded");
      card.hidden=false;
    });

    if(more){
      const hasMore=articles.length>3;
      more.hidden=!hasMore;
      more.classList.toggle("uds-hidden",!hasMore);
      more.setAttribute("aria-expanded",String(hasMore&&mcJournalExpanded));
      if(hasMore){
        more.textContent=mcJournalExpanded
          ?(mcLang()==="en"?"View fewer articles":"Ver menos artÃ­culos")
          :(mcLang()==="en"?"View more articles":"Ver mÃ¡s artÃ­culos");
        more.onclick=()=>{
          mcJournalExpanded=!mcJournalExpanded;
          mcRenderJournal();
          if(!mcJournalExpanded){
            document.getElementById("udsJournal")?.scrollIntoView({behavior:"smooth",block:"start"});
          }
        };
      }else{
        more.onclick=null;
      }
    }

    mcBindJournal();
    return true;
  }
  function mcRenderCourses(){
    const grid=document.querySelector("#udsCourses .uds-course-grid");
    if(!grid)return false;
    grid.innerHTML=mcState.courses.map(mcCourseCard).join("");
    grid.dataset.source="supabase";
    grid.dataset.managedCount=String(mcState.courses.length);
    return true;
  }

  function mcRenderInstructors(){
    const grid=document.querySelector("#udsTeachers .uds-teachers-grid");
    if(!grid)return false;
    grid.innerHTML=mcState.instructors.map(mcInstructorCard).join("");
    grid.dataset.source="supabase";
    grid.dataset.managedCount=String(mcState.instructors.length);
    mcUpdateInstructorLinks();
    return true;
  }

  function mcRenderAll(){
    mcRenderCourses();
    mcRenderJournal();
    mcRenderInstructors();
  }

  async function mcLoad(){
    try{
      const [coursesResult,articlesResult,instructorsResult]=await Promise.allSettled([
        mcFetch(
          "golf_courses",
          "select=id,name,location_label,description,description_en,image_url,map_url,official_url,sort_order,is_visible&is_visible=eq.true&order=sort_order.asc,created_at.asc"
        ),
        mcFetch(
          "journal_articles",
          "select=id,slug,eyebrow,eyebrow_en,title,title_en,summary,summary_en,body,body_en,image_url,is_priority,sort_order,published_at,is_visible&is_visible=eq.true&order=is_priority.desc,sort_order.asc,published_at.desc"
        ),
        mcFetch(
          "golf_instructors",
          "select=id,slug,name,short_bio,short_bio_en,image_url,phone,whatsapp_phone,specialties,specialties_en,sort_order,is_visible,is_active&is_visible=eq.true&order=sort_order.asc,created_at.asc"
        )
      ]);

      mcState.courses=coursesResult.status==="fulfilled"&&Array.isArray(coursesResult.value)?coursesResult.value:[];
      mcState.articles=articlesResult.status==="fulfilled"&&Array.isArray(articlesResult.value)?articlesResult.value:[];
      mcState.instructors=instructorsResult.status==="fulfilled"&&Array.isArray(instructorsResult.value)?instructorsResult.value:[];

      for(const result of [coursesResult,articlesResult,instructorsResult]){
        if(result.status==="rejected")console.warn("Managed HOME partial load:",result.reason);
      }

      await mcLoadLeadContext();

      // Managed content is authoritative, including empty result sets.
      mcRenderAll();
    }catch(error){
      console.error("Managed HOME content load failed:",error);
    }
  }

  // HOME language switch changes currentLanguage inside the legacy runtime.
  // Re-render managed records after the DOM language mutates.
  function mcWatchLanguage(){
    const root=document.getElementById("updown-store");
    if(!root)return;
    let last=document.documentElement.lang||"";
    const observer=new MutationObserver(()=>{
      const next=document.documentElement.lang||"";
      if(next!==last){
        last=next;
        mcRenderAll();
      }
    });
    observer.observe(document.documentElement,{attributes:true,attributeFilter:["lang"]});
  }

  function mcBoot(){
    let tries=0;
    const timer=setInterval(()=>{
      tries++;
      if(document.getElementById("udsCourses")&&document.getElementById("udsJournalGrid")){
        clearInterval(timer);
        mcLoad();
        mcWatchLanguage();
      }else if(tries>100){
        clearInterval(timer);
      }
    },100);
  }

  if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",mcBoot,{once:true});
  else mcBoot();
})();



/* HOTFIX47A_PINCH_ZOOM */
(()=>{
  const setup=()=>{
    const stage=document.getElementById("udsImageViewerStage");
    const img=document.getElementById("udsImageViewerImage");
    const viewer=document.getElementById("udsImageViewer");
    if(!stage||!img||!viewer||stage.dataset.pinch47a==="1")return;

    stage.dataset.pinch47a="1";

    let scale=1;
    let x=0;
    let y=0;
    let startDistance=0;
    let startScale=1;
    let pinchCenterX=0;
    let pinchCenterY=0;
    let panStartX=0;
    let panStartY=0;
    let panOriginX=0;
    let panOriginY=0;
    let wasPinching=false;

    const clamp=(value,min,max)=>Math.max(min,Math.min(max,value));
    const distance=(a,b)=>Math.hypot(b.clientX-a.clientX,b.clientY-a.clientY);
    const midpoint=(a,b)=>({x:(a.clientX+b.clientX)/2,y:(a.clientY+b.clientY)/2});

    const apply=()=>{
      img.style.transform=`translate3d(${x}px,${y}px,0) scale(${scale})`;
      img.style.transition="none";
      viewer.classList.toggle("is-zoomed",scale>1.01);
    };

    const reset=(animate=true)=>{
      scale=1;x=0;y=0;
      img.style.transition=animate?"transform .18s ease":"none";
      img.style.transform="translate3d(0,0,0) scale(1)";
      viewer.classList.remove("is-zoomed");
      setTimeout(()=>{img.style.transition="none"},200);
    };

    stage.addEventListener("touchstart",event=>{
      if(!viewer.classList.contains("is-open"))return;

      if(event.touches.length===2){
        wasPinching=true;
        const a=event.touches[0],b=event.touches[1];
        startDistance=Math.max(1,distance(a,b));
        startScale=scale;
        const mid=midpoint(a,b);
        pinchCenterX=mid.x;
        pinchCenterY=mid.y;
        event.preventDefault();
        event.stopPropagation();
        return;
      }

      if(event.touches.length===1 && scale>1.01){
        panStartX=event.touches[0].clientX;
        panStartY=event.touches[0].clientY;
        panOriginX=x;
        panOriginY=y;
        event.preventDefault();
        event.stopPropagation();
      }
    },{passive:false,capture:true});

    stage.addEventListener("touchmove",event=>{
      if(!viewer.classList.contains("is-open"))return;

      if(event.touches.length===2){
        const a=event.touches[0],b=event.touches[1];
        const next=clamp(startScale*(distance(a,b)/startDistance),1,4.5);

        /* slight translation toward current pinch midpoint */
        const mid=midpoint(a,b);
        if(next>1){
          x += (mid.x-pinchCenterX)*.35;
          y += (mid.y-pinchCenterY)*.35;
          pinchCenterX=mid.x;
          pinchCenterY=mid.y;
        }

        scale=next;
        if(scale<=1.01){x=0;y=0}
        apply();
        event.preventDefault();
        event.stopPropagation();
        return;
      }

      if(event.touches.length===1 && scale>1.01){
        const maxX=stage.clientWidth*(scale-1)*.5;
        const maxY=stage.clientHeight*(scale-1)*.5;
        x=clamp(panOriginX+(event.touches[0].clientX-panStartX),-maxX,maxX);
        y=clamp(panOriginY+(event.touches[0].clientY-panStartY),-maxY,maxY);
        apply();
        event.preventDefault();
        event.stopPropagation();
      }
    },{passive:false,capture:true});

    stage.addEventListener("touchend",event=>{
      if(wasPinching){
        event.stopPropagation();
        if(event.touches.length<2)wasPinching=false;
      }
      if(scale<1.04)reset(true);
    },{passive:false,capture:true});

    stage.addEventListener("dblclick",event=>{
      if(scale>1.01)reset(true);
      else{
        scale=2.2;x=0;y=0;apply();
      }
      event.preventDefault();
    });

    ["udsImageViewerClose","udsImageViewerPrev","udsImageViewerNext"].forEach(id=>{
      document.getElementById(id)?.addEventListener("click",()=>reset(false),true);
    });

    new MutationObserver(()=>reset(false)).observe(img,{attributes:true,attributeFilter:["src"]});
  };

  if(document.readyState==="loading"){
    document.addEventListener("DOMContentLoaded",()=>setTimeout(setup,0),{once:true});
  }else{
    setTimeout(setup,0);
  }
})();



/* HOTFIX48_MOBILE_NAV_AND_ZOOM */
(()=>{
  const root=document.getElementById("updown-store");
  if(!root)return;

  const byId=id=>document.getElementById(id);

  function findService(regex){
    return [...root.querySelectorAll("[data-service-card]")].find(card=>{
      const text=card.querySelector(".uds-service-title h3")?.textContent||card.textContent||"";
      return regex.test(text);
    });
  }

  function openService(regex){
    const card=findService(regex);
    if(!card)return;
    const head=card.querySelector(".uds-service-head");
    if(!card.classList.contains("is-open"))head?.click();
    setTimeout(()=>card.scrollIntoView({behavior:"smooth",block:"center"}),80);
  }

  function makeBtn(className,label,html,onClick){
    const b=document.createElement("button");
    b.type="button";
    b.className=`uds-mobile-quickbtn ${className}`;
    b.setAttribute("aria-label",label);
    b.innerHTML=html;
    b.addEventListener("click",onClick);
    return b;
  }

  function setupHeader(){
    const topbar=root.querySelector(".uds-topbar");
    const actions=root.querySelector(".uds-top-actions");
    const menu=byId("udsMenuButton");
    const search=byId("udsSearchTop");
    const lang=root.querySelector(".uds-lang-switch");
    if(!topbar||!actions||!menu||!search||!lang)return;

    let quick=actions.querySelector(".uds-mobile-quicknav");
    if(!quick){
      quick=document.createElement("div");
      quick.className="uds-mobile-quicknav";

      quick.appendChild(makeBtn(
        "is-shop","Tienda",
        '<svg viewBox="0 0 24 24"><path d="M4 7h16l-1 13H5L4 7Z"></path><path d="M8 7a4 4 0 0 1 8 0"></path></svg>',
        ()=>byId("udsCatalog")?.scrollIntoView({behavior:"smooth",block:"start"})
      ));

      quick.appendChild(makeBtn(
        "is-classes","Clases de golf",
        '<svg viewBox="0 0 24 24"><circle cx="9" cy="8" r="3"></circle><circle cx="16.5" cy="9.5" r="2.3"></circle><path d="M3.5 20c.4-4 2.5-6 5.5-6s5.2 2 5.6 6"></path><path d="M14 15c3-.5 5.3 1 6 4"></path></svg>',
        ()=>openService(/clases|classes/i)
      ));

      quick.appendChild(makeBtn(
        "is-ghin","GHIN","GHIN",
        ()=>openService(/\bghin\b/i)
      ));
    }

    actions.innerHTML="";
    actions.appendChild(quick);
    actions.appendChild(search);
    actions.appendChild(lang);
    actions.appendChild(menu);
  }

  function ensureClassesInDrawer(){
    const nav=byId("udsMobileCategories");
    if(!nav)return;

    const existing=[...nav.querySelectorAll("button")].some(b=>/clases|classes/i.test(b.textContent||""));
    if(existing)return;

    const shop=[...nav.querySelectorAll("button")].find(b=>/^(tienda|shop)$/i.test((b.textContent||"").trim()));
    const b=document.createElement("button");
    b.type="button";
    b.className="uds-mobile-category is-editorial";
    b.textContent=document.documentElement.lang==="en"?"Classes":"Clases";
    b.onclick=()=>{
      byId("udsCloseMenu")?.click();
      setTimeout(()=>openService(/clases|classes/i),120);
    };
    if(shop?.nextSibling)nav.insertBefore(b,shop.nextSibling);
    else nav.prepend(b);
  }

  setupHeader();
  ensureClassesInDrawer();

  const drawer=byId("udsMobileCategories");
  if(drawer){
    new MutationObserver(()=>{
      ensureClassesInDrawer();
    }).observe(drawer,{childList:true});
  }

  /* True pinch zoom for fullscreen viewer. */
  const stage=byId("udsImageViewerStage");
  const img=byId("udsImageViewerImage");
  const viewer=byId("udsImageViewer");
  if(!stage||!img||!viewer||stage.dataset.hotfix48Zoom==="1")return;
  stage.dataset.hotfix48Zoom="1";

  let scale=1,x=0,y=0;
  let baseScale=1,startDistance=1;
  let panStartX=0,panStartY=0,panOriginX=0,panOriginY=0;
  let lastMid={x:0,y:0};

  const clamp=(v,min,max)=>Math.max(min,Math.min(max,v));
  const dist=(a,b)=>Math.hypot(b.clientX-a.clientX,b.clientY-a.clientY);
  const mid=(a,b)=>({x:(a.clientX+b.clientX)/2,y:(a.clientY+b.clientY)/2});

  function apply(){
    img.style.setProperty("transform",`translate3d(${x}px,${y}px,0) scale(${scale})`,"important");
    img.style.setProperty("scale","1","important");
  }

  function reset(animate=false){
    scale=1;x=0;y=0;
    img.style.setProperty("transition",animate?"transform .18s ease":"none","important");
    apply();
    setTimeout(()=>img.style.setProperty("transition","none","important"),200);
  }

  stage.addEventListener("touchstart",e=>{
    if(!viewer.classList.contains("is-open"))return;

    if(e.touches.length===2){
      baseScale=scale;
      startDistance=Math.max(1,dist(e.touches[0],e.touches[1]));
      lastMid=mid(e.touches[0],e.touches[1]);
      e.preventDefault();
      e.stopImmediatePropagation();
      return;
    }

    if(e.touches.length===1 && scale>1.01){
      panStartX=e.touches[0].clientX;
      panStartY=e.touches[0].clientY;
      panOriginX=x;
      panOriginY=y;
      e.preventDefault();
      e.stopImmediatePropagation();
    }
  },{passive:false,capture:true});

  stage.addEventListener("touchmove",e=>{
    if(!viewer.classList.contains("is-open"))return;

    if(e.touches.length===2){
      const a=e.touches[0],b=e.touches[1];
      const next=clamp(baseScale*(dist(a,b)/startDistance),1,5);
      const m=mid(a,b);

      if(next>1){
        x+=(m.x-lastMid.x)*.45;
        y+=(m.y-lastMid.y)*.45;
      }

      scale=next;
      lastMid=m;
      if(scale<=1.01){x=0;y=0}
      apply();

      e.preventDefault();
      e.stopImmediatePropagation();
      return;
    }

    if(e.touches.length===1 && scale>1.01){
      const maxX=stage.clientWidth*(scale-1)*.48;
      const maxY=stage.clientHeight*(scale-1)*.48;
      x=clamp(panOriginX+(e.touches[0].clientX-panStartX),-maxX,maxX);
      y=clamp(panOriginY+(e.touches[0].clientY-panStartY),-maxY,maxY);
      apply();

      e.preventDefault();
      e.stopImmediatePropagation();
    }
  },{passive:false,capture:true});

  stage.addEventListener("touchend",e=>{
    if(scale<1.03)reset(true);
    if(e.changedTouches?.length)e.stopImmediatePropagation();
  },{passive:false,capture:true});

  stage.addEventListener("dblclick",e=>{
    if(scale>1.01)reset(true);
    else{scale=2.25;x=0;y=0;apply()}
    e.preventDefault();
  });

  new MutationObserver(()=>{
    if(!viewer.classList.contains("is-open"))reset(false);
  }).observe(viewer,{attributes:true,attributeFilter:["class"]});

  new MutationObserver(()=>reset(false)).observe(img,{attributes:true,attributeFilter:["src"]});
})();


/* HOTFIX53_MOBILE_NAV_CONSOLIDATED */
(()=>{
  const root=document.getElementById("updown-store");
  if(!root)return;

  const el=id=>document.getElementById(id);
  const q=(s,c=document)=>c.querySelector(s);

  const isEnglish=()=>el("udsLangEn")?.classList.contains("is-active") || document.documentElement.lang==="en";
  const txt=(es,en)=>isEnglish()?en:es;

  function scrollToId(id){
    closeMenu();
    setTimeout(()=>el(id)?.scrollIntoView({behavior:"smooth",block:"start"}),70);
  }

  function setSearch(value){
    ["udsSearch","udsCatalogSearch"].forEach(id=>{
      const input=el(id);
      if(!input)return;
      input.value=value;
      input.dispatchEvent(new Event("input",{bubbles:true}));
      input.dispatchEvent(new Event("change",{bubbles:true}));
    });
    closeMenu();
    setTimeout(()=>el("udsCatalog")?.scrollIntoView({behavior:"smooth",block:"start"}),70);
  }

  function findService(regex){
    return [...root.querySelectorAll("[data-service-card]")].find(card=>{
      const value=card.querySelector(".uds-service-title h3")?.textContent || card.textContent || "";
      return regex.test(value);
    });
  }

  function openService(regex){
    closeMenu();
    setTimeout(()=>{
      const card=findService(regex);
      if(card){
        if(!card.classList.contains("is-open"))card.querySelector(".uds-service-head")?.click();
        setTimeout(()=>card.scrollIntoView({behavior:"smooth",block:"center"}),60);
        return;
      }
      el("udsServices")?.scrollIntoView({behavior:"smooth",block:"start"});
    },70);
  }

  function applyCategory(value){
    const controls=["udsCategorySelect","udsCategoryMobileFilter","udsCatalogCategory"];
    controls.forEach(id=>{
      const control=el(id);
      if(!control)return;
      const match=[...control.options].find(o=>o.value===value);
      if(!match)return;
      control.value=value;
      control.dispatchEvent(new Event("change",{bubbles:true}));
    });
    closeMenu();
    setTimeout(()=>el("udsCatalog")?.scrollIntoView({behavior:"smooth",block:"start"}),70);
  }

  function getCategories(){
    const source=el("udsCategorySelect") || el("udsCatalogCategory");
    if(!source)return [];
    return [...source.options]
      .filter(o=>o.value && o.value!=="all")
      .map(o=>({value:o.value,label:o.textContent?.trim()||o.value}));
  }

  function makeButton(label,className,onClick){
    const b=document.createElement("button");
    b.type="button";
    b.className=className;
    b.textContent=label;
    b.addEventListener("click",onClick);
    return b;
  }

  function makeGroup(label,items){
    const group=document.createElement("div");
    group.className="uds53-group";

    const toggle=document.createElement("button");
    toggle.type="button";
    toggle.className="uds53-toggle";
    toggle.innerHTML=`<span>${label}</span><span class="uds53-chevron">âŒ„</span>`;
    toggle.addEventListener("click",()=>group.classList.toggle("is-open"));

    const sub=document.createElement("div");
    sub.className="uds53-sub";
    items.forEach(item=>sub.appendChild(makeButton(item.label,"",item.onClick)));

    group.append(toggle,sub);
    return group;
  }

  let backdrop=el("udsMobileMenuBackdrop53");
  if(!backdrop){
    backdrop=document.createElement("div");
    backdrop.id="udsMobileMenuBackdrop53";
    document.body.appendChild(backdrop);
  }

  let menu=el("udsMobileMenu53");
  if(!menu){
    menu=document.createElement("aside");
    menu.id="udsMobileMenu53";
    menu.setAttribute("aria-hidden","true");
    document.body.appendChild(menu);
  }

  function renderMenu(){
    menu.innerHTML="";

    const head=document.createElement("div");
    head.className="uds53-head";
    head.innerHTML=`<strong>${txt("NavegaciÃ³n","Navigation")}</strong><button class="uds53-close" type="button" aria-label="${txt("Cerrar menÃº","Close menu")}">Ã—</button>`;
    head.querySelector("button")?.addEventListener("click",closeMenu);
    menu.appendChild(head);

    const search=document.createElement("div");
    search.className="uds53-search";
    search.innerHTML=`<input type="search" placeholder="${txt("Buscar equipo...","Search equipment...")}"><span>âŒ•</span>`;
    search.querySelector("input")?.addEventListener("keydown",e=>{
      if(e.key==="Enter")setSearch(e.currentTarget.value||"");
    });
    menu.appendChild(search);

    const featured=document.createElement("div");
    featured.className="uds53-featured";

    const classes=makeButton("","uds53-feature",()=>scrollToId("udsGolfClasses"));
    classes.innerHTML=`<small>${txt("Acceso directo","Quick access")}</small><strong>${txt("Clases de golf","Golf classes")}</strong>`;

    const ghin=makeButton("","uds53-feature",()=>openService(/\bghin\b/i));
    ghin.innerHTML=`<small>${txt("Handicap oficial","Official handicap")}</small><strong>GHIN</strong>`;

    featured.append(classes,ghin);
    menu.appendChild(featured);

    const shop=[
      {label:txt("Novedades y ofertas","New arrivals & offers"),onClick:()=>scrollToId("udsNew")},
      {label:txt("ColecciÃ³n completa","Full collection"),onClick:()=>scrollToId("udsCatalog")},
      {label:txt("Compra por categorÃ­a","Shop by category"),onClick:()=>scrollToId("udsCategories")},
    ];
    menu.appendChild(makeGroup(txt("Tienda","Shop"),shop));

    const categories=getCategories().map(c=>({
      label:c.label,
      onClick:()=>applyCategory(c.value)
    }));
    menu.appendChild(makeGroup(txt("CategorÃ­as","Categories"),categories.length?categories:[
      {label:txt("Ver categorías","View categories"),onClick:()=>scrollToId("udsCategories")}
    ]));

    menu.appendChild(makeGroup(txt("Servicios","Services"),[
      {label:txt("ReparaciÃ³n","Repair"),onClick:()=>openService(/reparaci|repair/i)},
      {label:txt("Intercambios","Trade-ins"),onClick:()=>openService(/intercambio|trade/i)},
      {label:txt("Mantenimiento","Maintenance"),onClick:()=>openService(/mantenimiento|maintenance/i)},
      {label:txt("RestauraciÃ³n de Putters","Putter Restoration"),onClick:()=>openService(/putter/i)},
    ]));

    menu.appendChild(makeGroup(txt("Golf en Los Cabos","Golf in Los Cabos"),[
      {label:txt("Campos de golf","Golf courses"),onClick:()=>scrollToId("udsCourses")},
      {label:"Cabo Journal",onClick:()=>scrollToId("udsJournal")},
    ]));

    menu.appendChild(makeButton(txt("QuiÃ©nes somos","About us"),"uds53-direct",()=>scrollToId("udsAbout")));
    menu.appendChild(makeButton(txt("Hablar con un asesor","Talk to an advisor"),"uds53-direct",()=>{
      closeMenu();
      setTimeout(()=>el("udsAdvisorContact")?.click() || el("udsDockAdvisor")?.click(),60);
    }));

    const footer=document.createElement("div");
    footer.className="uds53-footer";
    footer.innerHTML=`UP AND DOWN · Los Cabos<br>WhatsApp · 624 355 4700`;
    menu.appendChild(footer);
  }

  function openMenu(){
    renderMenu();
    menu.classList.add("is-open");
    menu.setAttribute("aria-hidden","false");
    backdrop.classList.add("is-open");
    document.documentElement.style.overflow="hidden";
    document.body.style.overflow="hidden";
  }

  function closeMenu(){
    menu.classList.remove("is-open");
    menu.setAttribute("aria-hidden","true");
    backdrop.classList.remove("is-open");
    document.documentElement.style.overflow="";
    document.body.style.overflow="";
  }

  backdrop.addEventListener("click",closeMenu);

  /* ---------- Header: build once, no observers ---------- */
  const actions=root.querySelector(".uds-top-actions");
  const menuButton=el("udsMenuButton");
  const searchButton=el("udsSearchTop");
  const lang=root.querySelector(".uds-lang-switch");

  let quick=actions?.querySelector(".uds-mobile-quicknav");
  if(actions && !quick){
    quick=document.createElement("div");
    quick.className="uds-mobile-quicknav";

    const mk=(cls,label,content,handler)=>{
      const b=document.createElement("button");
      b.type="button";
      b.className=`uds-mobile-quickbtn ${cls}`;
      b.setAttribute("aria-label",label);
      b.innerHTML=content;
      b.addEventListener("click",handler);
      return b;
    };

    quick.append(
      mk("is-shop",txt("Tienda","Shop"),'<svg viewBox="0 0 24 24"><path d="M4 7h16l-1 13H5L4 7Z"></path><path d="M8 7a4 4 0 0 1 8 0"></path></svg>',()=>scrollToId("udsCatalog")),
      mk("is-classes",txt("Clases","Classes"),'<svg viewBox="0 0 24 24"><circle cx="9" cy="8" r="3"></circle><path d="M3.5 20c.4-4 2.5-6 5.5-6s5.2 2 5.6 6"></path></svg>',()=>scrollToId("udsGolfClasses")),
      mk("is-ghin","GHIN","GHIN",()=>openService(/\bghin\b/i))
    );
  }

  if(actions){
    [quick,searchButton,lang,menuButton].forEach(node=>{if(node)actions.appendChild(node)});
  }

  /* Capture menu click before legacy menu listener. */
  if(menuButton){
    menuButton.addEventListener("click",e=>{
      e.preventDefault();
      e.stopImmediatePropagation();
      openMenu();
    },true);
  }

  /* ---------- Bottom dock: exact order once ---------- */
  const dock=root.querySelector(".uds-mobile-dock");
  if(dock){
    const advisor=el("udsDockAdvisor");
    const search=el("udsDockSearch");
    const cart=el("udsDockCart");
    let dockMenu=el("udsDockMenu") || el("udsDockShop");

    if(dockMenu){
      dockMenu.id="udsDockMenu";
      dockMenu.setAttribute("aria-label",txt("Abrir menÃº","Open menu"));
      const label=dockMenu.querySelector("span");
      if(label)label.textContent=txt("MenÃº","Menu");

      dockMenu.addEventListener("click",e=>{
        e.preventDefault();
        e.stopImmediatePropagation();
        openMenu();
      },true);
    }

    [advisor,search,cart,dockMenu].forEach(node=>{if(node)dock.appendChild(node)});
  }

  /* language rerenders drawer only when opened next time */
  [el("udsLangEs"),el("udsLangEn")].forEach(btn=>{
    btn?.addEventListener("click",()=>setTimeout(()=>{
      if(menu.classList.contains("is-open"))renderMenu();
    },0));
  });

  window.addEventListener("keydown",e=>{if(e.key==="Escape")closeMenu()});

  window.__UPDOWN_HOTFIX53_OK__=true;
})();




/* HOTFIX58_MOBILE_FIRST_REBUILD */
(()=>{
  const root=document.getElementById("updown-store");
  if(!root)return;

  const isMobile=()=>window.matchMedia("(max-width:760px)").matches;
  const grid=document.getElementById("udsGrid");
  const modal=document.getElementById("udsModal");

  /* ----------------------------------------------------------
     1) Catalog pager: 9 products, scoped observer only on #udsGrid.
     ---------------------------------------------------------- */
  let page=0;
  const pageSize=9;
  let pager=null;
  let pagerLabel=null;
  let prevBtn=null;
  let nextBtn=null;
  let scheduled=false;

  function productCards(){
    if(!grid)return [];
    return [...grid.children].filter(node=>node.nodeType===1 && !node.id?.startsWith("udsMobileCatalogPager"));
  }

  function ensurePager(){
    if(!grid)return null;
    pager=document.getElementById("udsMobileCatalogPager58");
    if(pager)return pager;

    pager=document.createElement("div");
    pager.id="udsMobileCatalogPager58";

    prevBtn=document.createElement("button");
    prevBtn.type="button";
    prevBtn.setAttribute("aria-label","Productos anteriores");
    prevBtn.textContent="â€¹";

    pagerLabel=document.createElement("span");

    nextBtn=document.createElement("button");
    nextBtn.type="button";
    nextBtn.setAttribute("aria-label","Productos siguientes");
    nextBtn.textContent="â€º";

    prevBtn.addEventListener("click",()=>{
      if(page<=0)return;
      page-=1;
      applyPage(true);
    });

    nextBtn.addEventListener("click",()=>{
      const cards=productCards();
      const pages=Math.max(1,Math.ceil(cards.length/pageSize));
      if(page>=pages-1)return;
      page+=1;
      applyPage(true);
    });

    pager.append(prevBtn,pagerLabel,nextBtn);
    grid.insertAdjacentElement("afterend",pager);
    return pager;
  }

  function applyPage(scroll){
    if(!grid)return;
    const cards=productCards();

    if(!isMobile()){
      cards.forEach(card=>{
        card.hidden=false;
        card.style.removeProperty("display");
      });
      if(pager)pager.style.display="none";
      return;
    }

    ensurePager();
    pager.style.display="grid";

    const pages=Math.max(1,Math.ceil(cards.length/pageSize));
    if(page>pages-1)page=pages-1;
    if(page<0)page=0;

    const start=page*pageSize;
    const end=start+pageSize;

    cards.forEach((card,index)=>{
      const visible=index>=start && index<end;
      card.hidden=!visible;
      if(visible)card.style.removeProperty("display");
    });

    pagerLabel.textContent=`${page+1} / ${pages} · ${cards.length} productos`;
    prevBtn.disabled=page===0;
    nextBtn.disabled=page>=pages-1;

    if(scroll){
      document.getElementById("udsCatalog")?.scrollIntoView({behavior:"smooth",block:"start"});
    }
  }

  function schedulePage(){
    if(scheduled)return;
    scheduled=true;
    requestAnimationFrame(()=>{
      scheduled=false;
      applyPage(false);
    });
  }

  if(grid){
    schedulePage();

    // This observer is intentionally scoped only to the product grid.
    const gridObserver=new MutationObserver(()=>{
      page=0;
      schedulePage();
    });
    gridObserver.observe(grid,{childList:true});
  }

  /* ----------------------------------------------------------
     2) Product modal labels / compact actions.
     ---------------------------------------------------------- */
  function setModalActions(){
    const add=document.getElementById("udsModalAdd");
    const ask=document.getElementById("udsModalConcierge");
    const trade=document.getElementById("udsModalTrade");

    if(add && add.dataset.h58!=="1"){
      add.dataset.h58="1";
      add.setAttribute("aria-label","Agregar al carrito");
    }

    if(ask){
      ask.textContent="Preguntar";
      ask.setAttribute("aria-label","Preguntar sobre este equipo");
    }

    if(trade){
      trade.textContent="Intercambiar";
      trade.setAttribute("aria-label","Quiero intercambiar equipo");
    }
  }

  setModalActions();

  if(modal){
    const modalObserver=new MutationObserver(()=>setModalActions());
    modalObserver.observe(modal,{attributes:true,attributeFilter:["class","aria-hidden"]});
  }

  window.addEventListener("resize",schedulePage,{passive:true});
  window.addEventListener("orientationchange",()=>setTimeout(schedulePage,100),{passive:true});

  window.__UPDOWN_HOTFIX58_OK__=true;
})();


/* HOTFIX59_PRODUCT_ACTIONS_COMPACT */
(()=>{
 const root=document.getElementById("updown-store"); if(!root)return;
 const icon=`<svg class="uds-cart-plus59" viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M3.5 4.5h2l1.8 8.7a2 2 0 0 0 2 1.6h7.4a2 2 0 0 0 2-1.6L20 8H6.3"></path><circle cx="10" cy="19" r="1.2"></circle><circle cx="18" cy="19" r="1.2"></circle><line x1="17.5" y1="3.5" x2="17.5" y2="7.5"></line><line x1="15.5" y1="5.5" x2="19.5" y2="5.5"></line></svg>`;
 function apply59(){
  const add=document.getElementById("udsModalAdd"),ask=document.getElementById("udsModalConcierge"),trade=document.getElementById("udsModalTrade");
  if(add){add.setAttribute("aria-label","Agregar al carrito");add.setAttribute("title","Agregar al carrito");}
  if(ask){ask.textContent="Preguntar";ask.setAttribute("aria-label","Preguntar sobre este equipo");}
  if(trade){trade.textContent="Intercambiar";trade.setAttribute("aria-label","Intercambiar equipo");}
 }
 apply59();
 const actions=document.querySelector("#udsModal .uds-modal-actions");
 if(actions){let busy=false;new MutationObserver(()=>{if(busy)return;busy=true;requestAnimationFrame(()=>{apply59();busy=false;});}).observe(actions,{childList:true,subtree:true,characterData:true});}
 const modal=document.getElementById("udsModal"); if(modal)modal.addEventListener("click",()=>requestAnimationFrame(apply59),{passive:true});
 window.__UPDOWN_HOTFIX59_OK__=true;
})();

