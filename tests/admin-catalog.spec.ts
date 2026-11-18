import { test, expect, type Page, type APIRequestContext } from '@playwright/test';
const fixture='http://127.0.0.1:4319';
const photoFixture={name:'foto-qa.png',mimeType:'image/png',buffer:Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVQIHWP4z8DwHwAFgAI/ScL/nwAAAABJRU5ErkJggg==','base64')};
async function configure(request:APIRequestContext,options:Record<string,unknown>){await request.post(`${fixture}/__options`,{data:options});}
async function login(page:Page){
  await page.goto('/admin');
  await expect(page).toHaveURL(/\/login\?next=/);
  await page.locator('[name=email]').fill('admin@example.test');
  await page.locator('[name=password]').fill('fixture-password');
  await page.getByRole('button',{name:'Entrar',exact:true}).click();
  await expect(page).toHaveURL(/\/admin$/);
}
async function ready(page:Page){
  await expect(page.locator('#udList .u-item')).toHaveCount(3);
  await expect(page.locator('#udCatalogSearch')).toBeVisible();
  await expect(page.locator('#udList .ud-category-group')).toHaveCount(2);
}
const card=(page:Page,id:string)=>page.locator(`#udList .u-item[data-product-id="${id}"]`);


test('Premium White admin shell mounts original buttons in an expandable sidebar',async({page})=>{
  await login(page);await ready(page);
  const root=page.locator('#updown-admin');
  await expect(root).toHaveClass(/ud-premium-white/);
  await expect(page.locator('.ud-admin-legacy')).toHaveAttribute('data-admin-ready','true');
  const nav=root.locator('.u-admin-nav');
  await expect(nav).toHaveAttribute('data-premium-sidebar','ready');
  for(const id of ['udProductsTab','udOrdersTab','udv2PosTab']){
    await expect(page.locator('#'+id)).toHaveCount(1);
  }
  const products=nav.locator('[data-sidebar-section=products]');
  const sales=nav.locator('[data-sidebar-section=sales]');
  await expect(products).toHaveAttribute('open','');
  await sales.locator('summary').click();
  await expect(sales).toHaveAttribute('open','');
  await expect(products).not.toHaveAttribute('open','');
  await expect(sales.locator('a[href="/pos/recepciones"]')).toBeVisible();
  await expect(sales.locator('a[href="/admin/pos/promociones"]')).toBeVisible();
});

test.beforeEach(async({request,page})=>{
  await request.post(`${fixture}/__reset`,{data:{}});
  // All data traffic remains local. External fonts/images are irrelevant to these tests.
  await page.route('https://**/*',route=>route.abort());
});

test('SSR login shares the browser session; catalog survives reload without a second login',async({page,request})=>{
  const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));
  await login(page);await ready(page);
  await expect(page.locator('#udLoginScreen')).toBeHidden();
  const cookies=await page.context().cookies();expect(cookies.some(c=>c.name.startsWith('sb-'))).toBe(true);
  await page.reload();await ready(page);await expect(page).toHaveURL(/\/admin$/);
  const events=await (await request.get(`${fixture}/__events`)).json();
  expect(events.filter((e:{path:string})=>e.path==='/auth/v1/token')).toHaveLength(1);
  expect(events.filter((e:{path:string})=>e.path==='/rest/v1/products').every((e:{authorized:boolean})=>e.authorized)).toBe(true);
  expect(errors).toEqual([]);
});

test('invalid credentials produce a visible error',async({page})=>{
  await page.goto('/login');await page.locator('[name=email]').fill('admin@example.test');await page.locator('[name=password]').fill('wrong');
  await page.getByRole('button',{name:'Entrar',exact:true}).click();
  await expect(page.locator('form [role=alert]')).toContainText('Invalid login credentials');await expect(page).toHaveURL(/\/login$/);
});

test('name, SKU, barcode, brand, model, variant search and category filters',async({page})=>{
  await login(page);await ready(page);
  const search=page.locator('#udCatalogSearch');
  for(const q of ['Polo clásico azul','ROP-0010','2000000000022','Otra marca','Tour B','2000000000060']){
    await search.fill(q);await expect(card(page,'p2')).toBeVisible();await expect(page.locator('#udList .u-item:visible')).toHaveCount(1);
  }
  await search.fill('2000000000046');await expect(card(page,'p1')).toBeVisible();await expect(card(page,'p2')).toBeHidden();
  await page.locator('#udCatalogSearchClear').click();await page.locator('#udCatalogCategory').selectOption('palos');
  await expect(card(page,'p3')).toBeVisible();await expect(page.locator('#udList .u-item:visible')).toHaveCount(1);
  await search.fill('missing');await expect(page.locator('#udCatalogEmpty')).toBeVisible();
  await page.locator('#udCatalogSearchClear').click();await page.locator('#udCatalogCategory').selectOption('all');
  await expect(page.locator('#udList .u-item:visible')).toHaveCount(3);
});

test('delayed summary does not replace an open variant editor',async({page,request})=>{
  await configure(request,{summaryDelay:2500});await login(page);await ready(page);
  await card(page,'p1').locator('.ud-variants').click();
  const title=card(page,'p1').locator('input[name=title]').first();await expect(title).toHaveValue('XS rojo');await title.fill('Unsaved edit');
  await expect(card(page,'p1').locator('.ud-variant-summary')).toContainText('2 variantes',{timeout:5000});
  await expect(title).toHaveValue('Unsaved edit');
});

test('product edit preserves barcode, price, channel and stock in its save payload',async({page,request})=>{
  await login(page);await ready(page);await card(page,'p1').locator('.ud-edit').click();
  await expect(page.locator('#udBarcode')).toHaveValue('2000000000015');await expect(page.locator('#udOnlineVisible')).toHaveValue('physical');
  await page.locator('#udName').fill('Polo revisado');await page.locator('#udSave').click();
  await expect(page.locator('#udToast')).toContainText('Producto actualizado');
  const events=await (await request.get(`${fixture}/__events`)).json();
  const save=events.find((e:{method:string,path:string})=>e.method==='PATCH'&&e.path==='/rest/v1/products');
  expect(save.body).toMatchObject({name:'Polo revisado',barcode:'2000000000015',price:350,online_visible:false,pos_visible:true,stock:5});
  expect(save.body).not.toHaveProperty('slug');
  expect(events.some((e:{path:string})=>e.path.endsWith('admin_inventory_adjust'))).toBe(false);
});

test('existing variant edits preserve barcode; new variants receive automatic EAN-13',async({page,request})=>{
  await login(page);await ready(page);await card(page,'p1').locator('.ud-variants').click();
  const form=card(page,'p1').locator('form').first();
  await expect(form.locator('[name=barcode]')).toHaveValue('2000000000046');await form.locator('[name=title]').fill('XS editado');
  await form.getByRole('button',{name:'Guardar variante'}).click();await expect(form).toContainText('Variante actualizada');
  await card(page,'p1').getByRole('button',{name:'Agregar variante'}).click();
  const newForm=card(page,'p1').locator('form').first();
  await expect(newForm.locator('[name=barcode]')).toHaveValue('2000000000084');await expect(newForm.locator('[name=barcode]')).toHaveAttribute('readonly','');
  await newForm.locator('[name=title]').fill('Nueva XS');await newForm.locator('[name=talla]').selectOption('XS');
  await newForm.getByRole('button',{name:'Crear variante'}).click();await expect(card(page,'p1')).toContainText('3 variante(s)');
  const events=await (await request.get(`${fixture}/__events`)).json();
  const saves=events.filter((e:{path:string})=>e.path.endsWith('admin_inventory_save_variant'));
  expect(saves).toHaveLength(2);expect(saves[0].body.p_barcode).toBe('2000000000046');expect(saves[1].body.p_barcode).toBe('2000000000084');
  expect(events.some((e:{path:string})=>e.path.endsWith('admin_inventory_adjust'))).toBe(false);
});

test('query errors remain visible and retry recovers the catalog',async({page,request})=>{
  await configure(request,{productError:true});await login(page);
  await expect(page.locator('#udList [role=alert]')).toContainText('Fixture catalog failure');
  await expect(page.locator('#udList .ud-category-group')).toHaveCount(0);
  await configure(request,{productError:false});await page.locator('#udRetryProducts').click();await ready(page);
});

test('variant summary failure leaves parent search usable and offers retry',async({page,request})=>{
  await login(page);await ready(page);
  // Trigger the optional summary request *after* the catalog is ready, so a
  // competing bootstrap refresh cannot make this error-injection test racy.
  await configure(request,{summaryError:true});
  await page.evaluate(()=>window.dispatchEvent(new Event('updown:admin-products-refresh')));
  await ready(page);
  await expect(page.getByRole('button',{name:'Reintentar variantes'})).toBeVisible();
  await page.locator('#udCatalogSearch').fill('Marca aguila');await expect(card(page,'p1')).toBeVisible();
  await configure(request,{summaryError:false});await page.getByRole('button',{name:'Reintentar variantes'}).click();
  await page.locator('#udCatalogSearch').fill('2000000000046');await expect(card(page,'p1')).toBeVisible();
});

test('script parse failure is surfaced by the loader instead of an eternal spinner',async({page})=>{
  await page.route('**/updown-admin-legacy-runtime.js?*',route=>route.fulfill({contentType:'application/javascript',body:'const broken = ;'}));
  await login(page);await expect(page.locator('.ud-admin-splash[role=alert]')).toContainText('No se pudo iniciar');
  await expect(page.getByRole('button',{name:'Reintentar',exact:true})).toBeVisible();
});

test('mobile catalog can filter and open the product editor',async({page})=>{
  await page.setViewportSize({width:390,height:844});await login(page);await ready(page);
  await page.locator('#udCatalogSearch').fill('Driver');await card(page,'p3').locator('.ud-edit').click();
  await expect(page.locator('#udName')).toHaveValue('Driver');await expect(page.locator('#udOnlineVisible')).toHaveValue('online');
});

test('A3 capture lives inside Productos, mounts lazily and preserves unsaved inputs across tabs',async({page,request})=>{
  await login(page);await ready(page);
  const host=page.locator('#udUnifiedProductHost');
  await expect(host).toBeHidden();
  await expect(page.locator('#quick-barcode')).toHaveCount(0);
  await page.getByRole('button',{name:'Nueva ficha',exact:true}).click();
  await expect(page.getByRole('heading',{name:'Nueva ficha de producto'})).toBeVisible();
  await expect(page.locator('#quick-barcode')).toBeVisible();
  await expect(page.getByRole('button',{name:'▣ Escanear con cámara'})).toBeVisible();
  await expect(host.locator('input[type=file][capture=environment]').first()).toHaveAttribute('accept',/heic/);
  await host.locator('input[placeholder="Ej. Polo Nike Dri-FIT"]').fill('Borrador local sin guardar');
  await page.getByRole('button',{name:'Catálogo',exact:true}).click();
  await expect(host).toBeHidden();
  await page.getByRole('button',{name:'Nueva ficha',exact:true}).click();
  await expect(host.locator('input[placeholder="Ej. Polo Nike Dri-FIT"]')).toHaveValue('Borrador local sin guardar');
  const events=await (await request.get(`${fixture}/__events`)).json();
  expect(events.filter((e:{method:string,path:string})=>['POST','PUT','PATCH','DELETE'].includes(e.method)&&
    (/\/rest\/v1\/(products|product_variants|inventory_movements)/.test(e.path)||
      /\/rpc\/admin_quick_/.test(e.path)||/\/storage\/v1\/object\//.test(e.path)))).toHaveLength(0);
});

test('A3 catalog edit still uses original full editor',async({page})=>{
  await login(page);await ready(page);
  await page.getByRole('button',{name:'Nueva ficha',exact:true}).click();
  await page.getByRole('button',{name:'Catálogo',exact:true}).click();
  await card(page,'p1').locator('.ud-edit').click();
  await expect(page.locator('#udName')).toHaveValue('Polo clásico');
  await expect(page.locator('#udProductWorkspaceTabs button[data-view="form"]')).toHaveClass(/is-active/);
  await expect(page.locator('#udUnifiedProductHost')).toBeHidden();
});

test('A3.3 creates one complete product ficha with one explicit save action',async({page,request})=>{
  await login(page);await ready(page);
  await page.getByRole('button',{name:'Nueva ficha',exact:true}).click();
  const host=page.locator('#udUnifiedProductHost');
  await host.getByLabel('Nombre del producto').fill('Driver de prueba A3');
  await host.getByRole('combobox',{name:'Categoría',exact:true}).selectOption('c2');
  await host.locator('input[placeholder="0.00"]').fill('499');
  await host.locator('#quick-barcode').fill('2001234000001');
  await host.getByLabel('Marca',{exact:true}).fill('Marca simulada');
  await host.getByLabel('Modelo',{exact:true}).fill('Modelo QA');
  await host.getByRole('combobox',{name:'Condición',exact:true}).selectOption('demo');
  await host.getByLabel('Descripción corta · Español').fill('Texto local sin persistir');
  await host.locator('details details summary').click();
  await host.getByLabel('Loft',{exact:true}).fill('10.5°');
  await host.getByRole('combobox',{name:'Mano',exact:true}).selectOption('Right');
  await host.getByLabel('Tiene variantes (talla, color u otras)').check();
  await host.getByLabel('Nombre de variante',{exact:true}).fill('RH / 10.5');
  await host.getByLabel('Cantidad inicial',{exact:true}).fill('0');
  await page.getByRole('button',{name:'Catálogo',exact:true}).click();
  await page.getByRole('button',{name:'Nueva ficha',exact:true}).click();
  await expect(host.getByLabel('Marca',{exact:true})).toHaveValue('Marca simulada');
  const before=await (await request.get(`${fixture}/__events`)).json();
  expect(before.filter((e:{method:string,path:string})=>e.method==='PATCH'&&e.path==='/rest/v1/products')).toHaveLength(0);
  await host.getByRole('button',{name:'Guardar ficha completa'}).click();
  await expect(host.getByText(/Ficha completa guardada como borrador/)).toBeVisible();
  const saved=await (await request.get(`${fixture}/__events`)).json();
  const create=saved.find((e:{path:string})=>e.path.endsWith('/admin_quick_product_create'));
  expect(create.body).toMatchObject({p_name:'Driver de prueba A3',p_category_id:'c2',p_price:499,p_barcode:'2001234000001',p_quantity:0});
  expect(create.body.p_variants).toMatchObject([{title:'RH / 10.5',quantity:0}]);
  expect(create.body).not.toHaveProperty('brand');
  const patches=saved.filter((e:{method:string,path:string})=>e.method==='PATCH'&&e.path==='/rest/v1/products');
  expect(patches).toHaveLength(1);
  expect(patches[0].body).toMatchObject({
    currency:'MXN',online_visible:true,pos_visible:true,
    brand:'Marca simulada',model:'Modelo QA',item_condition:'demo',
    short_description:'Texto local sin persistir',specifications:{hand:'Right',loft:'10.5°'}
  });
  for(const forbidden of ['name','sku','barcode','price','stock','status'])expect(patches[0].body).not.toHaveProperty(forbidden);
  expect(saved.some((e:{path:string})=>/admin_inventory_adjust|admin_inventory_receive/.test(e.path))).toBe(false);
});

test('A3.3 adds photos to a scanned UPC gallery without replacing historical images or stock',async({page,request})=>{
  await configure(request,{existingPhoto:true,galleryError:true});
  await login(page);await ready(page);
  await page.getByRole('button',{name:'Nueva ficha',exact:true}).click();
  const host=page.locator('#udUnifiedProductHost');
  await host.locator('#quick-barcode').fill('2000000000015');
  await host.getByRole('button',{name:'Buscar',exact:true}).click();
  const photos=host.getByRole('region',{name:'Fotografías por UPC'});
  await expect(photos).toBeVisible();
  await photos.locator('input[type=file][capture=environment]').setInputFiles(photoFixture);
  await expect(photos.locator('img[alt="Nueva foto 1"]')).toBeVisible();
  await photos.getByRole('button',{name:'Guardar 1 fotografía(s) en este UPC'}).click();
  await expect(host.getByRole('alert')).toContainText('Fixture image insert failure');
  await configure(request,{galleryError:false});
  await photos.getByRole('button',{name:'Reintentar fotos'}).click();
  await expect(host.getByText(/fotografía\(s\) asociadas a Polo clásico/)).toBeVisible();
  const images=await (await request.get(`${fixture}/rest/v1/product_images?product_id=eq.p1`)).json();
  expect(images).toHaveLength(2);
  expect(images[0]).toMatchObject({id:'img-old',is_primary:true});
  expect(images[1]).toMatchObject({product_id:'p1',is_primary:false,sort_order:2});
  const events=await (await request.get(`${fixture}/__events`)).json();
  expect(events.filter((e:{path:string})=>e.path.startsWith('/storage/v1/object/product-media/'))).toHaveLength(1);
  expect(events.filter((e:{method:string,path:string})=>e.method==='PATCH'&&e.path==='/rest/v1/products')).toHaveLength(0);
  expect(events.some((e:{path:string})=>/admin_inventory_adjust|admin_quick_inventory_receive/.test(e.path))).toBe(false);
});

test('A3.3 one-save retry reuses the same product ID when advanced metadata fails',async({page,request})=>{
  await configure(request,{metadataError:true});
  await login(page);await ready(page);
  await page.getByRole('button',{name:'Nueva ficha',exact:true}).click();
  const host=page.locator('#udUnifiedProductHost');
  await host.getByLabel('Nombre del producto').fill('Polo simulado con reintento');
  await host.getByRole('combobox',{name:'Categoría',exact:true}).selectOption('c1');
  await host.locator('input[placeholder="0.00"]').fill('350');
  await host.locator('#quick-barcode').fill('2001234000123');
  await host.getByLabel('Marca',{exact:true}).fill('Reintento QA');
  await host.getByRole('button',{name:'Guardar ficha completa'}).click();
  await expect(host.getByRole('alert')).toContainText('Fixture metadata save failure');
  await configure(request,{metadataError:false});
  await host.getByRole('button',{name:'Reintentar guardado'}).click();
  await expect(host.getByText(/Ficha completa guardada como borrador/)).toBeVisible();
  const events=await (await request.get(`${fixture}/__events`)).json();
  const creates=events.filter((e:{path:string})=>e.path.endsWith('/admin_quick_product_create'));
  expect(creates).toHaveLength(2);
  expect(creates[0].body.p_request_id).toBe(creates[1].body.p_request_id);
  const catalog=await (await request.get(`${fixture}/rest/v1/products`)).json();
  expect(catalog.filter((p:{name:string})=>p.name==='Polo simulado con reintento')).toHaveLength(1);
  expect(events.filter((e:{method:string,path:string})=>e.method==='PATCH'&&e.path==='/rest/v1/products').at(-1).body).not.toHaveProperty('stock');
});

test('A3.3 full galleries can reject new photos without locking the local selection',async({page,request})=>{
  await configure(request,{fullGallery:true});
  await login(page);await ready(page);
  await page.getByRole('button',{name:'Nueva ficha',exact:true}).click();
  const host=page.locator('#udUnifiedProductHost');
  await host.locator('#quick-barcode').fill('2000000000015');
  await host.getByRole('button',{name:'Buscar',exact:true}).click();
  const photos=host.getByRole('region',{name:'Fotografías por UPC'});
  await photos.locator('input[type=file][capture=environment]').setInputFiles(photoFixture);
  await photos.getByRole('button',{name:'Guardar 1 fotografía(s) en este UPC'}).click();
  await expect(host.getByRole('alert')).toContainText('La galería admite diez fotografías');
  await expect(photos.getByRole('button',{name:'Quitar nueva foto 1'})).toBeEnabled();
  await photos.getByRole('button',{name:'Quitar nueva foto 1'}).click();
  await expect(photos.locator('img[alt="Nueva foto 1"]')).toHaveCount(0);
  const events=await (await request.get(`${fixture}/__events`)).json();
  expect(events.filter((e:{path:string})=>e.path.startsWith('/storage/v1/object/product-media/'))).toHaveLength(0);
});

test('A3.2 opening a scanned existing product is read-only until the original editor saves',async({page,request})=>{
  await login(page);await ready(page);
  await page.getByRole('button',{name:'Nueva ficha',exact:true}).click();
  const host=page.locator('#udUnifiedProductHost');
  await host.getByLabel('Código de barras',{exact:true}).fill('2000000000015');
  await host.getByRole('button',{name:'Buscar',exact:true}).click();
  await expect(host.getByText('Polo clásico',{exact:true})).toBeVisible();
  await host.getByRole('button',{name:'Abrir ficha completa de este producto'}).click();
  await expect(page.locator('#udName')).toHaveValue('Polo clásico');
  await expect(page.locator('#udBarcode')).toHaveValue('2000000000015');
  await expect(page.locator('#udPrice')).toHaveValue('350');
  await expect(page.locator('#udStock')).toHaveValue('5');
  const events=await (await request.get(`${fixture}/__events`)).json();
  expect(events.filter((e:{method:string,path:string})=>
    ['POST','PUT','PATCH','DELETE'].includes(e.method)&&
    (/\/rest\/v1\/(products|product_variants|inventory_movements)/.test(e.path)||
      /\/rpc\/admin_quick_product_create/.test(e.path)))).toHaveLength(0);
});


test('variant deletion confirms, preserves cancellation and removes only empty unlinked variant',async({page,request})=>{
  await configure(request,{zeroStock:true});await login(page);await ready(page);
  await card(page,'p1').locator('.ud-variants').click();
  page.once('dialog',d=>d.dismiss());
  await card(page,'p1').locator('.ud-delete-variant').first().click();
  await expect(card(page,'p1').locator('form')).toHaveCount(2);
  page.once('dialog',d=>d.accept());
  await card(page,'p1').locator('.ud-delete-variant').first().click();
  await expect(page.locator('#udToast')).toContainText('Variante eliminada');
  await card(page,'p1').locator('.ud-variants').click();
  await expect(card(page,'p1').locator('form')).toHaveCount(1);
});

test('stock and linked history prevent variant deletion',async({page,request})=>{
  await login(page);await ready(page);await card(page,'p1').locator('.ud-variants').click();
  await card(page,'p1').locator('.ud-delete-variant').first().click();
  await expect(card(page,'p1')).toContainText('tiene existencias');
  await configure(request,{zeroStock:true,linkedVariant:true});
  await card(page,'p1').locator('.ud-variants').click();await card(page,'p1').locator('.ud-variants').click();
  page.once('dialog',d=>d.accept());await card(page,'p1').locator('.ud-delete-variant').first().click();
  await expect(card(page,'p1')).toContainText('movimientos de inventario vinculados');
  await expect(card(page,'p1').locator('form')).toHaveCount(2);
});


for (const scenario of [{category:'c1',size:'XS',other:'XXL'},{category:'c3',size:'25.5',other:'27'}]) {
  test(`unified entry adds only requested variants: ${scenario.category}`,async({page})=>{
    await login(page);await page.goto('/admin/productos/alta-rapida');
    await expect(page).toHaveURL(/\/admin\?producto=nuevo$/);
    const host=page.locator('#udUnifiedProductHost');
    await expect(host.getByRole('heading',{name:'Nueva ficha de producto'})).toBeVisible();
    await host.getByRole('combobox',{name:'Categoría',exact:true}).selectOption(scenario.category);
    const names=host.getByLabel('Nombre de variante',{exact:true});
    await expect(names).toHaveCount(0);
    await host.getByRole('button',{name:'＋ Agregar variante',exact:true}).click();
    await expect(names).toHaveCount(1);
    await host.getByRole('combobox',{name:'Talla',exact:true}).selectOption(scenario.size);
    await expect(names.first()).toHaveValue(scenario.size);
    await host.getByRole('button',{name:'＋ Agregar variante',exact:true}).click();
    await expect(names).toHaveCount(2);
    await host.getByRole('combobox',{name:'Talla',exact:true}).nth(1).selectOption(scenario.other);
    await expect(names.first()).toHaveValue(scenario.size);
    await expect(names.nth(1)).toHaveValue(scenario.other);
    await host.getByRole('button',{name:'Quitar variante 2',exact:true}).click();
    await expect(names).toHaveCount(1);
    await host.getByLabel('Tiene variantes (talla, color u otras)').uncheck();
    await host.getByRole('button',{name:'＋ Agregar variante',exact:true}).click();
    await expect(names).toHaveCount(1);await expect(names.first()).toHaveValue(scenario.size);
  });
}

test('A3.5 persists two requested variants and both parent and variant photos in one save',async({page,request})=>{
  await login(page);await ready(page);
  await page.getByRole('button',{name:'Nueva ficha',exact:true}).click();
  const host=page.locator('#udUnifiedProductHost');
  await host.getByLabel('Nombre del producto').fill('Polo doble variante QA');
  await host.getByRole('combobox',{name:'Categoría',exact:true}).selectOption('c1');
  await host.locator('input[placeholder="0.00"]').fill('499');
  await host.locator('#quick-barcode').fill('2005550000001');
  await host.locator('input[type=file][multiple]').first().setInputFiles(photoFixture);
  await expect(host.locator('img[alt*="Foto 1 de Polo doble"]')).toBeVisible();
  await host.getByLabel('Tiene variantes (talla, color u otras)').check();
  await host.getByLabel('Nombre de variante',{exact:true}).fill('Polo XS');
  await host.getByRole('combobox',{name:'Talla',exact:true}).selectOption('XS');
  await host.locator('input[placeholder="Vacío = generar automáticamente"]').first().fill('2005550000002');
  await host.locator('[class*="variantPhoto"] input[type=file][capture=environment]').first().setInputFiles(photoFixture);
  await expect(host.locator('img[alt^="Foto de la variante"]')).toHaveCount(1);
  await host.getByRole('button',{name:'＋ Agregar variante',exact:true}).click();
  await host.getByLabel('Nombre de variante',{exact:true}).nth(1).fill('Polo XXL');
  await host.getByRole('combobox',{name:'Talla',exact:true}).nth(1).selectOption('XXL');
  await host.locator('input[placeholder="Vacío = generar automáticamente"]').nth(1).fill('2005550000003');
  await host.getByRole('button',{name:'Guardar ficha completa'}).click();
  await expect(host.getByText(/Ficha completa guardada como borrador/)).toBeVisible();
  const events=await (await request.get(`${fixture}/__events`)).json();
  const create=events.find((e:{path:string})=>e.path.endsWith('admin_quick_product_create'));
  expect(create.body.p_variants).toHaveLength(2);
  expect(create.body.p_images).toHaveLength(1);
  expect(create.body.p_variants[0].attributes.image_url).toMatch(/^http/);
  const saved=await (await request.get(`${fixture}/rest/v1/product_variants?product_id=eq.${create.body.p_request_id}`)).json();
  expect(saved).toHaveLength(2);
  expect(saved.map((v:{sku:string})=>v.sku)).toEqual(['ROP-0003-V01','ROP-0003-V02']);
  expect(saved[0].attributes).toMatchObject({talla:'XS',image_url:create.body.p_variants[0].attributes.image_url});
  expect(saved[1].attributes).toMatchObject({talla:'XXL'});
  expect(events.filter((e:{path:string})=>e.path.startsWith('/storage/v1/object/product-media/'))).toHaveLength(2);
});

test('A3.5 rejects duplicate UPC inside one ficha before any upload or product write',async({page,request})=>{
  await login(page);await ready(page);
  await page.getByRole('button',{name:'Nueva ficha',exact:true}).click();
  const host=page.locator('#udUnifiedProductHost');
  await host.getByLabel('Nombre del producto').fill('Prueba UPC duplicado');
  await host.getByRole('combobox',{name:'Categoría',exact:true}).selectOption('c1');
  await host.locator('input[placeholder="0.00"]').fill('199');
  await host.locator('#quick-barcode').fill('2005550000010');
  await host.getByLabel('Tiene variantes (talla, color u otras)').check();
  await host.getByLabel('Nombre de variante',{exact:true}).fill('XS duplicado');
  await host.locator('input[placeholder="Vacío = generar automáticamente"]').fill('2005550000010');
  await host.getByRole('button',{name:'Guardar ficha completa'}).click();
  await expect(host.getByRole('alert')).toContainText('Cada código de barras de esta ficha debe ser diferente');
  const events=await (await request.get(`${fixture}/__events`)).json();
  expect(events.some((e:{path:string})=>e.path.endsWith('/admin_quick_product_create')||e.path.startsWith('/storage/v1/object/product-media/'))).toBe(false);
});

test('A3.5 photo retry recovers an already-uploaded UUID without overwriting Storage',async({page,request})=>{
  await configure(request,{storageLostResponse:true});
  await login(page);await ready(page);
  await page.getByRole('button',{name:'Nueva ficha',exact:true}).click();
  const host=page.locator('#udUnifiedProductHost');
  await host.getByLabel('Nombre del producto').fill('Imagen con red interrumpida');
  await host.getByRole('combobox',{name:'Categoría',exact:true}).selectOption('c1');
  await host.locator('input[placeholder="0.00"]').fill('100');
  await host.locator('input[type=file][multiple]').first().setInputFiles(photoFixture);
  await expect(host.locator('img[alt^="Foto 1 de"]')).toHaveCount(1);
  await host.getByRole('button',{name:'Guardar ficha completa'}).click();
  await expect(host.getByRole('alert')).toContainText('Fixture upload response lost');
  await configure(request,{storageLostResponse:false});
  await host.getByRole('button',{name:'Reintentar guardado'}).click();
  await expect(host.getByText(/Ficha completa guardada como borrador/)).toBeVisible();
  const events=await (await request.get(`${fixture}/__events`)).json();
  const uploads=events.filter((e:{path:string})=>e.path.startsWith('/storage/v1/object/product-media/'));
  expect(uploads).toHaveLength(2);
  expect(uploads[0].path).toBe(uploads[1].path);
  expect(events.filter((e:{path:string})=>e.path.endsWith('admin_quick_product_create'))).toHaveLength(1);
});
