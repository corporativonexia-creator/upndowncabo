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

async function captureThermalLabel(page:Page,sku:string){
  await page.evaluate(()=>{
    const testWindow=window as Window & {__qaLabelHtml?:string;__qaLabelOpens?:number};
    testWindow.__qaLabelHtml='';testWindow.__qaLabelOpens=0;
    Object.defineProperty(window,'open',{configurable:true,value:()=>{
      testWindow.__qaLabelOpens=(testWindow.__qaLabelOpens||0)+1;
      return {document:{write:(html:string)=>{testWindow.__qaLabelHtml+=html;},close:()=>{}}};
    }});
  });
  page.once('dialog',dialog=>dialog.accept('1'));
  await page.locator('.inv-tablebox tbody tr').filter({hasText:sku}).getByRole('button',{name:'Imprimir'}).click();
  await expect.poll(()=>page.evaluate(()=>(window as Window & {__qaLabelHtml?:string}).__qaLabelHtml||'')).toContain('class="label"');
  return page.evaluate(()=>({html:(window as Window & {__qaLabelHtml?:string}).__qaLabelHtml||'',opens:(window as Window & {__qaLabelOpens?:number}).__qaLabelOpens||0}));
}

async function captureInventoryReport(page:Page,buttonName:RegExp){
  await page.evaluate(()=>{
    const testWindow=window as Window & {__qaReportHtml?:string;__qaReportOpens?:number};
    testWindow.__qaReportHtml='';testWindow.__qaReportOpens=0;
    Object.defineProperty(window,'open',{configurable:true,value:()=>{
      testWindow.__qaReportOpens=(testWindow.__qaReportOpens||0)+1;
      return {document:{write:(html:string)=>{testWindow.__qaReportHtml+=html;},close:()=>{}},addEventListener:()=>{},print:()=>{}};
    }});
  });
  await page.getByRole('button',{name:buttonName}).click();
  return page.evaluate(()=>({html:(window as Window & {__qaReportHtml?:string}).__qaReportHtml||'',opens:(window as Window & {__qaReportOpens?:number}).__qaReportOpens||0}));
}

test('A6.4 reconciliation is lazy and explains hidden POS variants without writing stock',async({page,request})=>{
  await login(page);await page.goto('/admin/inventario');
  await expect(page.locator('.inv-tablebox tbody tr')).toHaveCount(4);
  const before=await (await request.get(`${fixture}/__events`)).json();
  expect(before.filter((e:{path:string,query:string})=>e.path==='/rest/v1/product_variants'&&e.query.includes('is_active'))).toHaveLength(0);
  const region=page.getByRole('region',{name:'Conciliación de inventario y POS'});
  await region.getByRole('button',{name:'Conciliar con POS'}).click();
  await expect(region.locator('.inv-reconcile-stats')).toContainText('Variantes en inventario');
  await expect(region.locator('.inv-reconcile-stats')).toContainText('Artículos POS proyectados');
  await expect(region.locator('.inv-reconcile-stats').locator('b')).toHaveText(['4','3','3','2','3']);
  await region.getByText('Solo en inventario (1)').click();
  await expect(region).toContainText('Producto oculto en POS');
  await expect(region).toContainText('Driver');
  const events=await (await request.get(`${fixture}/__events`)).json();
  expect(events.filter((e:{path:string,query:string})=>e.path==='/rest/v1/product_variants'&&e.query.includes('is_active'))).toHaveLength(1);
  expect(events.filter((e:{method:string,path:string})=>['PATCH','PUT','DELETE'].includes(e.method)||e.path==='/rest/v1/rpc/admin_inventory_adjust')).toHaveLength(0);
});

test('A6.4 reconciliation identifies inactive variants, standalone POS services and stock differences',async({page,request})=>{
  await login(page);await configure(request,{reconciliationFixture:true,reconciliationStockSkew:true});
  await page.goto('/admin/inventario');
  await expect(page.locator('.inv-tablebox tbody tr')).toHaveCount(4);
  const region=page.getByRole('region',{name:'Conciliación de inventario y POS'});
  await region.getByRole('button',{name:'Conciliar con POS'}).click();
  await expect(region.locator('.inv-reconcile-stats').locator('b')).toHaveText(['4','3','3','3','2']);
  await region.getByText('Solo en inventario (2)').click();
  await expect(region).toContainText('Variante inactiva para POS');
  await expect(region).toContainText('Producto oculto en POS');
  await region.getByText('Solo en proyección POS (1)').click();
  await expect(region).toContainText('Servicio de ajuste');
  await region.getByText('Existencias diferentes (1)').click();
  await expect(region).toContainText('Inventario 7 · POS 5');
});

test('A6.4 restricted reconciliation reports an error instead of treating hidden rows as absent',async({page,request})=>{
  await login(page);await configure(request,{reconciliationDenied:true});
  await page.goto('/admin/inventario');
  await expect(page.locator('.inv-tablebox tbody tr')).toHaveCount(4);
  const region=page.getByRole('region',{name:'Conciliación de inventario y POS'});
  await region.getByRole('button',{name:'Conciliar con POS'}).click();
  await expect(region.getByRole('alert')).toContainText('Lectura de conciliación restringida por RLS');
  await expect(region.locator('.inv-reconcile-stats')).toHaveCount(0);
});

test('A6.3 factory UPC-A prints 12 original digits with GS1-equivalent bars and no identifier writes',async({page,request})=>{
  await login(page);await configure(request,{factoryUpcFixture:true});
  await page.goto('/admin/inventario');
  await expect(page.locator('.inv-tablebox tbody tr').filter({hasText:'ROP-001-XS'})).toContainText('036000291452');
  const label=await captureThermalLabel(page,'ROP-001-XS');
  expect(label.opens).toBe(1);
  expect(label.html).toContain('>36000</text>');
  expect(label.html).toContain('>29145</text>');
  expect(label.html).not.toContain('>0036000291452</text>');
  expect(label.html).toContain('@page{size:50mm 30mm;margin:0}');
  const events=await (await request.get(`${fixture}/__events`)).json();
  expect(events.filter((e:{method:string,path:string})=>['PATCH','PUT','DELETE'].includes(e.method)||e.path==='/rest/v1/rpc/admin_inventory_adjust')).toHaveLength(0);
});

test('A6.3 invalid UPC-A checksum blocks printing before any price query',async({page,request})=>{
  await login(page);await configure(request,{badUpcFixture:true});
  await page.goto('/admin/inventario');
  await expect(page.locator('.inv-tablebox tbody tr').filter({hasText:'ROP-001-XS'})).toContainText('036000291453');
  let warning='';
  page.once('dialog',async dialog=>{warning=dialog.message();await dialog.accept();});
  await page.locator('.inv-tablebox tbody tr').filter({hasText:'ROP-001-XS'}).getByRole('button',{name:'Imprimir'}).click();
  expect(warning).toContain('verificador válido');
  const events=await (await request.get(`${fixture}/__events`)).json();
  expect(events.filter((e:{path:string,query:string})=>['/rest/v1/products','/rest/v1/product_variants'].includes(e.path)&&e.query.includes('id=eq.'))).toHaveLength(0);
});

test('A6.3 ticket 80 mm and sheet A4 keep category totals separate by MXN and USD',async({page,request})=>{
  await login(page);await configure(request,{labelFixture:true});
  await page.goto('/admin/inventario');
  await expect(page.locator('.inv-tablebox tbody tr')).toHaveCount(4);
  const ticket=await captureInventoryReport(page,/Ticket 80 mm/);
  expect(ticket.opens).toBe(1);
  expect(ticket.html).toContain('SUBTOTAL ROPA');
  expect(ticket.html).toContain('SUBTOTAL PALOS');
  expect(ticket.html).toContain('4,050.00');
  expect(ticket.html).toContain('TOTAL USD');
  expect(ticket.html).toContain('3,500.00');
  const sheet=await captureInventoryReport(page,/Hoja \/ PDF/);
  expect(sheet.opens).toBe(1);
  expect(sheet.html).toContain('@page{size:A4 landscape;margin:10mm}');
  expect(sheet.html).toContain('SUBTOTALES POR CATEGORÍA');
  expect(sheet.html).toContain('SUBTOTAL ROPA');
  expect(sheet.html).toContain('SUBTOTAL PALOS');
  expect(sheet.html).toContain('USD');
  expect(sheet.html).toContain('4,050.00');
  expect(sheet.html).toContain('1,750.00');

  await page.getByRole('button',{name:/Categorías:/}).click();
  await page.locator('.inv-category-options label').filter({hasText:'Palos'}).locator('input').uncheck();
  const selected=await captureInventoryReport(page,/Hoja \/ PDF/);
  expect(selected.html).toContain('SUBTOTAL ROPA');
  expect(selected.html).not.toContain('SUBTOTAL PALOS');
  expect(selected.html).toContain('4,050.00');
  expect(selected.html).not.toContain('3,500.00');
  const events=await (await request.get(`${fixture}/__events`)).json();
  expect(events.filter((e:{method:string,path:string})=>['PATCH','PUT','DELETE'].includes(e.method)||e.path==='/rest/v1/rpc/admin_inventory_adjust')).toHaveLength(0);
});

test('A6.2 one thermal label printer uses current variant offer and exact 50 × 30 layout',async({page,request})=>{
  await login(page);await page.goto('/admin/inventario');
  await expect(page.locator('.inv-tablebox tbody tr')).toHaveCount(4);
  // Prices change only in the local fixture AFTER the catalog loaded: printing must re-read them.
  await configure(request,{labelFixture:true});
  const label=await captureThermalLabel(page,'ROP-001-XXL');
  expect(label.opens).toBe(1);
  expect(label.html).toContain('@page{size:50mm 30mm;margin:0}');
  expect(label.html).toContain('UP AND DOWN');
  expect(label.html).toContain('XXL');
  expect(label.html).toContain('Polo clásico · Blanco');
  expect(label.html).toMatch(/USD\s*420\.00\s*USD/);
  expect(label.html).toContain('2000000000053');
  expect(label.html).toContain('class="barcode"');
  const events=await (await request.get(`${fixture}/__events`)).json();
  expect(events.filter((e:{path:string,query:string})=>e.path==='/rest/v1/product_variants'&&e.query.includes('id=eq.v2'))).toHaveLength(1);
  expect(events.filter((e:{path:string,query:string})=>e.path==='/rest/v1/products'&&e.query.includes('id=eq.p1'))).toHaveLength(1);
  expect(events.filter((e:{method:string,path:string})=>['PATCH','PUT','DELETE'].includes(e.method)||e.path==='/rest/v1/rpc/admin_inventory_adjust')).toHaveLength(0);
});

test('A6.2 a valid zero promotional price stays zero on thermal labels',async({page,request})=>{
  await login(page);await page.goto('/admin/inventario');
  await expect(page.locator('.inv-tablebox tbody tr')).toHaveCount(4);
  await configure(request,{zeroPriceFixture:true});
  const label=await captureThermalLabel(page,'ROP-001-XS');
  expect(label.opens).toBe(1);
  expect(label.html).toMatch(/\$0\.00\s*MXN/);
  expect(label.html).toContain('Polo clásico · Rojo');
});

test('A6.1 inventory loads the movement log only when requested and keeps movement search',async({page,request})=>{
  await login(page);
  await page.goto('/admin/inventario');
  await expect(page.locator('.inv-tablebox tbody tr')).toHaveCount(4);
  const initial=await (await request.get(`${fixture}/__events`)).json();
  expect(initial.filter((e:{path:string})=>e.path==='/rest/v1/rpc/admin_inventory_catalog')).toHaveLength(1);
  expect(initial.filter((e:{path:string})=>e.path==='/rest/v1/rpc/admin_inventory_movement_log')).toHaveLength(0);
  expect(initial.filter((e:{path:string,query:string})=>e.path==='/rest/v1/product_variants'&&e.query.includes('stock'))).toHaveLength(0);

  await page.getByRole('button',{name:'Entradas y salidas'}).click();
  const movementSearch=page.locator('.inv-form input[type=search]');
  await expect(movementSearch).toBeVisible();
  await movementSearch.fill('Polo');
  await expect(page.locator('.inv-form select[name=variant] option')).toHaveCount(4);
  await movementSearch.fill('XXL');
  await expect(page.locator('.inv-form select[name=variant] option')).toHaveCount(2);

  await page.getByRole('button',{name:'Bitácora'}).click();
  await expect(page.locator('.inv-tablebox')).toContainText('Recepción de prueba');
  const after=await (await request.get(`${fixture}/__events`)).json();
  expect(after.filter((e:{path:string})=>e.path==='/rest/v1/rpc/admin_inventory_movement_log')).toHaveLength(1);
  expect(after.filter((e:{path:string,method:string})=>e.path==='/rest/v1/rpc/admin_inventory_adjust')).toHaveLength(0);
});

test('A6.1 realtime stock signal refreshes catalog and metrics once per burst without DOM stock queries',async({page,request})=>{
  await login(page);
  await page.goto('/admin/inventario');
  await expect(page.locator('.inv-tablebox tbody tr')).toHaveCount(4);
  await expect(page.locator('.inv-metrics')).toContainText('20');
  await configure(request,{zeroStock:true});
  await page.evaluate(()=>{
    window.dispatchEvent(new Event('updown-inventory-stock-changed'));
    window.dispatchEvent(new Event('updown-inventory-stock-changed'));
    window.dispatchEvent(new Event('updown-inventory-stock-changed'));
  });
  await expect(page.locator('.inv-metrics')).toContainText('15');
  const row=page.locator('.inv-tablebox tbody tr').filter({hasText:'ROP-001-XS'});
  await expect(row.locator('td.stock')).toHaveText('0');
  await expect(row).toContainText('Agotado');
  const events=await (await request.get(`${fixture}/__events`)).json();
  expect(events.filter((e:{path:string})=>e.path==='/rest/v1/rpc/admin_inventory_catalog')).toHaveLength(2);
  expect(events.filter((e:{path:string,query:string})=>e.path==='/rest/v1/product_variants'&&e.query.includes('stock'))).toHaveLength(0);
  expect(events.filter((e:{method:string,path:string})=>e.method==='PATCH'||e.method==='DELETE'||e.path==='/rest/v1/rpc/admin_inventory_adjust')).toHaveLength(0);
});


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

test('A5.1 review of retirement highlights inventory and historical references without deleting',async({page,request})=>{
  await configure(request,{retirementHasHistory:true});await login(page);await ready(page);
  await card(page,'p1').locator('.ud-delete').click();
  const inspector=card(page,'p1').getByRole('region',{name:'Auditoría de baja de Polo clásico'});
  await expect(inspector).toBeVisible();
  await expect(inspector).toContainText('Existencia registrada: 5');
  await expect(inspector).toContainText('Variantes: Referencia detectada');
  await expect(inspector).toContainText('Movimientos de inventario: Referencia detectada');
  await expect(inspector).toContainText('Ventas POS: Referencia detectada');
  await expect(inspector).toContainText('Pedidos web: Sin referencias visibles (no concluyente)');
  await expect(inspector).toContainText('Ninguna baja se ejecutó');
  const events=await (await request.get(`${fixture}/__events`)).json();
  expect(events.filter((e:{method:string,path:string})=>['POST','PUT','PATCH','DELETE'].includes(e.method)&&
    /\/rest\/v1\/(products|product_variants|inventory_movements|pos_sale_items|order_items|checkout_v2_items|pos_service_receptions)/.test(e.path))).toHaveLength(0);
  await inspector.getByRole('button',{name:'Cerrar revisión'}).click();
  await expect(inspector).toHaveCount(0);
});

test('A5.1 restricted historical reads never imply a product can be deleted',async({page,request})=>{
  await configure(request,{retirementAuditDenied:true});await login(page);await ready(page);
  await card(page,'p2').locator('.ud-delete').click();
  const inspector=card(page,'p2').getByRole('region',{name:'Auditoría de baja de Polo clásico azul'});
  await expect(inspector).toContainText('No verificable (acceso o consulta restringidos)');
  await expect(inspector).toContainText('Variantes: Referencia detectada');
  await expect(inspector).toContainText('Eliminar definitivamente');
  await expect(inspector).toContainText('No disponible desde el navegador');
  const events=await (await request.get(`${fixture}/__events`)).json();
  expect(events.some((e:{method:string,path:string})=>e.method==='DELETE'&&e.path==='/rest/v1/products')).toBe(false);
});

test('A5.2 retirement preview shows only publication fields and preserves commercial data',async({page,request})=>{
  await login(page);await ready(page);
  await card(page,'p2').getByRole('button',{name:'Revisar baja'}).click();
  const preview=card(page,'p2').getByRole('group',{name:'Vista previa de retiro sin guardar'});
  await expect(preview).toBeVisible();
  await expect(preview.locator('tbody tr').nth(0)).toContainText('active');
  await expect(preview.locator('tbody tr').nth(0)).toContainText('archived');
  await expect(preview.locator('tbody tr').nth(1)).toContainText('Visible');
  await expect(preview.locator('tbody tr').nth(1)).toContainText('Oculto');
  await expect(preview.locator('tbody tr').nth(2)).toContainText('Visible');
  await expect(preview.locator('tbody tr').nth(2)).toContainText('Oculto');
  await expect(preview).toContainText('SKU, UPC, precios, descuentos, costos, existencias, variantes, fotografías, ventas, reservas e historial');
  const events=await (await request.get(`${fixture}/__events`)).json();
  expect(events.filter((e:{method:string,path:string})=>['POST','PUT','PATCH','DELETE'].includes(e.method)&&
    /\/rest\/v1\//.test(e.path))).toHaveLength(0);
});

test('A5.2 an already archived product offers no action or repeated mutation',async({page,request})=>{
  await configure(request,{retirementArchivedProduct:true});await login(page);await ready(page);
  await card(page,'p2').getByRole('button',{name:'Revisar baja'}).click();
  const preview=card(page,'p2').getByRole('group',{name:'Vista previa de retiro sin guardar'});
  await expect(preview).toContainText('El catálogo ya muestra este artículo retirado');
  await expect(preview.locator('tbody tr').nth(0)).toContainText('archived');
  await expect(preview.locator('tbody tr').nth(1)).toContainText('Oculto');
  await expect(preview.locator('tbody tr').nth(2)).toContainText('Oculto');
  const events=await (await request.get(`${fixture}/__events`)).json();
  expect(events.some((e:{method:string,path:string})=>e.path==='/rest/v1/products'&&e.method!=='GET')).toBe(false);
});

test('A3.8 metadata-only edits preserve gallery IDs and UPC photos added by another operator',async({page,request})=>{
  await configure(request,{existingPhoto:true});await login(page);await ready(page);
  await card(page,'p1').locator('.ud-edit').click();
  await expect(page.locator('#udGalleryCount')).toHaveText('1 / 10');
  // Another operator adds a photo after this editor opened. No real database:
  // both the admin and its concurrent operator use the isolated fixture.
  await request.post(`${fixture}/rest/v1/product_images`,{data:{
    product_id:'p1',image_url:'https://fixture.test/concurrent-upc-photo.jpg',
    alt_text:'Foto de otro operador',sort_order:2,is_primary:false,
  }});
  await page.locator('#udName').fill('Polo con descripción QA');
  await page.locator('#udSave').click();
  await expect(page.locator('#udToast')).toContainText('Producto actualizado');
  const images=await (await request.get(`${fixture}/rest/v1/product_images?product_id=eq.p1`)).json();
  expect(images).toHaveLength(2);
  expect(images.map((row:{id:string})=>row.id)).toEqual(['img-old','img-2']);
  const events=await (await request.get(`${fixture}/__events`)).json();
  expect(events.filter((e:{method:string,path:string})=>e.path==='/rest/v1/product_images'&&e.method==='DELETE')).toHaveLength(0);
  expect(events.filter((e:{method:string,path:string})=>e.path==='/rest/v1/product_images'&&e.method==='POST')).toHaveLength(1);
});

test('A3.8 explicitly adding an image still uses the existing gallery editor',async({page,request})=>{
  await configure(request,{existingPhoto:true});await login(page);await ready(page);
  await card(page,'p1').locator('.ud-edit').click();
  await page.locator('#udImage').setInputFiles(photoFixture);
  await expect(page.locator('#udGalleryCount')).toHaveText('2 / 10');
  await page.locator('#udSave').click();
  await expect(page.locator('#udToast')).toContainText('Producto actualizado');
  const images=await (await request.get(`${fixture}/rest/v1/product_images?product_id=eq.p1`)).json();
  expect(images).toHaveLength(2);
  expect(images[0]).toMatchObject({is_primary:true,sort_order:1});
  const events=await (await request.get(`${fixture}/__events`)).json();
  expect(events.filter((e:{method:string,path:string})=>e.path==='/rest/v1/product_images'&&e.method==='DELETE')).toHaveLength(1);
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
  try {
    await expect(page.getByRole('button',{name:'Reintentar variantes'})).toBeVisible({timeout:7000});
  } catch(error) {
    const events=await (await request.get(`${fixture}/__events`)).json();
    const variantReads=events.filter((e:{path:string,method:string})=>e.path==='/rest/v1/product_variants'&&e.method==='GET');
    console.log('A3.5_VARIANT_RETRY_DIAGNOSTIC',JSON.stringify({
      variantReads:variantReads.map((e:{query:string})=>e.query),
      notices:await page.locator('#udList [role=status]').allInnerTexts(),
      listPreview:(await page.locator('#udList').innerText()).slice(0,350)
    }));
    throw error;
  }
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

test('A3.9 Storage INSERT denial preserves photo selection and retry uses a non-upsert UUID path',async({page,request})=>{
  await configure(request,{storageInsertForbidden:true});await login(page);await ready(page);
  await page.getByRole('button',{name:'Nueva ficha',exact:true}).click();
  const host=page.locator('#udUnifiedProductHost');
  await host.locator('#quick-barcode').fill('2000000000015');
  await host.getByRole('button',{name:'Buscar',exact:true}).click();
  const photos=host.getByRole('region',{name:'Fotografías por UPC'});
  await photos.locator('input[type=file][capture=environment]').setInputFiles(photoFixture);
  await photos.getByRole('button',{name:'Guardar 1 fotografía(s) en este UPC'}).click();
  await expect(host.getByRole('alert')).toContainText('Fixture Storage INSERT denied');
  await expect(photos.locator('img[alt="Nueva foto 1"]')).toBeVisible();
  const blocked=await (await request.get(`${fixture}/__events`)).json();
  expect(blocked.filter((e:{path:string,method:string})=>e.path==='/rest/v1/product_images'&&e.method==='POST')).toHaveLength(0);
  await configure(request,{storageInsertForbidden:false});
  await photos.getByRole('button',{name:'Reintentar fotos'}).click();
  await expect(host.getByText(/fotografía\(s\) asociadas a Polo clásico/)).toBeVisible();
  const events=await (await request.get(`${fixture}/__events`)).json();
  const uploads=events.filter((e:{path:string})=>e.path.startsWith('/storage/v1/object/product-media/'));
  expect(uploads).toHaveLength(2);
  expect(uploads[0].path).toBe(uploads[1].path);
  expect(uploads.every((e:{authorized:boolean,storageUpsert:string})=>e.authorized&&e.storageUpsert!=='true')).toBe(true);
  const images=await (await request.get(`${fixture}/rest/v1/product_images?product_id=eq.p1`)).json();
  expect(images).toHaveLength(1);
  expect(events.some((e:{path:string})=>/admin_inventory_adjust|admin_quick_inventory_receive/.test(e.path))).toBe(false);
});

test('A3.9 gallery INSERT policy denial retries metadata without uploading the same file again',async({page,request})=>{
  await configure(request,{galleryInsertForbidden:true});await login(page);await ready(page);
  await page.getByRole('button',{name:'Nueva ficha',exact:true}).click();
  const host=page.locator('#udUnifiedProductHost');
  await host.locator('#quick-barcode').fill('2000000000015');
  await host.getByRole('button',{name:'Buscar',exact:true}).click();
  const photos=host.getByRole('region',{name:'Fotografías por UPC'});
  await photos.locator('input[type=file][capture=environment]').setInputFiles(photoFixture);
  await photos.getByRole('button',{name:'Guardar 1 fotografía(s) en este UPC'}).click();
  await expect(host.getByRole('alert')).toContainText('Fixture product_images INSERT denied by RLS');
  await configure(request,{galleryInsertForbidden:false});
  await photos.getByRole('button',{name:'Reintentar fotos'}).click();
  await expect(host.getByText(/fotografía\(s\) asociadas a Polo clásico/)).toBeVisible();
  const events=await (await request.get(`${fixture}/__events`)).json();
  expect(events.filter((e:{path:string})=>e.path.startsWith('/storage/v1/object/product-media/'))).toHaveLength(1);
  expect(events.filter((e:{path:string,method:string})=>e.path==='/rest/v1/product_images'&&e.method==='POST')).toHaveLength(2);
  const images=await (await request.get(`${fixture}/rest/v1/product_images?product_id=eq.p1`)).json();
  expect(images).toHaveLength(1);
});

test('A3.9 factory barcode of a variant attaches the image to its parent without changing the variant',async({page,request})=>{
  await login(page);await ready(page);
  await page.getByRole('button',{name:'Nueva ficha',exact:true}).click();
  const host=page.locator('#udUnifiedProductHost');
  await host.locator('#quick-barcode').fill('2000000000046');
  await host.getByRole('button',{name:'Buscar',exact:true}).click();
  const photos=host.getByRole('region',{name:'Fotografías por UPC'});
  await expect(photos).toBeVisible();
  await photos.locator('input[type=file][capture=environment]').setInputFiles(photoFixture);
  await photos.getByRole('button',{name:'Guardar 1 fotografía(s) en este UPC'}).click();
  await expect(host.getByText(/fotografía\(s\) asociadas a Polo clásico/)).toBeVisible();
  const images=await (await request.get(`${fixture}/rest/v1/product_images?product_id=eq.p1`)).json();
  expect(images).toHaveLength(1);
  expect(images[0]).toMatchObject({product_id:'p1',sort_order:1,is_primary:true});
  const variants=await (await request.get(`${fixture}/rest/v1/product_variants?product_id=eq.p1`)).json();
  expect(variants.find((v:{id:string})=>v.id==='v1')).toMatchObject({
    sku:'ROP-001-XS',barcode:'2000000000046',stock:5,
  });
  const events=await (await request.get(`${fixture}/__events`)).json();
  expect(events.filter((e:{method:string,path:string})=>['POST','PATCH','DELETE'].includes(e.method)&&e.path==='/rest/v1/product_variants')).toHaveLength(0);
});

test('A3.9 an invalid HEIC capture is rejected before any image or inventory write',async({page,request})=>{
  await login(page);await ready(page);
  await page.getByRole('button',{name:'Nueva ficha',exact:true}).click();
  const host=page.locator('#udUnifiedProductHost');
  await host.locator('#quick-barcode').fill('2000000000015');
  await host.getByRole('button',{name:'Buscar',exact:true}).click();
  const photos=host.getByRole('region',{name:'Fotografías por UPC'});
  await photos.locator('input[type=file][capture=environment]').setInputFiles({
    name:'captura-invalida.heic',mimeType:'image/heic',buffer:Buffer.from('fixture-invalid-heic-file'),
  });
  await expect(host.getByRole('alert')).toBeVisible();
  await expect(photos.locator('img[alt="Nueva foto 1"]')).toHaveCount(0);
  await expect(photos.getByRole('button',{name:/Guardar .*fotografía/})).toBeDisabled();
  const events=await (await request.get(`${fixture}/__events`)).json();
  expect(events.some((e:{path:string,method:string})=>e.path.startsWith('/storage/v1/object/')||
    e.path==='/rest/v1/product_images'&&e.method!=='GET'||
    /admin_inventory_adjust|admin_quick_inventory_receive/.test(e.path))).toBe(false);
});

test('A4 name search requires an explicit product choice and sends photos only to that product',async({page,request})=>{
  await login(page);await ready(page);
  await page.getByRole('button',{name:'Nueva ficha',exact:true}).click();
  const host=page.locator('#udUnifiedProductHost');
  await host.getByRole('searchbox',{name:'Buscar producto existente para fotografías'}).fill('Polo');
  await expect(host.getByRole('button',{name:'Seleccionar Polo clásico · ROP-001'})).toBeVisible();
  await expect(host.getByRole('button',{name:'Seleccionar Polo clásico azul · ROP-0010'})).toBeVisible();
  await expect(host.getByRole('region',{name:'Fotografías por UPC'})).toHaveCount(0);
  await host.getByRole('button',{name:'Seleccionar Polo clásico azul · ROP-0010'}).click();
  await expect(host.getByText('PRODUCTO ELEGIDO PARA FOTOGRAFÍAS')).toBeVisible();
  await expect(host.getByRole('button',{name:'Guardar ficha completa'})).toHaveCount(0);
  const photos=host.getByRole('region',{name:'Fotografías por UPC'});
  await photos.locator('input[type=file][capture=environment]').setInputFiles(photoFixture);
  await photos.getByRole('button',{name:'Guardar 1 fotografía(s) en este producto'}).click();
  await expect(host.getByText(/fotografía\(s\) asociadas a Polo clásico azul/)).toBeVisible();
  const imagesP1=await (await request.get(`${fixture}/rest/v1/product_images?product_id=eq.p1`)).json();
  const imagesP2=await (await request.get(`${fixture}/rest/v1/product_images?product_id=eq.p2`)).json();
  expect(imagesP1).toHaveLength(0);expect(imagesP2).toHaveLength(1);
  expect(imagesP2[0]).toMatchObject({product_id:'p2',sort_order:1,is_primary:true});
  const events=await (await request.get(`${fixture}/__events`)).json();
  expect(events.filter((e:{path:string,method:string})=>e.path==='/rest/v1/products'&&['POST','PUT','PATCH','DELETE'].includes(e.method))).toHaveLength(0);
  expect(events.some((e:{path:string})=>/admin_quick_product_create|admin_quick_inventory_receive|admin_inventory_adjust/.test(e.path))).toBe(false);
});

test('A4 accepts UPC or name but does not search by SKU, and retries gallery metadata',async({page,request})=>{
  await configure(request,{galleryInsertForbidden:true});await login(page);await ready(page);
  await page.getByRole('button',{name:'Nueva ficha',exact:true}).click();
  const host=page.locator('#udUnifiedProductHost');
  const search=host.getByRole('searchbox',{name:'Buscar producto existente para fotografías'});
  await search.fill('ROP-0010');
  await expect(host.getByText('No se encontraron productos. Puedes escanear el UPC o crear una ficha nueva.')).toBeVisible();
  await search.fill('2000000000022');
  await expect(host.getByRole('button',{name:'Seleccionar Polo clásico azul · ROP-0010'})).toBeVisible();
  await expect(host.getByRole('button',{name:'Seleccionar Polo clásico · ROP-001'})).toHaveCount(0);
  await host.getByRole('button',{name:'Seleccionar Polo clásico azul · ROP-0010'}).click();
  const photos=host.getByRole('region',{name:'Fotografías por UPC'});
  await photos.locator('input[type=file][capture=environment]').setInputFiles(photoFixture);
  await photos.getByRole('button',{name:'Guardar 1 fotografía(s) en este producto'}).click();
  await expect(host.getByRole('alert')).toContainText('Fixture product_images INSERT denied by RLS');
  await configure(request,{galleryInsertForbidden:false});
  await photos.getByRole('button',{name:'Reintentar fotos'}).click();
  await expect(host.getByText(/fotografía\(s\) asociadas a Polo clásico azul/)).toBeVisible();
  const events=await (await request.get(`${fixture}/__events`)).json();
  expect(events.filter((e:{path:string})=>e.path.startsWith('/storage/v1/object/product-media/'))).toHaveLength(1);
  const images=await (await request.get(`${fixture}/rest/v1/product_images?product_id=eq.p2`)).json();
  expect(images).toHaveLength(1);
});

test('A4 a blocked catalog search never creates or changes a product',async({page,request})=>{
  await login(page);await ready(page);
  await configure(request,{photoSearchError:true});
  await page.getByRole('button',{name:'Nueva ficha',exact:true}).click();
  const host=page.locator('#udUnifiedProductHost');
  await host.getByRole('searchbox',{name:'Buscar producto existente para fotografías'}).fill('Driver');
  await expect(host.getByRole('alert')).toContainText('Fixture catalog SELECT denied by RLS');
  await expect(host.getByRole('region',{name:'Fotografías por UPC'})).toHaveCount(0);
  const events=await (await request.get(`${fixture}/__events`)).json();
  expect(events.some((e:{path:string,method:string})=>e.method!=='GET'&&e.method!=='HEAD'&&
    (/\/rest\/v1\/(products|product_images|product_variants)/.test(e.path)||/\/storage\/v1\/object\//.test(e.path)||/\/rpc\/admin_quick_/.test(e.path)))).toBe(false);
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
