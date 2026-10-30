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
let products,variants,events,options;
function reset(){products=structuredClone(baseProducts);variants=structuredClone(baseVariants);events=[];options={};}reset();
const user={id:'00000000-0000-4000-8000-000000000001',aud:'authenticated',role:'authenticated',email:'admin@example.test',created_at:'2026-01-01T00:00:00Z',app_metadata:{},user_metadata:{}};
function token(){const enc=x=>Buffer.from(JSON.stringify(x)).toString('base64url');return `${enc({alg:'HS256',typ:'JWT'})}.${enc({sub:user.id,aud:'authenticated',role:'authenticated',exp:Math.floor(Date.now()/1000)+3600,iat:Math.floor(Date.now()/1000)})}.fixture-signature`;}
http.createServer(async(req,res)=>{
  res.setHeader('Access-Control-Allow-Origin','*');res.setHeader('Access-Control-Allow-Headers','*');res.setHeader('Access-Control-Allow-Methods','GET,POST,PATCH,DELETE,OPTIONS');
  if(req.method==='OPTIONS'){res.writeHead(204);return res.end();}
  const url=new URL(req.url,'http://127.0.0.1:4319');
  let raw='';for await(const c of req)raw+=c;const body=raw?JSON.parse(raw):{};
  const send=(value,status=200)=>{res.writeHead(status,{'Content-Type':'application/json'});res.end(JSON.stringify(value));};
  if(url.pathname==='/__reset'){reset();options=body;return send({ok:true});}
  if(url.pathname==='/__events')return send(events);
  if(url.pathname==='/__options'){Object.assign(options,body);return send({ok:true});}
  events.push({path:url.pathname,method:req.method,body,query:url.search,authorized:!!req.headers.authorization});
  if(url.pathname==='/auth/v1/token'){
    if(body.password!=='fixture-password')return send({message:'Invalid login credentials',error_code:'invalid_credentials'},400);
    return send({access_token:token(),token_type:'bearer',expires_in:3600,refresh_token:'fixture-refresh',user});
  }
  if(url.pathname==='/auth/v1/user')return send(user);
  if(url.pathname==='/auth/v1/logout')return send({});
  if(url.pathname==='/rest/v1/profiles')return send({id:user.id,role:'admin',is_active:true,full_name:'Fixture Admin'});
  if(url.pathname==='/rest/v1/categories')return send([{id:'c1',name:'Ropa',sort_order:1},{id:'c2',name:'Palos',sort_order:2}]);
  if(url.pathname==='/rest/v1/products'){
    if(options.productError)return send({message:'Fixture catalog failure',code:'FIXTURE'},400);
    if(options.productDelay)await new Promise(r=>setTimeout(r,options.productDelay));
    if(req.method==='PATCH'){const id=url.searchParams.get('id')?.slice(3);const p=products.find(p=>p.id===id);Object.assign(p,body);return send(p);}
    return send(products);
  }
  if(url.pathname==='/rest/v1/product_variants'){
    const id=url.searchParams.get('product_id');
    if(id?.startsWith('in.')&&options.summaryDelay)await new Promise(r=>setTimeout(r,options.summaryDelay));
    if(id?.startsWith('in.')&&options.summaryError)return send({message:'Fixture variants failure'},503);
    return send(id?.startsWith('eq.')?variants.filter(v=>v.product_id===id.slice(3)):variants);
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
