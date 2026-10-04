(function(){
  window.__UPDOWN_PARITY_VERSION__="2B.1-UX5.0-H82";

  const SUPABASE_URL=window.__UPDOWN_SUPABASE_URL__;
  const SUPABASE_KEY=window.__UPDOWN_SUPABASE_PUBLISHABLE_KEY__;
  if(!SUPABASE_URL||!SUPABASE_KEY)throw new Error("UP AND DOWN: faltan variables públicas de Supabase.");
  const db=window.supabase.createClient(SUPABASE_URL,SUPABASE_KEY);
  const el=id=>document.getElementById(id);
  let products=[],filteredProducts=[],categories=[],activeCategory="all",modalProduct=null;
  let modalGalleryImages=[],modalGalleryIndex=0;
  let udsViewerScrollY=0;
  let udsViewerPreviousBodyStyle=null;
  let currentLanguage=localStorage.getItem("upDownLanguage")||"es";
  let activeCollection="";
  let cart=JSON.parse(localStorage.getItem("upDownCart")||"[]");
  const conditionLabels={new:"Nuevo",preowned:"Seminuevo",demo:"Demostración"};
  const conditionLabelsEn={new:"New",preowned:"Pre-owned",demo:"Demo"};
  const AFFILIATE_STORAGE_KEY="upDownAffiliateReferral",AFFILIATE_DURATION_DAYS=30;
  const CATALOG_CACHE_KEY="upDownCatalogCacheV2";
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
  function money(value,currency="MXN",compact=false){
    const code=String(currency||"MXN").toUpperCase();
    const locale=currentLanguage==="en"?"en-US":"es-MX";
    const formatted=new Intl.NumberFormat(locale,{style:"currency",currency:code,currencyDisplay:"narrowSymbol",minimumFractionDigits:compact&&Number.isInteger(Number(value))?0:2,maximumFractionDigits:compact&&Number.isInteger(Number(value))?0:2}).format(Number(value||0));
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
          currentLanguage==="en"?`${item.name} is no longer available and was removed from your cart.`:`${item.name} ya no está disponible y se retiró del carrito.`
        );
        changed=true;
        return;
      }

      const currentStock=Number(current.stock||0);

      if(currentStock<=0){
        adjustments.push(
          currentLanguage==="en"?`${current.name} is sold out and was removed from your cart.`:`${current.name} está agotado y se retiró del carrito.`
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
          currentLanguage==="en"?`${current.name} was adjusted to ${validQuantity} unit${validQuantity===1?"":"s"} based on availability.`:`${current.name} se ajustó a ${validQuantity} unidad${validQuantity===1?"":"es"} por disponibilidad.`
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
          : currentLanguage==="en"?`We updated ${adjustments.length} items in your cart due to inventory changes.`:`Actualizamos ${adjustments.length} artículos de tu carrito por cambios de inventario.`;

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
      cartList.innerHTML=`<div class="uds-no-results">${currentLanguage==="en"?"Your cart is ready for your next selection.":"Tu carrito está listo para tu próxima selección."}</div>`;
      return;
    }

    cartList.innerHTML="";
    cart.forEach(item=>{const row=document.createElement("article");row.className="uds-cart-item";
      row.innerHTML=`<img src="${escapeHtml(item.image||"")}" alt="${escapeHtml(item.name)}"><div><h4>${escapeHtml(item.name)}</h4><div class="uds-cart-meta">${item.summary?`${escapeHtml(item.summary)} · `:""}${money(item.price,item.currency)} ${currentLanguage==="en"?"each":"c/u"}</div><div class="uds-qty"><button class="uds-minus" type="button" aria-label="${currentLanguage==="en"?"Decrease quantity":"Restar"}">−</button><strong>${item.quantity}</strong><button class="uds-plus" type="button" aria-label="${currentLanguage==="en"?"Increase quantity":"Sumar"}">+</button></div></div><button class="uds-remove" type="button" aria-label="${currentLanguage==="en"?"Remove":"Eliminar"}">×</button>`;
      row.querySelector(".uds-minus").onclick=()=>changeQty(item.id,-1);row.querySelector(".uds-plus").onclick=()=>changeQty(item.id,1);row.querySelector(".uds-remove").onclick=()=>removeFromCart(item.id);el("udsCartList").appendChild(row)
    })
  }
  function addToCart(product){
    if(Number(product.stock)<=0){showToast(currentLanguage==="en"?"This product is sold out.":"Este producto está agotado.");return}
    const ex=cart.find(i=>i.id===product.id);if(ex){if(ex.quantity>=Number(product.stock)){showToast(currentLanguage==="en"?"You have reached the available stock.":"Ya alcanzaste el existencias disponible.");return}ex.quantity+=1}
    else cart.push({id:product.id,name:product.name,slug:product.slug,image:product.cover_image_url,price:Number(product.sale_price??product.price),currency:product.currency||"MXN",stock:Number(product.stock),quantity:1,summary:golfSummary(product)});
    saveCart();showToast(currentLanguage==="en"?`${product.name} added to cart.`:`${product.name} agregado al carrito.`)
  }
  function changeQty(id,d){const item=cart.find(i=>i.id===id);if(!item)return;const next=item.quantity+d;if(next<=0)return removeFromCart(id);if(next>item.stock)return showToast(currentLanguage==="en"?"No more units are available.":"No hay más unidades disponibles.");item.quantity=next;saveCart()}
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
  let productReturnPosition=null;
  let productReturnFocus=null;
  function closePanels(closeOverlay=true){
    const wasProductOpen=el("udsModal").classList.contains("is-open");
    el("udsCart").classList.remove("is-open");el("udsMobileMenu").classList.remove("is-open");el("udsModal").classList.remove("is-open");el("udsSuccessModal").classList.remove("is-open");
    ["udsCart","udsMobileMenu","udsModal","udsSuccessModal"].forEach(id=>el(id).setAttribute("aria-hidden","true"));

    const viewer=el("udsImageViewer");
    if(viewer){
      const viewerWasOpen=viewer.classList.contains("is-open");
      viewer.classList.remove("is-open");
      viewer.setAttribute("aria-hidden","true");
      if(viewerWasOpen){unlockDocumentFromImageViewer();restoreImageViewerParent();udsViewerReturnFocus=null;}
    }

    if(closeOverlay){el("udsOverlay").classList.remove("is-open");document.body.style.overflow=""}
    if(closeOverlay&&wasProductOpen&&productReturnPosition!==null){
      const position=productReturnPosition,focus=productReturnFocus;
      productReturnPosition=null;productReturnFocus=null;
      requestAnimationFrame(()=>{window.scrollTo(0,position);if(focus?.isConnected)focus.focus({preventScroll:true});});
    }
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
  let udsProductGridSavedScroll=0;
  let udsViewerReturnFocus=null;
  let udsViewerOriginalParent=null;
  let udsViewerOriginalNext=null;

  function openImageViewer(){
    if(!modalProduct)return;
    renderImageViewer();
    const viewer=el("udsImageViewer");
    if(!viewer)return;

    const productModal=el("udsModal");
    udsProductModalSavedScroll=productModal?.scrollTop||0;
    udsProductGridSavedScroll=productModal?.querySelector(".uds-modal-grid")?.scrollTop||0;
    udsViewerReturnFocus=document.activeElement;
    udsViewerOriginalParent=viewer.parentNode;
    udsViewerOriginalNext=viewer.nextSibling;
    document.body.appendChild(viewer);
    lockDocumentForImageViewer();
    viewer.classList.add("is-open");
    viewer.setAttribute("aria-hidden","false");
    el("udsImageViewerClose").setAttribute("aria-label",siteText("product.closeImage"));
    el("udsImageViewerPrev").setAttribute("aria-label",currentLanguage==="en"?"Previous image":"Imagen anterior");
    el("udsImageViewerNext").setAttribute("aria-label",currentLanguage==="en"?"Next image":"Siguiente imagen");
    el("udsImageViewerClose").focus({preventScroll:true});
    productModal?.setAttribute("aria-hidden","true");
  }

  function restoreImageViewerParent(){
    const viewer=el("udsImageViewer");
    if(viewer&&udsViewerOriginalParent?.isConnected){
      if(udsViewerOriginalNext?.parentNode===udsViewerOriginalParent)udsViewerOriginalParent.insertBefore(viewer,udsViewerOriginalNext);
      else udsViewerOriginalParent.appendChild(viewer);
    }
    udsViewerOriginalParent=null;udsViewerOriginalNext=null;
  }

  function closeImageViewer(){
    const viewer=el("udsImageViewer");
    if(!viewer)return;

    viewer.classList.remove("is-open");
    viewer.setAttribute("aria-hidden","true");
    unlockDocumentFromImageViewer();
    restoreImageViewerParent();
    requestAnimationFrame(()=>{
      const productModal=el("udsModal");
      if(productModal?.classList.contains("is-open")){
        productModal.setAttribute("aria-hidden","false");
        productModal.scrollTop=udsProductModalSavedScroll;
        const grid=productModal.querySelector(".uds-modal-grid");if(grid)grid.scrollTop=udsProductGridSavedScroll;
        if(udsViewerReturnFocus?.isConnected)udsViewerReturnFocus.focus({preventScroll:true});
      }
      udsViewerReturnFocus=null;
    });

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
    if(stock===1)return {text:currentLanguage==="en"?"Last one":"Última pieza",cls:"is-low"};
    if(stock<=3)return {text:currentLanguage==="en"?"Low stock":"Pocas unidades",cls:"is-low"};
    return {text:currentLanguage==="en"?"Available":"Disponible",cls:""};
  }
  function cardHtml(product){
    const price=product.sale_price??product.price;
    const discount=product.sale_price!=null&&Number(product.sale_price)<Number(product.price);
    const stock=stockCopy(product.stock);
    const condition=(currentLanguage==="en"?conditionLabelsEn:conditionLabels)[product.item_condition]||(currentLanguage==="en"?"Product":"Producto");
    const titleKey=normalizeSpecKey(product.name);
    const specs=golfSpecChips(product,3).filter(value=>!titleKey.includes(normalizeSpecKey(value))).slice(0,2);
    return `<div class="uds-card-media"><img src="${escapeHtml(product.cover_image_url||"")}" alt="${escapeHtml(product.name)}" loading="lazy" decoding="async"><div class="uds-card-badges"><span class="uds-condition">${escapeHtml(condition)}</span><span class="uds-stock ${stock.cls}">${escapeHtml(stock.text)}</span></div></div>
      <div class="uds-card-body">
        <div class="uds-category">${escapeHtml(product.brand||categoryLabel(product.categories)||"Golf")}</div>
        <h3>${escapeHtml(product.name)}</h3>
        ${specs.length?`<p class="uds-card-specs">${specs.map(escapeHtml).join(" · ")}</p>`:""}
        <p class="uds-description">${escapeHtml(localizedProductText(product,"short_description")||product.model||"")}</p>
        <div class="uds-price-row"><span class="uds-price">${money(price,product.currency,true)}</span>${discount?`<span class="uds-old-price">${money(product.price,product.currency,true)}</span>`:""}</div>
        <p class="uds-shipping-note" data-store-copy="product.shippingExcluded">${escapeHtml(siteText("product.shippingExcluded"))}</p>

      </div>`;
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
    card.classList.add("is-openable");
    card.setAttribute("role","button");
    card.setAttribute("tabindex","0");
    card.setAttribute("aria-haspopup","dialog");
    card.setAttribute("aria-label",currentLanguage==="en"?`View details of ${product.name}`:`Ver detalles de ${product.name}`);
    card.addEventListener("keydown",event=>{
      if(event.target!==card||event.defaultPrevented)return;
      if(event.key==="Enter"||event.key===" "){event.preventDefault();openProduct(product);}
    });
    // The full card is the pointer and keyboard action.
    card.addEventListener("click",event=>{
      if(event.defaultPrevented||event.target.closest("button,a,input,select,textarea,label"))return;
      if(window.getSelection?.()?.toString())return;
      openProduct(product);
    });
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
    if(!selection.length)rail.innerHTML=`<div class="uds-no-results">${currentLanguage==="en"?"No new arrivals or offers yet.":"Aún no hay novedades u ofertas."}</div>`;
  }
  function renderPicks(){
    const grid=el("udsPicksGrid");if(!grid)return;
    const picks=products.filter(p=>p.featured).slice(0,4);
    const selected=picks.length?picks:products.slice(0,4);
    grid.innerHTML="";
    selected.forEach(p=>{const card=document.createElement("article");card.className="uds-card";card.innerHTML=cardHtml(p);bindCard(card,p);grid.appendChild(card)});
    if(!selected.length)grid.innerHTML=`<div class="uds-no-results">${currentLanguage==="en"?"No highlighted products yet.":"Aún no hay productos destacados."}</div>`;
  }
  function categoryImage(category){
    return category.image_url||"/assets/category-placeholder.svg";
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
    button.innerHTML=`<span>${escapeHtml(label)}</span><span aria-hidden="true">→</span>`;

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
    if(mobileSelect)mobileSelect.innerHTML=`<option value="all">${currentLanguage==="en"?"Category: all":"Categoría: todas"}</option>`;

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
      label:"Noticias",
      target:"udsJournal",
      className:"is-editorial is-journal"
    });

    appendMobileMenuButton({
      label:"GHIN",
      className:"is-editorial",
      onClick:()=>window.open(buildGhinWhatsAppUrl(),"_blank","noopener,noreferrer")
    });

    appendMobileMenuButton({
      label:currentLanguage==="en"?"About us":"Quiénes somos",
      target:"udsAbout",
      className:"is-editorial"
    });

    appendMobileSection(currentLanguage==="en"?"Shop by category":"Comprar por categoría");

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
          <small>${currentLanguage==="en"?"Explore collection":"Explorar colección"}</small>
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
          :"Elige una categoría para mostrar únicamente los filtros técnicos que correspondan.";
      }else if(clubContext){
        hint.textContent=currentLanguage==="en"
          ?"Only technical filters available for this club category are shown."
          :"Mostramos únicamente los filtros técnicos disponibles para esta categoría de palos.";
      }else{
        hint.textContent=currentLanguage==="en"
          ?"Club-specific filters are hidden because they do not apply to this category."
          :"Ocultamos mano, flex y loft porque no corresponden a esta categoría.";
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
    setSelectOptions(el("udsFlexFilter"),flexes,currentLanguage==="en"?"Any flex":"Cualquier flexibilidad");
    setSelectOptions(el("udsLoftFilter"),lofts,currentLanguage==="en"?"Any loft":"Cualquier ángulo de la cara");
    setSelectOptions(el("udsCatalogBrand"),brands,currentLanguage==="en"?"All brands":"Todas las marcas");
    setSelectOptions(el("udsCatalogHand"),hands,currentLanguage==="en"?"Any hand":"Cualquier mano");
    setSelectOptions(el("udsCatalogFlex"),flexes,currentLanguage==="en"?"Any flex":"Cualquier flexibilidad");
    setSelectOptions(el("udsCatalogLoft"),lofts,currentLanguage==="en"?"Any loft":"Cualquier ángulo de la cara");
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
        ?(currentLanguage==="en"?"Close search":"Cerrar búsqueda")
        :(currentLanguage==="en"?"Clear filters":"Limpiar filtros");
    }
    if(el("udsDiscoveryClear")){
      el("udsDiscoveryClear").textContent=focused
        ?(currentLanguage==="en"?"Close search":"Cerrar búsqueda")
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
    if(product.item_condition==="new")return currentLanguage==="en"?"New product as listed in the catalog.":"Producto nuevo según la condición registrada en catálogo.";
    if(product.item_condition==="demo")return currentLanguage==="en"?"Demo unit. Ask for current cosmetic details before purchase.":"Unidad demostración. Solicita detalles estéticos actuales antes de comprar.";
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
            `Hi ${advisor.name} 👋`,
            "",
            "I’m looking at this equipment:",
            `*${product.name}*`,
            `SKU: ${product.sku||"—"}`,
            ...(summary?[`Configuration: ${summary}`]:[]),
            `Price: ${money(product.sale_price??product.price,product.currency)}`,
            "",
            "Can you help me confirm whether this configuration is right for my game?"
          ]
        :[
            `Hola ${advisor.name} 👋`,
            "",
            "Estoy viendo este equipo:",
            `*${product.name}*`,
            `SKU: ${product.sku||"—"}`,
            ...(summary?[`Configuración: ${summary}`]:[]),
            `Precio: ${money(product.sale_price??product.price,product.currency)}`,
            "",
            "¿Me ayudas a confirmar si esta configuración es adecuada para mi juego?"
          ];

      return `https://wa.me/${phone}?text=${encodeURIComponent(lines.join("\n"))}`;
    }

    // General UP AND DOWN / Concierge flow remains unchanged.
    const lines=currentLanguage==="en"?["Hi UP AND DOWN 👋"]:["Hola UP AND DOWN 👋"];
    if(affiliate?.seller_name)lines.push(currentLanguage==="en"?`I’m shopping with ${affiliate.seller_name}'s referral (${affiliate.code}).`:`Estoy comprando con la referencia de ${affiliate.seller_name} (${affiliate.code}).`);
    if(product){
      lines.push("",currentLanguage==="en"?"I’m looking at this equipment:":"Estoy viendo este equipo:",`*${product.name}*`,`SKU: ${product.sku||"—"}`);
      const summary=golfSummary(product);if(summary)lines.push(currentLanguage==="en"?`Configuration: ${summary}`:`Configuración: ${summary}`);
      lines.push(currentLanguage==="en"?`Price: ${money(product.sale_price??product.price,product.currency)}`:`Precio: ${money(product.sale_price??product.price,product.currency)}`);
    }
    lines.push("");
    if(purpose==="trade")lines.push(currentLanguage==="en"?"I have golf equipment I may want to trade in. Can you tell me how the in-store evaluation works?":"Tengo equipo de golf que podría dar a cuenta. ¿Me explican cómo funciona la valoración en tienda?");
    else if(product)lines.push(currentLanguage==="en"?"Can you help me confirm whether this configuration fits my game?":"¿Me ayudan a confirmar si esta configuración es adecuada para mi juego?");
    else lines.push(currentLanguage==="en"?"I’d like help choosing the right golf equipment for my game.":"Quiero asesoría para elegir el equipo correcto para mi juego.");
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
    el("udsAdvisorLabel").textContent=affiliate?.seller_name?(currentLanguage==="en"?"Your Golf Advisor":"Tu asesor de golf"):(currentLanguage==="en"?"Golf Advisor":"Asesor de golf");
    el("udsAdvisorContact").textContent=affiliate?.seller_name?(currentLanguage==="en"?"Contact my advisor":"Consultar con mi asesor"):(currentLanguage==="en"?"Talk to an advisor":"Hablar con un asesor");
  }
  function modalSpecEntries(product){
    const preferred=[
      [currentLanguage==="en"?"Brand":"Marca",product.brand],
      [currentLanguage==="en"?"Model":"Modelo",product.model]
    ];
    const g=rawGolfSpecs(product);
    if(g.hand)preferred.push([currentLanguage==="en"?"Hand":"Mano",normalizeHand(g.hand)]);
    if(g.loft)preferred.push([currentLanguage==="en"?"Loft":"Ángulo de la cara",g.loft]);
    if(g.flex)preferred.push([currentLanguage==="en"?"Flex":"Flexibilidad",g.flex]);
    if(g.shaft)preferred.push([currentLanguage==="en"?"Shaft":"Varilla",g.shaft]);
    if(g.grip)preferred.push([currentLanguage==="en"?"Grip":"Empuñadura",g.grip]);
    const used=new Set(preferred.map(([k])=>normalizeSpecKey(k)));
    Object.entries(product.specifications||{}).forEach(([key,value])=>{
      const display=displaySpecValue(value);if(!display)return;
      const nk=normalizeSpecKey(key);
      if(["marca","brand","modelo","model","mano","hand","dexterity","loft","grados","flex","shaft","varilla","grip","ideal para","jugador","player profile","recommended for","recomendado para"].some(a=>nk.includes(normalizeSpecKey(a))))return;
      if(/^(description|short description|english description|english short description|title|name|summary|body)( en| english)?$/.test(nk))return;
      const labels={"condition score":["Estado del equipo","Condition rating"],"condition rating":["Estado del equipo","Condition rating"],"length":["Longitud","Length"],"longitud":["Longitud","Length"],"material":["Material","Material"],"size":["Talla","Size"],"talla":["Talla","Size"],"color":["Color","Color"],"pieces":["Piezas","Pieces"],"piezas":["Piezas","Pieces"],"year":["Año","Year"],"weight":["Peso","Weight"]};
      const label=labels[nk]?.[currentLanguage==="en"?1:0]||String(key).replace(/_/g," ").replace(/^./,c=>c.toUpperCase());
      if(!used.has(nk)){preferred.push([label,display]);used.add(nk);}
    });
    return preferred.filter(([,v])=>v!==null&&v!==undefined&&String(v).trim());
  }
  let productDescriptionExpanded=false;
  function productDescriptionContent(product){
    const short=localizedProductText(product,"short_description").trim();
    const full=localizedProductText(product,"description").trim();
    return {short:short||full||(currentLanguage==="en"?"Ask our team about this product.":"Consulta con nuestro equipo sobre este producto."),full,hasMore:Boolean(short&&full&&short!==full)};
  }
  function renderProductDescription(product,expanded=false){
    const content=productDescriptionContent(product);
    productDescriptionExpanded=expanded&&content.hasMore;
    el("udsModalDescription").textContent=productDescriptionExpanded?content.full:content.short;
    const toggle=el("udsModalDescriptionToggle");
    toggle.hidden=!content.hasMore;
    toggle.setAttribute("aria-expanded",String(productDescriptionExpanded));
    toggle.textContent=siteText(productDescriptionExpanded?"product.less":"product.more");
  }
  function openProduct(product,preserveView=false){
    const savedModalScroll=preserveView?el("udsModal").scrollTop:0;
    const savedGridScroll=preserveView?(el("udsModal").querySelector(".uds-modal-grid")?.scrollTop||0):0;
    const savedGalleryIndex=preserveView?modalGalleryIndex:0;
    const savedDescriptionExpanded=preserveView&&productDescriptionExpanded;
    if(!el("udsModal").classList.contains("is-open")){
      productReturnPosition=window.scrollY;
      productReturnFocus=document.activeElement;
    }
    modalProduct=product;
    const advisor=productAdvisor(),specs=rawGolfSpecs(product),chips=golfSpecChips(product,4),stock=stockCopy(product.stock);
    modalGalleryImages=productGallery(product);
    modalGalleryIndex=Math.min(savedGalleryIndex,Math.max(0,modalGalleryImages.length-1));
    renderModalGallery(modalGalleryIndex);
    el("udsModalPick")?.classList.add("uds-hidden");
    el("udsModalCategory").innerHTML=`<span>${escapeHtml(categoryLabel(product.categories)||"Golf")} · ${escapeHtml((currentLanguage==="en"?conditionLabelsEn:conditionLabels)[product.item_condition]||"")}</span><span class="uds-modal-stock-tag ${stock.cls}">${escapeHtml(stock.text)}</span>`;
    el("udsModalTitle").textContent=product.name||"";
    const hasDiscount=product.sale_price!==null&&Number(product.sale_price)<Number(product.price);
    el("udsModalPrice").innerHTML=`<span class="uds-price">${money(product.sale_price??product.price,product.currency,true)}</span>${hasDiscount?`<span class="uds-old-price">${money(product.price,product.currency,true)}</span>`:""}`;
    renderProductDescription(product,savedDescriptionExpanded);
    el("udsModalImage").setAttribute("aria-label",siteText("product.expandImage"));
    const player=specs.player;
    el("udsPlayerFitWrap").classList.toggle("uds-hidden",!player);
    el("udsPlayerFit").textContent=player||"";
    el("udsPlayerFitLabel").textContent=currentLanguage==="en"?"Who it fits":"Para qué jugador";
    el("udsSpecsLabel").textContent=currentLanguage==="en"?"Configuration":"Configuración";
    const entries=modalSpecEntries(product);
    el("udsModalSpecs").innerHTML=entries.length?entries.map(([key,value])=>`<div class="uds-modal-spec-item${String(value).length>55?" is-wide":""}"><span>${escapeHtml(key)}</span><strong>${escapeHtml(value)}</strong></div>`).join(""):`<div class="uds-modal-spec-item"><span>${currentLanguage==="en"?"Product":"Producto"}</span><strong>${escapeHtml(product.name||"")}</strong></div>`;
    el("udsModalCondition").textContent=(currentLanguage==="en"?conditionLabelsEn:conditionLabels)[product.item_condition]||(currentLanguage==="en"?"Product":"Producto");
    el("udsModalConditionNote").textContent=conditionNote(product);
    el("udsModalStock").textContent=stock.text;
    el("udsModalAdvisorLabel").textContent=advisor.code?(currentLanguage==="en"?"Assisted by":"Atendido por"):(currentLanguage==="en"?"Golf advisor":"Asesor de golf");
    el("udsModalAdvisorName").textContent=advisor.name;
    const isSoldOut=Number(product.stock)<=0;
    el("udsModal").classList.toggle("is-sold-out",isSoldOut);
    el("udsModalAdd").disabled=isSoldOut;
    el("udsModalAdd").setAttribute("aria-label",isSoldOut?(currentLanguage==="en"?"Sold out":"Agotado"):(currentLanguage==="en"?"Add to cart":"Agregar al carrito"));
    el("udsModalAdd").innerHTML=`<svg class="uds-modal-cart-icon" viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M3 4h2l2.1 10.2a2 2 0 0 0 2 1.6h7.8a2 2 0 0 0 2-1.6L20 8H6.2"/><circle cx="10" cy="20" r="1"/><circle cx="18" cy="20" r="1"/></svg>`;
    el("udsModalConcierge").textContent=currentLanguage==="en"?"Ask":"Preguntar";
    el("udsModalTrade").textContent=currentLanguage==="en"?"Trade in":"Intercambiar";
    closePanels(false);openOverlay();el("udsModal").classList.add("is-open");el("udsModal").setAttribute("aria-hidden","false"); requestAnimationFrame(()=>{const m=el("udsModal");if(m)m.scrollTop=savedModalScroll;const g=m?.querySelector(".uds-modal-grid");if(g)g.scrollTop=savedGridScroll;});
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

    // Conserva visible la referencia del vendedor después de Stripe.
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
      // Una sesión ya procesada no debe vaciar ni abrir el aviso otra vez.
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
      db.from("categories").select("id,name,slug,image_url,sort_order").eq("is_active",true).order("sort_order",{ascending:true}).abortSignal(timeoutSignal()),
      db.from("products").select(`id,category_id,sku,name,slug,brand,model,item_condition,short_description,description,short_description_en,description_en,specifications,currency,price,sale_price,stock,cover_image_url,featured,status,created_at,categories(name,slug),product_images(id,image_url,alt_text,sort_order,is_primary)`).eq("status","active").order("featured",{ascending:false}).order("created_at",{ascending:false}).abortSignal(timeoutSignal())
    ]);
    if(ce||pe){
      const error=ce||pe;
      if(restoredFromCache){
        console.warn("[UPDOWN catalog refresh]",error);
        showToast(currentLanguage==="en"?"Showing the latest saved catalog while the connection recovers.":"Mostramos el último catálogo guardado mientras se recupera la conexión.");
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
      showToast(currentLanguage==="en"?"The catalog loaded, but we could not update your cart.":"El catálogo cargó, pero no pudimos actualizar tu carrito.");
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
  el("udsModalImage").addEventListener("keydown",event=>{if(event.key==="Enter"||event.key===" "){event.preventDefault();openImageViewer();}});
  el("udsModalDescriptionToggle").onclick=()=>{if(modalProduct)renderProductDescription(modalProduct,!productDescriptionExpanded);};
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
    if(!cart.length)return showToast(currentLanguage==="en"?"Your cart is empty.":"Tu carrito está vacío.");
    if(window.__UPDOWN_CHECKOUT_ENABLED__!==true){
      return showToast(currentLanguage==="en"?"Checkout is disabled in this migration preview.":"El pago está desactivado en esta vista de migración.");
    }
    const b=el("udsCheckoutButton");b.disabled=true;b.textContent=currentLanguage==="en"?"Validating inventory…":"Validando inventario…";
    try{await reconcileCart({silent:false});if(!cart.length)return showToast(currentLanguage==="en"?"No products remain available.":"No quedaron productos disponibles.");b.textContent=currentLanguage==="en"?"Preparing secure checkout…":"Preparando pago seguro…";
      const {data,error}=await db.functions.invoke("create-checkout-session",{body:{items:cart.map(i=>({id:i.id,quantity:i.quantity})),seller_ref:getStoredAffiliate()?.code||null}});
      if(error){let msg=error.message||(currentLanguage==="en"?"We could not start the payment.":"No fue posible iniciar el pago.");try{if(error.context&&typeof error.context.json==="function"){const body=await error.context.json();msg=body?.error||msg}}catch(e){}try{await reconcileCart({silent:false})}catch(e){}throw new Error(msg)}
      if(!data?.url)throw new Error(currentLanguage==="en"?"Stripe did not return a payment URL.":"Stripe no devolvió una dirección de pago.");window.location.assign(data.url)
    }catch(e){console.error(e);showToast(e instanceof Error?e.message:(currentLanguage==="en"?"We could not start checkout.":"No pudimos iniciar el pago."))}finally{b.textContent=currentLanguage==="en"?"Secure checkout":"Finalizar compra segura";b.disabled=!cart.length}
  };



  // =========================================================
  // V9.2 · BILINGUAL CONTENT SYSTEM
  // Translates all static commercial/editorial UI and the
  // dynamic labels generated by the storefront.
  // =========================================================
  function siteText(key){
    const row=(window.__UPDOWN_TEXTS__||[]).find(item=>item.key===key);
    return row?.[currentLanguage]||row?.es||key;
  }
  const CATEGORY_EN={
    "driver":"Drivers","drivers":"Drivers","hierro":"Irons","hierros":"Irons","iron":"Irons","irons":"Irons","madera":"Fairway Woods","maderas":"Fairway Woods","wood":"Fairway Woods","woods":"Fairway Woods","hibrido":"Hybrids","hibridos":"Hybrids","hybrid":"Hybrids","hybrids":"Hybrids","wedge":"Wedges","wedges":"Wedges","putter":"Putters","putters":"Putters","pelota":"Golf Balls","pelotas":"Golf Balls","golf balls":"Golf Balls","bola":"Golf Balls","bolas":"Golf Balls","guante":"Gloves","guantes":"Gloves","glove":"Gloves","gloves":"Gloves","bolsa":"Golf Bags","bolsas":"Golf Bags","bag":"Golf Bags","bags":"Golf Bags","accesorio":"Accessories","accesorios":"Accessories","accessories":"Accessories","ropa":"Apparel","apparel":"Apparel","calzado":"Golf Shoes","zapatos":"Golf Shoes","shoes":"Golf Shoes","tees":"Tees","tee":"Tees","carrito":"Golf Carts","carritos":"Golf Carts","golf carts":"Golf Carts","equipos completos":"Complete Sets","complete sets":"Complete Sets"
  };
  // Golf category names are shared terminology in both storefront languages.
  function categoryLabel(category){
    if(!category)return "Golf";
    const candidates=[category.slug,category.name].filter(Boolean).map(v=>normalizeSpecKey(v));
    for(const key of candidates){if(CATEGORY_EN[key])return CATEGORY_EN[key]}
    return category.name||category.slug||"Golf";
  }
  function localizeStaticDom(lang){
    const root=document.getElementById("updown-store");if(!root)return;
    const map={};
    (window.__UPDOWN_TEXTS__||[]).forEach(row=>{
      [row.source_text,row.es,row.en].forEach(source=>{if(source)map[source]=row[lang]||row.es;});
    });
    const walker=document.createTreeWalker(root,NodeFilter.SHOW_TEXT);
    const nodes=[];while(walker.nextNode())nodes.push(walker.currentNode);
    const managed="script,style,[translate='no'],.uds-managed-course,.uds-managed-journal-card,.uds-managed-teacher,[data-managed-service],#udsModalTitle,#udsModalDescription,#udsPlayerFit,.uds-card h3,.uds-card .uds-description";
    nodes.forEach(node=>{
      if(node.parentElement?.closest(managed))return;
      const raw=node.nodeValue||"",trimmed=raw.trim();
      if(map[trimmed]&&trimmed!==map[trimmed])node.nodeValue=raw.replace(trimmed,map[trimmed]);
    });
    root.querySelectorAll("[aria-label],[placeholder],[title],[alt]").forEach(node=>{
      if(node.closest(managed))return;
      ["aria-label","placeholder","title","alt"].forEach(attr=>{const value=node.getAttribute(attr);if(value&&map[value])node.setAttribute(attr,map[value]);});
    });
  }
  function localizedProductText(product,field){
    if(currentLanguage!=="en")return product?.[field]||"";
    const translated=product?.[`${field}_en`];
    if(typeof translated==="string"&&translated.trim())return translated;
    const specs=product?.specifications&&typeof product.specifications==="object"?product.specifications:{};
    const aliases=field==="description"?["description_en","english_description","description english"]:["short_description_en","english_short_description","short description english"];
    for(const key of aliases){if(specs[key])return String(specs[key])}
    return product?.[field]||"";
  }

  function ghinMessage(lang=currentLanguage){
    return lang==="en"
      ?"Hi Carlos 👋 I’m coming from UP AND DOWN · Coque. I’d like information about joining GHIN and how registration works. Thank you."
      :"Hola Carlos 👋 Vengo de UP AND DOWN · Coque. Me gustaría recibir información para unirme a GHIN y conocer cómo funciona el registro. Gracias.";
  }
  function buildGhinWhatsAppUrl(lang=currentLanguage){
    return `https://wa.me/526241299870?text=${encodeURIComponent(ghinMessage(lang))}`;
  }

  function localizeWhatsAppLinks(lang){
    const serviceMessages={
      repair:{
        es:"Hola UP AND DOWN, quiero solicitar información sobre reparación de equipo de golf.",
        en:"Hi UP AND DOWN, I would like information about golf equipment repair."
      },
      trade:{
        es:"Hola UP AND DOWN, quiero llevar mi equipo a valoración para conocer si puede aplicar para intercambio en tienda.",
        en:"Hi UP AND DOWN, I would like to bring in my equipment for an evaluation to see whether it may qualify for a trade-in."
      },
      maintenance:{
        es:"Hola UP AND DOWN, quiero consultar el servicio de mantenimiento para mi equipo de golf.",
        en:"Hi UP AND DOWN, I would like information about maintenance service for my golf equipment."
      },
      classes:{
        es:"Hola UP AND DOWN, quiero información sobre las clases de golf y los horarios disponibles.",
        en:"Hi UP AND DOWN, I would like information about golf lessons and available times."
      },
      "putter-restoration":{
        es:"Hola UP AND DOWN, quiero consultar el servicio de reparación de Putters para mi equipo de golf.",
        en:"Hi UP AND DOWN, I would like information about the putter restoration service for my golf equipment."
      },
      ghin:{
        es:ghinMessage("es"),
        en:ghinMessage("en")
      }
    };

    document.querySelectorAll("#udsServices [data-service-whatsapp]").forEach(link=>{
      if(link.closest("[data-managed-service]"))return;
      const kind=link.dataset.serviceWhatsapp;
      const message=serviceMessages[kind]?.[lang];
      if(!message)return;
      const phone=kind==="ghin"?"526241299870":"526243554700";
      link.href=`https://wa.me/${phone}?text=${encodeURIComponent(message)}`;
    });

    document.querySelectorAll("#updown-store [data-ghin-contact]").forEach(link=>{
      if(!link.closest("[data-managed-service]"))link.href=buildGhinWhatsAppUrl(lang);
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
      announcement:"Equipo de golf seleccionado · Compra segura · Atención personalizada en Los Cabos",
      nav:["Novedades","Tienda","Categorías","Servicios","Clases","Campos de golf","Noticias","GHIN","Quiénes somos"],
      hero:"Seminuevos · Reparaciones · Intercambios · Clases · Ajuste de equipo",
      explore:"Explorar equipo →",featured:"Selección de Coque",search:"Buscar producto, marca, modelo o varilla…",filters:"Filtros",
      resultsEmpty:"No encontramos productos con esos filtros.",clear:"Limpiar filtros",
      newEyebrow:"NOVEDADES Y OFERTAS",newTitle:"Novedades y ofertas.",newIntro:"Lo más reciente del inventario y oportunidades con precio especial.",
      categoryEyebrow:"CATEGORÍAS",categoryTitle:"Compra por categoría.",categoryLink:"Ver toda la tienda",
      catalogEyebrow:"COLECCIÓN COMPLETA",catalogTitle:"El equipo correcto cambia el juego.",catalogIntro:"Consulta disponibilidad, compara configuraciones y arma tu selección con inventario actualizado."
    },
    en:{
      announcement:"Curated golf equipment · Secure Stripe checkout · Personal service in Los Cabos",
      nav:["New arrivals","Shop","Categories","Services","Lessons","Golf courses","Noticias","GHIN","About us"],
      hero:"○ Seminuevos ○ Reparaciones ○ Trading ○ Clases ○ Fittings",
      explore:"Explore equipment →",featured:"Coque’s Picks",search:"Search product, brand, model or shaft…",filters:"Filters",
      resultsEmpty:"No products match these filters.",clear:"Clear filters",
      newEyebrow:"Latest arrivals & offers",newTitle:"New arrivals & offers.",newIntro:"The newest inventory plus selected opportunities with special pricing.",
      categoryEyebrow:"Shop by category",categoryTitle:"Shop by category.",categoryLink:"View full shop",
      catalogEyebrow:"The collection",catalogTitle:"The right equipment changes the game.",catalogIntro:"Check availability, compare configurations and build your selection with updated inventory."
    }
  };
  function applyLanguage(lang){
    currentLanguage=lang==="en"?"en":"es";localStorage.setItem("upDownLanguage",currentLanguage);
    const t={...commerceTranslations[currentLanguage],
      hero:siteText("hero.services"),newEyebrow:siteText("new.eyebrow"),
      categoryEyebrow:siteText("category.eyebrow"),catalogEyebrow:siteText("catalog.eyebrow")};
    document.documentElement.lang=currentLanguage==="en"?"en":"es-MX";
    
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
    el("udsHeroCopy").textContent=t.hero;el("udsExploreButton").innerHTML=t.explore.replace("→","<span>→</span>");if(el("udsFeaturedButton"))el("udsFeaturedButton").textContent=t.featured;el("udsSearch").placeholder=t.search;
    el("udsFiltersToggle").childNodes[0].nodeValue=`${t.filters} `;el("udsClearFilters").textContent=t.clear;
    const newHead=document.querySelector("#udsNew .uds-section-head");
    const categoryHead=document.querySelector("#udsCategories .uds-section-head");
    const catalogHead=document.querySelector("#udsCatalog .uds-section-head");
    if(newHead){newHead.querySelector("h2").textContent=t.newTitle;newHead.querySelector(".uds-section-intro").textContent=t.newIntro}
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
    if(catalogHead){catalogHead.querySelector("h2").textContent=siteText("section.catalog");catalogHead.querySelector(".uds-section-intro").textContent=currentLanguage==="en"?"Search, filter and open each product to view configuration, condition and availability.":"Busca, filtra y abre cada producto para ver configuración, condición y disponibilidad."}
    el("udsLangEs").classList.toggle("is-active",currentLanguage==="es");el("udsLangEn").classList.toggle("is-active",currentLanguage==="en");el("udsLangEs").setAttribute("aria-pressed",String(currentLanguage==="es"));el("udsLangEn").setAttribute("aria-pressed",String(currentLanguage==="en"));
    el("udsConditionFilter").options[0].text=currentLanguage==="en"?"Any condition":"Cualquier condición";el("udsConditionFilter").options[1].text=currentLanguage==="en"?"New":"Nuevo";el("udsConditionFilter").options[2].text=currentLanguage==="en"?"Pre-owned":"Seminuevo";el("udsConditionFilter").options[3].text=currentLanguage==="en"?"Demo":"Demostración";
    el("udsConditionMobileFilter").options[0].text=currentLanguage==="en"?"Condition: any":"Condición: cualquiera";el("udsConditionMobileFilter").options[1].text=currentLanguage==="en"?"New":"Nuevo";el("udsConditionMobileFilter").options[2].text=currentLanguage==="en"?"Pre-owned":"Seminuevo";el("udsConditionMobileFilter").options[3].text=currentLanguage==="en"?"Demo":"Demostración";
    if(el("udsCatalogSearch"))el("udsCatalogSearch").placeholder=t.search;
    if(el("udsDiscoveryApply"))el("udsDiscoveryApply").textContent=currentLanguage==="en"?"Apply filters & view products":"Aplicar filtros y ver productos";
    if(el("udsDiscoveryClear"))el("udsDiscoveryClear").textContent=currentLanguage==="en"?"Clear filters":"Borrar filtros";
    if(el("udsCatalogApply"))el("udsCatalogApply").textContent=currentLanguage==="en"?"Apply filters":"Aplicar filtros";
    if(el("udsCatalogClear"))el("udsCatalogClear").textContent=currentLanguage==="en"?"Clear filters":"Borrar filtros";
    if(el("udsCatalogFilterToggle"))el("udsCatalogFilterToggle").textContent=currentLanguage==="en"?"Filter catalog":"Filtrar catálogo";
    renderCategories();renderCommerceFilters();renderAdvisorBar();renderPicks();renderNewArrivals();applyFilters();renderCart();if(modalProduct&&el("udsModal").classList.contains("is-open"))openProduct(modalProduct,true);
    localizeStaticDom(currentLanguage);
    localizeWhatsAppLinks(currentLanguage);
    setupJournalVisibility();
    const heroHeading=document.querySelector("#updown-store .uds-hero h1");
    if(heroHeading)heroHeading.textContent=siteText("hero.subtitle");
    document.querySelectorAll('[data-nav-key="journal"],.uds-footer-links a[href="#udsJournal"]').forEach(node=>node.textContent=siteText("news.title"));
    const newsHeading=document.querySelector("#udsJournal h2");if(newsHeading)newsHeading.textContent=siteText("news.title");
    document.querySelectorAll("#updown-store [data-store-copy]").forEach(node=>{
      node.textContent=siteText(node.getAttribute("data-store-copy"));
    });
    renderManagedServices();
    window.dispatchEvent(new CustomEvent("updown:language-change",{detail:currentLanguage}));
  }
  window.__UPDOWN_SET_LANGUAGE__=applyLanguage;
  if(window.__UPDOWN_LANGUAGE_LISTENER__)window.removeEventListener("updown:copy-ready",window.__UPDOWN_LANGUAGE_LISTENER__);
  window.__UPDOWN_LANGUAGE_LISTENER__=()=>applyLanguage(currentLanguage);
  window.addEventListener("updown:copy-ready",window.__UPDOWN_LANGUAGE_LISTENER__);
  if(el("udsLangEs"))if(el("udsLangEs"))el("udsLangEs").onclick=()=>applyLanguage("es");if(el("udsLangEn"))if(el("udsLangEn"))el("udsLangEn").onclick=()=>applyLanguage("en");

  // Navegación inmersiva y fija.
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
    es:{starting:"empezar desde cero",consistency:"mejorar la consistencia del swing",distance:"ganar distancia con el driver",irons:"mejorar hierros y precisión",short_game:"mejorar el juego corto",putting:"mejorar el putting",strategy:"trabajar estrategia en campo",other:"trabajar un objetivo específico"},
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
          ?`Hi ${instructorName}, I'm ${d.name} 👋 I came from UP AND DOWN · Coque. I already registered a lesson request on the website and I'd like to coordinate a lesson with you.`
          :`Hi ${instructorName} 👋 I came from UP AND DOWN · Coque. I already registered a lesson request on the website and I'd like to coordinate a lesson with you.`
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
        ?`Hola ${instructorName}, soy ${d.name} 👋 Vengo de UP AND DOWN · Coque. Ya registré anteriormente una solicitud de clases en la página y me gustaría coordinar una clase contigo.`
        :`Hola ${instructorName} 👋 Vengo de UP AND DOWN · Coque. Ya registré anteriormente una solicitud de clases en la página y me gustaría coordinar una clase contigo.`
    ];
    lines.push("");
    if(skill)lines.push(`Nivel de juego: ${skill}`);
    if(goal)lines.push(`Qué me gustaría mejorar: ${goal}`);
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
      udsClassFormMessage(currentLanguage==="en"?"Enter a valid phone or WhatsApp number.":"Ingresa un teléfono o WhatsApp válido.","error");
      el("udsClassPhone")?.focus();return;
    }
    if(!skill||!goal){
      udsClassFormMessage(currentLanguage==="en"?"Choose your playing level and what you want to improve.":"Selecciona tu nivel de juego y qué te gustaría mejorar.","error");
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
      udsClassFormMessage(currentLanguage==="en"?"We couldn't save your request. Please try again.":"No pudimos guardar tu solicitud. Inténtalo nuevamente.","error");
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

  // H80: service content is managed separately from the protected golf lesson workflow.
  let managedServices=null;
  const serviceCards=new Map([...document.querySelectorAll('#udsServices [data-service-card]')].map(card=>[card.dataset.serviceKind,card]));
  function serviceText(row,field){
    const translated=row[`${field}_${currentLanguage}`];
    if(Array.isArray(translated))return translated.length?translated:(row[`${field}_es`]||[]);
    return typeof translated==='string'&&translated.trim()?translated:(row[`${field}_es`]||'');
  }
  function serviceUrl(row){
    const raw=serviceText(row,'cta_url');
    if(!raw)return '';
    try{
      const url=new URL(raw,location.origin);
      if(!['https:','http:'].includes(url.protocol))return '';
      const isWa=url.hostname==='wa.me'||url.hostname==='api.whatsapp.com'||url.hostname==='web.whatsapp.com';
      const phone=(url.hostname==='wa.me'?url.pathname.replace(/\D/g,''):url.searchParams.get('phone')||'').replace(/\D/g,'');
      const affiliate=getStoredAffiliate();
      if(row.use_referral&&isWa&&phone==='526243554700'&&affiliate?.code){
        let sellerPhone=String(affiliate.seller_phone||'').replace(/\D/g,'');
        if(sellerPhone.length===10)sellerPhone=`52${sellerPhone}`;
        if(sellerPhone){if(url.hostname==='wa.me')url.pathname=`/${sellerPhone}`;else url.searchParams.set('phone',sellerPhone)}
        const message=url.searchParams.get('text')||'';
        const referral=currentLanguage==='en'?`I’m shopping with ${affiliate.seller_name||'UP AND DOWN'}'s referral (${affiliate.code}).`:`Estoy comprando con la referencia de ${affiliate.seller_name||'UP AND DOWN'} (${affiliate.code}).`;
        url.searchParams.set('text',`${message}\n\n${referral}`);
      }
      return url.href;
    }catch{return ''}
  }
  function renderManagedServices(){
    if(!managedServices)return;
    const grid=document.querySelector('#udsServices .uds-services-grid');
    if(!grid)return;
    const visible=new Set();
    [...managedServices].filter(row=>row.is_active).sort((a,b)=>a.sort_order-b.sort_order||a.key.localeCompare(b.key)).forEach(row=>{
      let card=serviceCards.get(row.key);
      if(!card){
        card=document.createElement('article');card.className='uds-service-card';card.dataset.serviceCard='';card.dataset.serviceKind=row.key;
        card.innerHTML='<button type="button" class="uds-service-head" aria-expanded="false"><div><div class="uds-service-title"><small></small><h3></h3></div></div><span class="uds-service-toggle">+</span></button><div class="uds-service-content"><div class="uds-service-content-inner"><div class="uds-service-body"></div></div></div>';
        serviceCards.set(row.key,card);
      }
      if(!card.id)card.id=`udsService-${row.key}`;
      visible.add(row.key);
      const head=card.querySelector('.uds-service-head');
      let photo=head.querySelector('.uds-service-photo');
      const image=safeServiceImage(row.image_url);
      if(image){
        if(!photo){photo=document.createElement('img');photo.className='uds-service-photo';photo.loading='lazy';photo.alt='';head.prepend(photo)}
        if(photo.getAttribute('src')!==image)photo.src=image;
        photo.onerror=()=>{photo.remove();card.classList.remove('has-service-photo')};
        card.classList.add('has-service-photo');
      }else{photo?.remove();card.classList.remove('has-service-photo')}
      // Keep the exact lesson DOM node, form, bindings, translation and instructors.
      if(row.key!=='classes'){
        card.dataset.managedService='';
        head.querySelector('h3').textContent=serviceText(row,'title');
        const eyebrow=head.querySelector('small');eyebrow.textContent=serviceText(row,'eyebrow');eyebrow.hidden=!eyebrow.textContent;
        const body=card.querySelector('.uds-service-body');body.replaceChildren();
        const add=(tag,className,text)=>{if(!text)return;const node=document.createElement(tag);node.className=className;node.textContent=text;body.appendChild(node);return node};
        add('p','',serviceText(row,'description'));
        const items=serviceText(row,'items');
        if(Array.isArray(items)&&items.length){const list=document.createElement('div');list.className='uds-service-points';items.forEach(text=>{if(typeof text!=='string'||!text.trim())return;const point=document.createElement('div');point.className='uds-service-point';point.textContent=text;list.appendChild(point)});body.appendChild(list)}
        const label=serviceText(row,'cta_label'),url=serviceUrl(row);
        if(label&&url){const actions=document.createElement('div');actions.className='uds-service-actions';const link=document.createElement('a');link.className='uds-btn uds-btn-primary';link.textContent=label;link.href=url;if(new URL(url).origin!==location.origin){link.target='_blank';link.rel='noopener noreferrer'}actions.appendChild(link);body.appendChild(actions)}
        add('div','uds-service-note',serviceText(row,'note'));
      }
      grid.appendChild(card);
    });
    serviceCards.forEach((card,key)=>{if(!visible.has(key)&&key!=='classes')card.remove()});
    publishServiceShortcuts();
  }
  function publishServiceShortcuts(){
    const rows=managedServices||[...serviceCards].filter(([,card])=>card.isConnected).map(([key,card])=>({key,is_active:true,title_es:card.querySelector('h3')?.textContent||'',title_en:'',image_url:card.querySelector('.uds-service-photo')?.src||null}));
    window.__UPDOWN_SERVICES__=rows.filter(row=>row.is_active).map(row=>({key:row.key,title_es:row.title_es,title_en:row.title_en,image_url:safeServiceImage(row.image_url)||null}));
    window.dispatchEvent(new Event('updown:services-ready'));
  }
  // Open the existing service node without recreating forms, CTAs or referral state.
  window.__UPDOWN_OPEN_SERVICE__=key=>{
    const card=serviceCards.get(key);
    if(!card?.isConnected)return false;
    document.querySelectorAll('#udsServices [data-service-card]').forEach(other=>{
      other.classList.remove('is-open');other.querySelector('.uds-service-head')?.setAttribute('aria-expanded','false');
    });
    card.classList.add('is-open');
    const trigger=card.querySelector('.uds-service-head');trigger?.setAttribute('aria-expanded','true');
    trigger?.focus({preventScroll:true});
    card.scrollIntoView({behavior:matchMedia('(prefers-reduced-motion: reduce)').matches?'instant':'smooth',block:'start'});
    return true;
  };
  function safeServiceImage(raw){try{const url=new URL(raw);return url.protocol==='https:'?url.href:''}catch{return ''}}
  async function loadManagedServices(){
    try{
      const {data,error}=await db.from('storefront_services').select('*').eq('is_active',true).order('sort_order').order('key').abortSignal(timeoutSignal());
      if(error||!Array.isArray(data)){console.warn('[UPDOWN services]',error);publishServiceShortcuts();return}
      if(!document.querySelector('#udsServices .uds-services-grid')?.contains(serviceCards.get('classes')))return;
      managedServices=data;renderManagedServices();
    }catch(error){console.warn('[UPDOWN services]',error);publishServiceShortcuts()}
  }

  // One delegated handler also supports newly registered services.
  document.querySelector('#udsServices .uds-services-grid')?.addEventListener('click',event=>{
    const trigger=event.target.closest('.uds-service-head');
    const card=trigger?.closest('[data-service-card]');
    if(!card)return;
    const shouldOpen=!card.classList.contains('is-open');
    document.querySelectorAll('#udsServices [data-service-card]').forEach(other=>{
      other.classList.remove('is-open');other.querySelector('.uds-service-head')?.setAttribute('aria-expanded','false');
    });
    if(shouldOpen){card.classList.add('is-open');trigger.setAttribute('aria-expanded','true');setTimeout(()=>card.scrollIntoView({behavior:'smooth',block:'center'}),180)}
  });


  // Menú superior -> Clases: abre directamente el servicio y lleva al usuario a la card.
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

  // Noticias: una sola tarjeta expandida a la vez.
  document.querySelectorAll("#updown-store [data-journal-card]").forEach(card=>{
    const button=card.querySelector(".uds-journal-toggle");
    button.addEventListener("click",()=>{
      const willOpen=!card.classList.contains("is-expanded");
      document.querySelectorAll("#updown-store [data-journal-card]").forEach(other=>{
        other.classList.remove("is-expanded");
        const otherButton=other.querySelector(".uds-journal-toggle");
        otherButton.setAttribute("aria-expanded","false");
        otherButton.querySelector("span:first-child").textContent=currentLanguage==="en"?"Read article":"Leer artículo";
      });
      if(willOpen){
        card.classList.add("is-expanded");
        button.setAttribute("aria-expanded","true");
        button.querySelector("span:first-child").textContent=currentLanguage==="en"?"Close article":"Cerrar artículo";
        setTimeout(()=>card.scrollIntoView({behavior:"smooth",block:"center"}),180);
      }
    });
  });

  document.addEventListener("keydown",e=>{
    const viewerOpen=el("udsImageViewer")?.classList.contains("is-open");

    if(viewerOpen&&e.key==="Tab"){
      const controls=[...el("udsImageViewer").querySelectorAll("button:not(:disabled)")];
      const index=controls.indexOf(document.activeElement);
      const next=e.shiftKey?(index<=0?controls.length-1:index-1):(index<0||index===controls.length-1?0:index+1);
      e.preventDefault();controls[next]?.focus();return;
    }
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

      const servicesLoad=affiliateCapture.then(()=>loadManagedServices());
      await loadStore();
      await affiliateCapture;
      await servicesLoad;

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
   Supabase becomes source of truth for Golf Courses + Noticias.
   Supabase/Admin is the only source of truth for managed editorial content.
   Static legacy cards are never used as fallback.
   ========================================================================== */
(function(){
  "use strict";

  const MC_SUPABASE_URL=window.__UPDOWN_SUPABASE_URL__;
  const MC_SUPABASE_KEY=window.__UPDOWN_SUPABASE_PUBLISHABLE_KEY__;

  const mcState={courses:[],articles:[],instructors:[],leadContext:null,city:"all"};

  const mcEsc=(v="")=>String(v)
    .replaceAll("&","&amp;").replaceAll("<","&lt;").replaceAll(">","&gt;")
    .replaceAll('"',"&quot;").replaceAll("'","&#039;");

  const mcLang=()=>{
    try{return document.documentElement.lang.startsWith("en")?"en":"es"}
    catch{return document.documentElement.lang==="en"?"en":"es"}
  };

  const mcText=(item,key)=>{
    const en=mcLang()==="en";
    return String((en?(item?.[`${key}_en`]||item?.[key]):(item?.[key]||item?.[`${key}_en`]))||"").trim();
  };

  async function mcFetch(table,query){
    if(!MC_SUPABASE_URL||!MC_SUPABASE_KEY)throw new Error("Falta configuración pública de Supabase para contenido administrado.");
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
    es:{starting:"Empezar desde cero",consistency:"Consistencia del swing",distance:"Más distancia / driver",irons:"Hierros y precisión",short_game:"Juego corto",putting:"Putting",strategy:"Estrategia en campo",other:"Otro"},
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
        ?`Hi ${firstName}, I'm ${d.name} 👋 I came from UP AND DOWN · Coque. I already registered a lesson request on the website and I'd like to coordinate a lesson with you.`
        :`Hi ${firstName} 👋 I came from UP AND DOWN · Coque. I already registered a lesson request on the website and I'd like to coordinate a lesson with you.`);
      lines.push("");
      if(skill)lines.push(`Playing level: ${skill}`);
      if(goal)lines.push(`What I'd like to improve: ${goal}`);
      if(comment)lines.push(`Comments: ${comment}`);
      if(shortRef)lines.push(`Ref: ${shortRef}`);
    }else{
      lines.push(d.name
        ?`Hola ${firstName}, soy ${d.name} 👋 Vengo de UP AND DOWN · Coque. Ya registré anteriormente una solicitud de clases en la página y me gustaría coordinar una clase contigo.`
        :`Hola ${firstName} 👋 Vengo de UP AND DOWN · Coque. Ya registré anteriormente una solicitud de clases en la página y me gustaría coordinar una clase contigo.`);
      lines.push("");
      if(skill)lines.push(`Nivel de juego: ${skill}`);
      if(goal)lines.push(`Qué me gustaría mejorar: ${goal}`);
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
    return `<article class="uds-course uds-managed-course ${image?"":"is-no-image"}" data-content-active="true" data-managed-course-id="${mcEsc(course.id)}">
      <div class="uds-course-media">${image?`<img alt="${mcEsc(name)}" class="uds-course-bg" loading="lazy" decoding="async" src="${mcEsc(image)}"/>`:""}</div>
      <div class="uds-course-copy">
        ${location?`<div class="uds-eyebrow">${mcEsc(location)}</div>`:""}
        <h3>${mcEsc(name)}</h3>
        ${description?`<p class="uds-course-description">${mcEsc(description)}</p><button type="button" class="uds-course-read" data-course-read="" aria-haspopup="dialog" aria-label="${mcEsc((mcLang()==="en"?"Read more about ":"Leer más sobre ")+name)}">${mcLang()==="en"?"Read more":"Leer más"}<span aria-hidden="true">↗</span></button>`:""}
        ${(map||official)?`<div class="uds-course-actions">
          ${map?`<a href="${mcEsc(map)}" rel="noopener noreferrer" target="_blank">${mcLang()==="en"?"Directions":"Cómo llegar"}</a>`:""}
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
    const eyebrow=mcText(article,"eyebrow"),title=mcText(article,"title"),summary=mcText(article,"summary"),body=mcText(article,"body");
    const image=String(article.image_url||"").trim(),number=String(index+1).padStart(2,"0");
    return `<article class="uds-journal-card uds-managed-journal-card" data-content-active="true" data-journal-card="" data-priority="${article.is_priority?"true":"false"}" data-managed-journal-id="${mcEsc(article.id)}">
      <div class="uds-journal-media ${image?"":"is-no-image"}">
        ${image?`<img alt="${mcEsc(title)}" loading="lazy" decoding="async" src="${mcEsc(image)}"/>`:""}<span class="uds-journal-number">${number}</span>
      </div>
      <div class="uds-journal-body">
        <div class="uds-journal-summary">${eyebrow?`<small>${mcEsc(eyebrow)}</small>`:""}<h3>${mcEsc(title)}</h3></div>
        ${summary?`<p class="uds-journal-lead">${mcEsc(summary)}</p>`:""}
        ${body?`<button class="uds-journal-toggle" type="button" aria-haspopup="dialog" aria-label="${mcEsc((mcLang()==="en"?"Read article: ":"Leer artículo: ")+title)}"><span>${mcLang()==="en"?"Read article":"Leer artículo"}</span><span aria-hidden="true">↗</span></button>`:""}
      </div>
    </article>`;
  }

  let mcJournalVisible=4;
  function mcBindJournal(){
    document.querySelectorAll('#udsJournalGrid .uds-journal-toggle').forEach(toggle=>{
      toggle.onclick=()=>mcOpenReader('article',toggle.closest('[data-managed-journal-id]').dataset.managedJournalId,toggle);
    });
  }
  function mcRenderJournal(){
    const grid=document.getElementById("udsJournalGrid"),more=document.getElementById("udsJournalMore");
    if(!grid)return false;
    const articles=Array.isArray(mcState.articles)?mcState.articles:[];
    const shown=articles.slice(0,mcJournalVisible);
    grid.innerHTML=shown.map(mcJournalCard).join("");grid.dataset.source="supabase";grid.dataset.managedCount=String(articles.length);
    if(more){
      const hasMore=articles.length>shown.length;
      more.hidden=!hasMore;more.classList.toggle("uds-hidden",!hasMore);
      more.textContent=mcLang()==="en"?"View more news":"Ver más noticias";
      more.removeAttribute('aria-expanded');more.setAttribute('aria-controls','udsJournalGrid');
      more.onclick=hasMore?()=>{
        const previous=shown.length;mcJournalVisible+=4;mcRenderJournal();
        const firstNew=grid.querySelectorAll('.uds-journal-card')[previous];
        if(firstNew){firstNew.tabIndex=-1;firstNew.focus({preventScroll:true});firstNew.scrollIntoView({behavior:matchMedia('(prefers-reduced-motion: reduce)').matches?'instant':'smooth',block:'start'})}
      }:null;
    }
    mcBindJournal();return true;
  }

  // H81: one native dialog gives both editorial readers a full-width mobile layout.
  let mcReader=null,mcReaderState=null,mcDisposed=false,mcLanguageObserver=null,mcBootTimer=null;
  function mcReaderRecord(){
    if(!mcReaderState)return null;
    const list=mcReaderState.kind==='course'?mcState.courses:mcState.articles;
    return list.find(item=>String(item.id)===mcReaderState.id)||null;
  }
  function mcReaderMarkup(item,kind){
    const course=kind==='course';
    const title=course?String(item.name||''):mcText(item,'title');
    const eyebrow=course?String(item.location_label||''):mcText(item,'eyebrow');
    const image=String(item.image_url||'').trim();
    const summary=course?'':mcText(item,'summary');
    const body=mcText(item,course?'description':'body');
    return `${image?`<img class="uds-reader-image" src="${mcEsc(image)}" alt="${mcEsc(title)}"/>`:''}
      <div class="uds-reader-copy">${eyebrow?`<p class="uds-reader-eyebrow">${mcEsc(eyebrow)}</p>`:''}
      <h2 id="udsEditorialReaderTitle">${mcEsc(title)}</h2>
      ${summary?`<p class="uds-reader-lead">${mcEsc(summary)}</p>`:''}
      <div class="uds-reader-article">${mcParagraphs(body)}</div>
      ${course&&(item.map_url||item.official_url)?`<div class="uds-reader-actions">
        ${item.map_url?`<a href="${mcEsc(item.map_url)}" target="_blank" rel="noopener noreferrer">${mcLang()==='en'?'Directions':'Cómo llegar'}</a>`:''}
        ${item.official_url?`<a href="${mcEsc(item.official_url)}" target="_blank" rel="noopener noreferrer">${mcLang()==='en'?'Official site':'Sitio oficial'}</a>`:''}
      </div>`:''}</div>`;
  }
  function mcEnsureReader(){
    if(mcReader)return mcReader;
    mcReader=document.createElement('dialog');mcReader.id='udsEditorialReader';mcReader.className='uds-editorial-reader';
    mcReader.setAttribute('aria-labelledby','udsEditorialReaderTitle');
    mcReader.innerHTML='<header class="uds-reader-toolbar"><span class="uds-reader-section"></span><button type="button" class="uds-reader-close" autofocus><svg viewBox="0 0 24 24" aria-hidden="true"><path d="m6 6 12 12M18 6 6 18"/></svg></button></header><div class="uds-reader-scroll" tabindex="0"></div>';
    document.body.appendChild(mcReader);
    mcReader.querySelector('.uds-reader-close').onclick=()=>mcCloseReader();
    mcReader.addEventListener('cancel',event=>{event.preventDefault();mcCloseReader()});
    mcReader.addEventListener('close',()=>{if(mcReaderState)mcCloseReader()});
    return mcReader;
  }
  function mcRefreshReader(){
    if(!mcReaderState)return;
    const item=mcReaderRecord();if(!item){mcCloseReader();return}
    const scroll=mcReader.querySelector('.uds-reader-scroll');const top=scroll.scrollTop;
    scroll.innerHTML=mcReaderMarkup(item,mcReaderState.kind);scroll.scrollTop=top;
    mcReader.querySelector('.uds-reader-section').textContent=mcReaderState.kind==='course'?(mcLang()==='en'?'Golf courses':'Campos de golf'):(mcLang()==='en'?'News':'Noticias');
    mcReader.querySelector('.uds-reader-close').setAttribute('aria-label',mcLang()==='en'?'Close content':'Cerrar contenido');
  }
  function mcOpenReader(kind,id,trigger){
    if(mcReaderState)mcCloseReader(false);
    const properties=['position','top','left','right','width','overflow'];
    const styles=properties.map(key=>[key,document.body.style.getPropertyValue(key),document.body.style.getPropertyPriority(key)]);
    mcReaderState={kind,id:String(id),trigger,y:window.scrollY,styles};
    const reader=mcEnsureReader();mcRefreshReader();
    if(!mcReaderState)return;
    document.body.style.setProperty('position','fixed');document.body.style.setProperty('top',`-${mcReaderState.y}px`);
    document.body.style.setProperty('left','0');document.body.style.setProperty('right','0');document.body.style.setProperty('width','100%');document.body.style.setProperty('overflow','hidden');
    reader.showModal();reader.querySelector('.uds-reader-scroll').scrollTop=0;reader.querySelector('.uds-reader-close').focus({preventScroll:true});
  }
  function mcCloseReader(restore=true){
    if(!mcReaderState)return;
    const saved=mcReaderState;mcReaderState=null;
    if(mcReader?.open)mcReader.close();
    saved.styles.forEach(([key,value,priority])=>{if(value)document.body.style.setProperty(key,value,priority);else document.body.style.removeProperty(key)});
    window.scrollTo({top:saved.y,left:0,behavior:'instant'});
    if(restore){
      const selector=saved.kind==='course'?'[data-course-read]':'.uds-journal-toggle';
      const cards=[...document.querySelectorAll(saved.kind==='course'?'[data-managed-course-id]':'[data-managed-journal-id]')];
      const current=cards.find(card=>String(saved.kind==='course'?card.dataset.managedCourseId:card.dataset.managedJournalId)===saved.id)?.querySelector(selector);
      const target=saved.trigger?.isConnected?saved.trigger:current;target?.focus({preventScroll:true});
    }
  }
  function mcDispose(){
    mcDisposed=true;clearInterval(mcBootTimer);mcLanguageObserver?.disconnect();mcCloseReader(false);mcReader?.remove();mcReader=null;
    window.removeEventListener('updown:storefront-dispose',mcDispose);
  }
  window.addEventListener('updown:storefront-dispose',mcDispose);

  function mcCourseCity(course){
    const explicit=String(course.city||"").trim();
    const text=(explicit||String(course.location_label||"")).normalize("NFD").replace(/[\u0300-\u036f]/g,"").toLowerCase();
    if(/san jose/.test(text))return "San José del Cabo";
    if(/cabo san lucas|los cabos/.test(text))return "Los Cabos";
    if(/la ribera/.test(text))return "La Ribera";
    return explicit||"";
  }
  function mcRenderCourses(){
    const grid=document.querySelector("#udsCourses .uds-course-grid");
    if(!grid)return false;
    const cities=[...new Set(mcState.courses.map(mcCourseCity).filter(Boolean))].sort((a,b)=>a.localeCompare(b,"es"));
    if(mcState.city!=="all"&&!cities.includes(mcState.city))mcState.city="all";
    const select=document.getElementById("udsCourseCity");
    const all=mcLang()==="en"?"All":"Todos";
    if(select){
      select.innerHTML=`<option value="all">${all}</option>`+cities.map(city=>`<option value="${mcEsc(city)}">${mcEsc(city)}</option>`).join("");
      select.value=mcState.city;
      select.onchange=()=>{mcState.city=select.value;mcRenderCourses();};
    }
    const filter=document.querySelector("#udsCourses .uds-course-city-filter");
    if(filter){
      let details=filter.querySelector("details");
      if(!details){details=document.createElement("details");details.className="uds-city-picker";filter.appendChild(details);}
      details.innerHTML=`<summary aria-label="${mcLang()==="en"?"Filter courses by city":"Filtrar campos por ciudad"}"><span class="uds-city-triangle" aria-hidden="true">▶</span><span>${mcEsc(mcState.city==="all"?all:mcState.city)}</span></summary><div class="uds-city-options">${["all",...cities].map(city=>`<button type="button" data-city="${mcEsc(city)}" aria-pressed="${city===mcState.city}">${mcEsc(city==="all"?all:city)}</button>`).join("")}</div>`;
      details.querySelectorAll("button[data-city]").forEach(button=>button.onclick=()=>{mcState.city=button.dataset.city;details.open=false;mcRenderCourses();filter.querySelector("summary")?.focus();});
      details.onkeydown=event=>{if(event.key==="Escape"){details.open=false;details.querySelector("summary")?.focus();}};
    }
    const shown=mcState.courses.filter(course=>mcState.city==="all"||mcCourseCity(course)===mcState.city);
    grid.innerHTML=shown.map(mcCourseCard).join("");
    grid.querySelectorAll("[data-course-read]").forEach(button=>button.onclick=()=>mcOpenReader("course",button.closest("[data-managed-course-id]").dataset.managedCourseId,button));
    grid.dataset.source="supabase";
    grid.dataset.managedCount=String(shown.length);
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
    mcRefreshReader();
  }

  async function mcLoad(){
    try{
      const [coursesResult,articlesResult,instructorsResult]=await Promise.allSettled([
        mcFetch(
          "golf_courses",
          "select=id,name,city,location_label,description,description_en,image_url,map_url,official_url,sort_order,is_visible&is_visible=eq.true&order=sort_order.asc,created_at.asc"
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

      if(mcDisposed)return;
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
    mcLanguageObserver=new MutationObserver(()=>{
      const next=document.documentElement.lang||"";
      if(next!==last){
        last=next;
        mcRenderAll();
      }
    });
    mcLanguageObserver.observe(document.documentElement,{attributes:true,attributeFilter:["lang"]});
  }

  function mcBoot(){
    let tries=0;
    const timer=mcBootTimer=setInterval(()=>{
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
    head.innerHTML=`<strong>${txt("Navegación","Navigation")}</strong><button class="uds53-close" type="button" aria-label="${txt("Cerrar menú","Close menu")}">×</button>`;
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
      {label:txt("Colección completa","Full collection"),onClick:()=>scrollToId("udsCatalog")},
      {label:txt("Compra por categoría","Shop by category"),onClick:()=>scrollToId("udsCategories")},
    ];
    menu.appendChild(makeGroup(txt("Tienda","Shop"),shop));

    const categories=getCategories().map(c=>({
      label:c.label,
      onClick:()=>applyCategory(c.value)
    }));
    menu.appendChild(makeGroup(txt("Categorías","Categories"),categories.length?categories:[
      {label:txt("Ver categorías","View categories"),onClick:()=>scrollToId("udsCategories")}
    ]));

    menu.appendChild(makeGroup(txt("Servicios","Services"),[
      {label:txt("Reparación","Repair"),onClick:()=>openService(/reparaci|repair/i)},
      {label:txt("Intercambios","Trade-ins"),onClick:()=>openService(/intercambio|trade/i)},
      {label:txt("Mantenimiento","Maintenance"),onClick:()=>openService(/mantenimiento|maintenance/i)},
      {label:txt("Restauración de Putters","Putter Restoration"),onClick:()=>openService(/putter/i)},
    ]));

    menu.appendChild(makeGroup(txt("Golf en Los Cabos","Golf in Los Cabos"),[
      {label:txt("Campos de golf","Golf courses"),onClick:()=>scrollToId("udsCourses")},
      {label:"Noticias",onClick:()=>scrollToId("udsJournal")},
    ]));

    menu.appendChild(makeButton(txt("Quiénes somos","About us"),"uds53-direct",()=>scrollToId("udsAbout")));
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
      dockMenu.setAttribute("aria-label",txt("Abrir menú","Open menu"));
      const label=dockMenu.querySelector("span");
      if(label)label.textContent=txt("Menú","Menu");

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
     1) Catalog pager: 4 mobile products, scoped observer only on #udsGrid.
     ---------------------------------------------------------- */
  let page=0;
  const pageSize=4;
  let pager=null;
  let pagerLabel=null;
  let prevBtn=null;
  let nextBtn=null;
  let scheduled=false;

  function productCards(){
    if(!grid)return [];
    return [...grid.children].filter(node=>node.nodeType===1 && node.classList.contains("uds-card"));
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
    prevBtn.innerHTML='<svg viewBox="0 0 20 20" aria-hidden="true" focusable="false"><path d="M13 4 5 10l8 6Z"/></svg>';

    pagerLabel=document.createElement("span");

    nextBtn=document.createElement("button");
    nextBtn.type="button";
    nextBtn.setAttribute("aria-label","Productos siguientes");
    nextBtn.innerHTML='<svg viewBox="0 0 20 20" aria-hidden="true" focusable="false"><path d="m7 4 8 6-8 6Z"/></svg>';

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
    pager.style.display=cards.length?"grid":"none";
    const english=document.documentElement.lang.startsWith("en");
    prevBtn.setAttribute("aria-label",english?"Previous products":"Productos anteriores");
    nextBtn.setAttribute("aria-label",english?"Next products":"Productos siguientes");

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

    pagerLabel.textContent=`${page+1} / ${pages} · ${cards.length} ${english?(cards.length===1?"product":"products"):(cards.length===1?"producto":"productos")}`;
    pagerLabel.setAttribute("aria-live","polite");
    pagerLabel.setAttribute("aria-atomic","true");
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

  window.addEventListener("resize",schedulePage,{passive:true});
  window.addEventListener("orientationchange",()=>setTimeout(schedulePage,100),{passive:true});

  window.__UPDOWN_HOTFIX58_OK__=true;
})();







/* H78: smooth accumulated scrolling plus mouse drag and native touch swipe. */
(()=>{
  const strip=document.querySelector("#updown-store .uds-brand-strip");
  const track=strip?.querySelector(".uds-brand-track");
  if(!strip||!track)return;
  const items=[...track.children];
  items.slice(items.length/2).forEach(item=>item.setAttribute("aria-hidden","true"));
  const reduced=window.matchMedia("(prefers-reduced-motion:reduce)");
  let touching=false,hovering=false,drag=null,pauseUntil=0,last=0,position=strip.scrollLeft;
  const pause=()=>{pauseUntil=performance.now()+2500;};
  strip.querySelectorAll("img").forEach(img=>{img.draggable=false;});
  strip.addEventListener("pointerenter",event=>{if(event.pointerType==="mouse")hovering=true;});
  strip.addEventListener("pointerleave",()=>{hovering=false;});
  strip.addEventListener("pointerdown",event=>{
    pause();
    if(event.pointerType!=="mouse"||event.button!==0)return;
    event.preventDefault();
    drag={id:event.pointerId,x:event.clientX,scroll:strip.scrollLeft};
    strip.setPointerCapture(event.pointerId);
    strip.classList.add("is-dragging");
  });
  strip.addEventListener("pointermove",event=>{
    if(!drag||event.pointerId!==drag.id)return;
    event.preventDefault();
    strip.scrollLeft=drag.scroll+drag.x-event.clientX;
    position=strip.scrollLeft;pause();
  });
  const stopDrag=()=>{drag=null;strip.classList.remove("is-dragging");position=strip.scrollLeft;pause();};
  ["pointerup","pointercancel","lostpointercapture"].forEach(name=>strip.addEventListener(name,stopDrag));
  strip.addEventListener("touchstart",()=>{touching=true;pause();},{passive:true});
  ["touchend","touchcancel"].forEach(name=>strip.addEventListener(name,()=>{touching=false;position=strip.scrollLeft;pause();},{passive:true}));
  strip.addEventListener("focusout",pause);
  strip.addEventListener("wheel",pause,{passive:true});
  strip.addEventListener("keydown",pause);
  function tick(now){
    if(!strip.isConnected)return;
    const delta=last?Math.min(now-last,50):0;last=now;
    const rect=strip.getBoundingClientRect();
    const paused=document.hidden||reduced.matches||touching||hovering||drag||strip.matches(":focus-visible")||now<pauseUntil||rect.bottom<=0||rect.top>=window.innerHeight;
    if(paused){position=strip.scrollLeft;track.style.removeProperty("transform");}
    else {
      const half=track.scrollWidth/2;
      if(half>strip.clientWidth){
        // Keep fractional progress: some browsers round every scrollLeft assignment.
        position+=delta*.028;
        if(position>=half)position-=half;
        strip.scrollLeft=position;
        // Preserve subpixel motion even when native scrolling rounds to whole pixels.
        track.style.setProperty("transform",`translate3d(${strip.scrollLeft-position}px,0,0)`,"important");
      }
    }
    requestAnimationFrame(tick);
  }
  requestAnimationFrame(tick);
})();
