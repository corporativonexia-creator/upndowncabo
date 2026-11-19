// Isolated fixture service. It has no credentials or connection to real Supabase.
const http = require('node:http');
const baseProducts = [
  {id:'p1',name:'Polo clásico',sku:'ROP-001',barcode:'2000000000015',brand:'Marca Águila',model:'Tour A',category_id:'c1',categories:{name:'Ropa'},online_visible:false,pos_visible:true},
  {id:'p2',name:'Polo clásico azul',sku:'ROP-0010',barcode:'2000000000022',brand:'Otra marca',model:'Tour B',category_id:'c1',categories:{name:'Ropa'},online_visible:true,pos_visible:true},
  {id:'p3',name:'Driver',sku:'PAL-001',barcode:'2000000000039',brand:'Golf',model:'Max',category_id:'c2',categories:{name:'Palos'},online_visible:true,pos_visible:false},
].map(p=>({...p,price:350,sale_price:null,stock:5,status:'active',currency:'MXN',product_images:[],specifications:{},created_at:'2026-01-01T00:00:00Z'}));
const baseVariants = [
  {id:'v1',product_id:'p1',title:'XS rojo',sku:'ROP-001-XS',barcode:'2000000000046',attributes:{talla:'XS',color:'Rojo',genero:'Unisex'}},
  {id:'v2',product_id:'p1',title:'XXL blanco',sku:'ROP-001-XXL',barcode:'2000000000053',attributes:{talla:'XXL',color:'Blanco',genero:'Unisex'}},
  {id:'v3',product_id:'p2',title:'M azul',sku:'ROP-0010-M',barcode:'2000000000060',attributes:{talla:'M'}},
  {id:'v4',product_id:'p3',title:'Única',sku:'PAL-001-U',barcode:'2000000000077',attributes:{}},
].map(v=>({...v,stock:5,price:null,sale_price:null,is_active:true,low_stock_threshold:2,created_at:'2026-01-01T00:00:00Z'}));
let products,variants,gallery,events,options,uploadedPaths;
function reset(){products=structuredClone(baseProducts);variants=structuredClone(baseVariants);gallery=[];events=[];options={};uploadedPaths=new Set();}reset();
const user={id:'00000000-0000-4000-8000-000000000001',aud:'authenticated',role:'authenticated',email:'admin@example.test',created_at:'2026-01-01T00:00:00Z',app_metadata:{},user_metadata:{}};
function token(){const enc=x=>Buffer.from(JSON.stringify(x)).toString('base64url');return `${enc({alg:'HS256',typ:'JWT'})}.${enc({sub:user.id,aud:'authenticated',role:'authenticated',exp:Math.floor(Date.now()/1000)+3600,iat:Math.floor(Date.now()/1000)})}.${Buffer.from('fixture-signature').toString('base64url')}`;}
http.createServer(async(req,res)=>{
  res.setHeader('Access-Control-Allow-Origin','*');res.setHeader('Access-Control-Allow-Headers','*');res.setHeader('Access-Control-Allow-Methods','GET,POST,PATCH,DELETE,OPTIONS');
  if(req.method==='OPTIONS'){res.writeHead(204);return res.end();}
  const url=new URL(req.url,'http://127.0.0.1:4319');
  let raw='';for await(const c of req)raw+=c;
  const body=raw&&String(req.headers['content-type']||'').includes('application/json')?JSON.parse(raw):{};
  const send=(value,status=200)=>{res.writeHead(status,{'Content-Type':'application/json'});res.end(JSON.stringify(value));};
  if(url.pathname==='/__reset'){reset();options=body;return send({ok:true});}
  if(url.pathname==='/__events')return send(events);
  if(url.pathname==='/__options'){Object.assign(options,body);if(body.zeroStock)variants[0].stock=0;if(body.posFixture){variants[1].price=475;variants[1].attributes.image_url='http://127.0.0.1:4319/variant.png';}if(body.retirementArchivedProduct)Object.assign(products[1],{status:'archived',online_visible:false,pos_visible:false,featured:false,new_arrival_enabled:false});if(body.existingPhoto){const old={id:'img-old',product_id:'p1',image_url:'https://fixture.test/old-photo.jpg',sort_order:1,is_primary:true};gallery.push(old);products[0].product_images=[old];}if(body.fullGallery){const rows=Array.from({length:10},(_,i)=>({id:`full-${i}`,product_id:'p1',image_url:`https://fixture.test/full-${i}.jpg`,sort_order:i+1,is_primary:i===0}));gallery.push(...rows);products[0].product_images=rows;}return send({ok:true});}
  events.push({path:url.pathname,method:req.method,body,query:url.search,authorized:!!req.headers.authorization,
    storageUpsert:url.pathname.startsWith('/storage/v1/object/')?String(req.headers['x-upsert']||''):undefined});
  if(url.pathname==='/auth/v1/token'){
    if(body.password!=='fixture-password')return send({message:'Invalid login credentials',error_code:'invalid_credentials'},400);
    return send({access_token:token(),token_type:'bearer',expires_in:3600,refresh_token:'fixture-refresh',user});
  }
  if(url.pathname==='/auth/v1/user')return send(user);
  if(url.pathname==='/auth/v1/logout')return send({});
  if(url.pathname==='/rest/v1/profiles')return send({id:user.id,role:'admin',is_active:true,full_name:'Fixture Admin'});
  if(url.pathname==='/rest/v1/categories')return send([{id:'c1',name:'Ropa',sort_order:1,is_active:true,variant_schema:['talla','color']},{id:'c2',name:'Palos',sort_order:2,is_active:true,variant_schema:['mano','loft','flex']},{id:'c3',name:'Calzado',sort_order:3,is_active:true,variant_schema:['talla']}]);
  if(url.pathname==='/rest/v1/rpc/admin_inventory_catalog')return send({rows:variants.map(v=>{
    const product=products.find(p=>p.id===v.product_id);
    return {product_id:v.product_id,product_name:product?.name||'Producto',variant_id:v.id,
      variant_title:v.title,sku:v.sku,barcode:v.barcode,stock:v.stock,
      low_stock_threshold:v.low_stock_threshold,is_default:false,attributes:v.attributes};
  })});
  if(url.pathname==='/rest/v1/rpc/admin_inventory_movement_log'){
    if(options.movementLogDelay)await new Promise(r=>setTimeout(r,options.movementLogDelay));
    if(options.movementLogError)return send({code:'FIXTURE',message:'Bitácora no disponible'},503);
    return send({rows:[{id:'movement-qa-1',created_at:'2026-11-18T12:00:00Z',movement_type:'restock',
      quantity_change:3,stock_before:2,stock_after:5,note:'Recepción de prueba',
      product_name:'Polo clásico',variant_title:'XS rojo',sku:'ROP-001-XS',barcode:'2000000000046',
      order_id:null,pos_sale_id:null}]});
  }
  if(url.pathname==='/rest/v1/rpc/pos_is_session_active')return send(true);
  if(url.pathname==='/rest/v1/rpc/pos_get_my_access')return send({employee_id:'employee-qa',employee_number:'QA01',full_name:'QA Cashier',employee_role:'pos_admin',employee_status:'active',terminal_id:'terminal-qa',terminal_name:'QA Terminal',terminal_authorized:true,open_shift_id:'shift-qa',opening_cash:500});
  if(url.pathname==='/rest/v1/rpc/pos_get_current_shift_sales')return send({sales:[],cash_movements:[],cash_in:0,cash_out:0,cash_refunds:0,expected_cash:500});
  if(url.pathname==='/rest/v1/rpc/pos_create_sale_v22'){
    const i=body.p_items[0],v=variants.find(v=>v.id===i.variant_id);
    if(v)v.stock-=i.quantity;
    return send({ok:true,sale_id:'sale-qa',sale_number:1,total:body.p_payments[0].amount});
  }
  if(url.pathname==='/rest/v1/products'){
    if(options.productError)return send({message:'Fixture catalog failure',code:'FIXTURE'},400);
    if(options.productDelay)await new Promise(r=>setTimeout(r,options.productDelay));
    if(req.method==='PATCH'){if(options.metadataError&&body.brand)return send({message:'Fixture metadata save failure',code:'FIXTURE'},503);const id=url.searchParams.get('id')?.slice(3);const p=products.find(p=>p.id===id);Object.assign(p,body);return send(p);}
    const photoFilter=url.searchParams.get('or');
    if(photoFilter){
      if(options.photoSearchDelay)await new Promise(r=>setTimeout(r,options.photoSearchDelay));
      if(options.photoSearchError)return send({message:'Fixture catalog SELECT denied by RLS',code:'42501'},403);
      const clauses=photoFilter.replace(/^\(|\)$/g,'').split(',').map(part=>part.match(/^(name|barcode)\.ilike\.%(.+)%$/));
      const matching=products.filter(p=>clauses.some(clause=>clause&&String(p[clause[1]]||'').toLocaleLowerCase('es').includes(clause[2].toLocaleLowerCase('es'))));
      return send(matching.slice(0,Math.min(10,Number(url.searchParams.get('limit'))||10)));
    }
    return send(url.searchParams.get("pos_visible")==="eq.true"?products.filter(p=>p.pos_visible):products);
  }
  if(url.pathname==='/rest/v1/product_images'){
    if(req.method==='DELETE'){
      const productId=url.searchParams.get('product_id')?.slice(3);
      const removed=gallery.filter(image=>image.product_id===productId);
      gallery=gallery.filter(image=>image.product_id!==productId);
      const parent=products.find(p=>p.id===productId);
      if(parent)parent.product_images=[];
      return send(removed);
    }
    if(req.method==='POST'){
      if(options.galleryInsertForbidden)return send({message:'Fixture product_images INSERT denied by RLS',code:'42501'},403);
      if(options.galleryError)return send({message:'Fixture image insert failure',code:'FIXTURE'},503);
      const rows=Array.isArray(body)?body:[body];
      for(const row of rows){
        const saved={...row,id:`img-${gallery.length+1}`};gallery.push(saved);
        const parent=products.find(p=>p.id===row.product_id);
        if(parent)parent.product_images.push(saved);
      }
      return send(rows.map((_,index)=>({id:`img-${gallery.length-rows.length+index+1}`})),201);
    }
    if(req.method==='GET'){
      const productId=url.searchParams.get('product_id')?.slice(3);
      return send(productId?gallery.filter(image=>image.product_id===productId):gallery);
    }
    return send([]);
  }
  if(['/rest/v1/inventory_movements','/rest/v1/pos_sale_items','/rest/v1/order_items',
    '/rest/v1/checkout_v2_items','/rest/v1/pos_service_receptions'].includes(url.pathname)){
    if(options.retirementAuditDenied)return send({message:'Fixture historical SELECT denied by RLS',code:'42501'},403);
    const reference=url.searchParams.get('product_id')||url.searchParams.get('service_product_id');
    if(options.retirementHasHistory&&reference==='eq.p1'&&
      ['/rest/v1/inventory_movements','/rest/v1/pos_sale_items'].includes(url.pathname))return send([{id:`history-${url.pathname.split('/').pop()}`}]);
    return send([]);
  }
  if(url.pathname.startsWith('/storage/v1/object/product-media/')){
    if(req.method==='POST'){
      if(!req.headers.authorization)return send({statusCode:'401',error:'Unauthorized',message:'Fixture Storage login required'},401);
      if(req.headers['x-upsert']==='true')return send({statusCode:'403',error:'Unauthorized',message:'Fixture Storage UPDATE denied'},403);
      if(options.storageInsertForbidden)return send({statusCode:'403',error:'Unauthorized',message:'Fixture Storage INSERT denied'},403);
      if(uploadedPaths.has(url.pathname))return send({statusCode:'409',error:'Duplicate',message:'The resource already exists'},409);
      uploadedPaths.add(url.pathname);
      if(options.storageLostResponse)return send({statusCode:'503',error:'ServiceUnavailable',message:'Fixture upload response lost'},503);
      return send({Key:url.pathname.slice('/storage/v1/object/'.length)});
    }
    return send([]);
  }
  if(url.pathname==='/rest/v1/product_variants'){
    if(req.method==='DELETE'){
      if(options.linkedVariant)return send({code:'23503',message:'Linked inventory movement'},409);
      const id=url.searchParams.get('id')?.slice(3);
      const found=variants.find(v=>v.id===id&&v.stock===0);
      if(found)variants=variants.filter(v=>v.id!==id);
      return send(found?[{id}]:[]);
    }

    const id=url.searchParams.get('product_id');
    if(id?.startsWith('in.')&&options.summaryDelay)await new Promise(r=>setTimeout(r,options.summaryDelay));
    if(id?.startsWith('in.')&&options.summaryError)return send({message:'Fixture variants failure'},503);
    return send(id?.startsWith('eq.')?variants.filter(v=>v.product_id===id.slice(3)):variants);
  }
  if(url.pathname==='/rest/v1/rpc/admin_quick_barcode_lookup'){
    const code=String(body.p_barcode||'').trim();
    const exactVariant=variants.filter(v=>v.barcode===code).map(v=>{
      const p=products.find(product=>product.id===v.product_id);
      return {product_id:p.id,product_name:p.name,variant_id:v.id,variant_title:v.title,sku:v.sku,barcode:v.barcode,stock:v.stock,price:p.price,status:p.status};
    });
    const parent=exactVariant.length?[]:products.filter(p=>p.barcode===code).map(p=>{
      const v=variants.find(variant=>variant.product_id===p.id);
      return {product_id:p.id,product_name:p.name,variant_id:v?.id||null,variant_title:v?.title||'Principal',sku:v?.sku||p.sku,barcode:v?.barcode||p.barcode,stock:v?.stock??p.stock,price:p.price,status:p.status};
    });
    return send({rows:[...exactVariant,...parent]});
  }
  if(url.pathname==='/rest/v1/rpc/admin_quick_product_create'){
    if(options.quickCreateError)return send({message:'Fixture quick create failure',code:'FIXTURE'},400);
    let product=products.find(p=>p.id===body.p_request_id);
    const replayed=Boolean(product);
    if(!product){
      const category=({c1:'Ropa',c2:'Palos',c3:'Calzado'})[body.p_category_id]||'Sin categoría';
      product={id:body.p_request_id,name:body.p_name,category_id:body.p_category_id,categories:{name:category},
        sku:({c1:'ROP-0003',c2:'PAL-0001',c3:'ZAP-0001'})[body.p_category_id]||'SIM-0001',barcode:body.p_barcode||'2000000000091',price:body.p_price,stock:0,
        sale_price:null,currency:'MXN',status:'draft',featured:false,new_arrival_enabled:true,
        brand:null,model:null,item_condition:'new',online_visible:true,pos_visible:true,
        specifications:{},product_images:[],created_at:new Date().toISOString()};
      products.unshift(product);
      const entries=Array.isArray(body.p_variants)?body.p_variants:[];
      if(!entries.length){
        product.stock=body.p_quantity;
        variants.push({id:`sim-${product.id}-default`,product_id:product.id,title:'Única',sku:product.sku,barcode:product.barcode,stock:product.stock,attributes:{},is_active:true});
      }else{
        for(const [i,entry] of entries.entries()){
          variants.push({id:`sim-${product.id}-${i+1}`,product_id:product.id,title:entry.title,
            sku:`${product.sku}-V${String(i+1).padStart(2,'0')}`,barcode:entry.barcode||`2000000000${String(i+10).padStart(3,'0')}`,
            stock:entry.quantity,attributes:entry.attributes||{},is_active:true});
        }
      }
      const images=Array.isArray(body.p_images)?body.p_images:[];
      for(const [i,imageUrl] of images.entries()){
        const image={id:`sim-img-${product.id}-${i+1}`,product_id:product.id,image_url:imageUrl,
          sort_order:i+1,is_primary:i===0};
        gallery.push(image);product.product_images.push(image);
      }
    }
    return send({product_id:product.id,name:product.name,sku:product.sku,barcode:product.barcode,status:'draft',replayed});
  }
  if(url.pathname==='/rest/v1/rpc/next_internal_barcode')return send(options.invalidBarcode?'invalid':'2000000000084');
  if(url.pathname==='/rest/v1/rpc/admin_inventory_save_variant'){
    const v=variants.find(v=>v.id===body.p_variant_id);
    if(v)Object.assign(v,{title:body.p_title,barcode:body.p_barcode,attributes:body.p_attributes});
    else variants.push({id:'v5',product_id:body.p_product_id,title:body.p_title,sku:'AUTO-SKU',barcode:body.p_barcode,attributes:body.p_attributes,stock:0,is_active:true});
    return send({variant_id:v?.id||'v5'});
  }
  // Catch accidental stock mutations even in fixtures.
  if(url.pathname==='/rest/v1/rpc/admin_inventory_adjust')return send({message:'Stock writes forbidden in catalog tests'},403);
  return send([]);
}).listen(4319,'127.0.0.1',()=>console.log('Fixture Supabase listening on 4319'));
