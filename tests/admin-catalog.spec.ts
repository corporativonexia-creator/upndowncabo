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
async function receptionSession(page: Page) {
  await page.addInitScript(() => {
    const user = { id: '00000000-0000-4000-8000-000000000001', aud: 'authenticated', role: 'authenticated', email: 'admin@example.test' };
    const expires = Math.floor(Date.now() / 1000) + 3600;
    const encode = (value: object) => btoa(JSON.stringify(value)).replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');
    const access_token = [encode({ alg: 'HS256', typ: 'JWT' }), encode({ sub: user.id, aud: 'authenticated', role: 'authenticated', exp: expires }), 'fixture-signature'].join('.');
    localStorage.setItem('updown-pos-device-token-v1', 'terminal-qa');
    localStorage.setItem('updown-pos-auth-v1', JSON.stringify({ access_token, token_type: 'bearer', expires_at: expires, expires_in: 3600, refresh_token: 'fixture-refresh', user }));
  });
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

test('A7.1 POS admin fetches only the visible report and binds tabs once after refresh',async({page,request})=>{
  await login(page);await ready(page);
  await page.locator('[data-sidebar-section="sales"] summary').click();
  await page.locator('#udv2PosTab').click();
  const tabs=page.locator('#udv2PosView .udv2-pos-tabs');
  const reportPaths=['admin_pos_audit_feed','admin_pos_sales_summary','admin_pos_shift_report',
    'admin_pos_inventory_report','admin_pos_employee_report','admin_pos_daily_close_report'];
  const events=async()=>await (await request.get(`${fixture}/__events`)).json() as Array<{path:string,method:string}>;
  const count=async(name:string)=>(await events()).filter(e=>e.path===`/rest/v1/rpc/${name}`).length;
  await expect.poll(()=>count('admin_pos_daily_close_report')).toBe(1);
  expect((await events()).filter(e=>reportPaths.slice(0,-1).some(name=>e.path===`/rest/v1/rpc/${name}`))).toHaveLength(0);

  await tabs.locator('[data-pos-section="summary"]').click();
  await expect.poll(()=>count('admin_pos_sales_summary')).toBe(1);
  expect((await events()).filter(e=>['admin_pos_shift_report','admin_pos_inventory_report',
    'admin_pos_employee_report','admin_pos_audit_feed'].some(name=>e.path===`/rest/v1/rpc/${name}`))).toHaveLength(0);

  await page.locator('#udv2PosRefresh').click();
  await expect.poll(()=>count('admin_pos_sales_summary')).toBe(2);
  await page.locator('#udv2PosRefresh').click();
  await expect.poll(()=>count('admin_pos_sales_summary')).toBe(3);
  await tabs.locator('[data-pos-section="audit"]').click();
  await expect.poll(()=>count('admin_pos_audit_feed')).toBe(1);
  expect(await count('admin_pos_daily_close_report')).toBe(1);
  expect((await events()).filter(e=>['PATCH','PUT','DELETE'].includes(e.method))).toHaveLength(0);
});

test('A7.2 ignores an older POS summary response after status filters change',async({page,request})=>{
  await login(page);await ready(page);await configure(request,{posSummaryRaceFixture:true});
  await page.locator('[data-sidebar-section="sales"] summary').click();
  await page.locator('#udv2PosTab').click();
  await page.locator('#udv2PosView [data-pos-section="summary"]').click();
  const events=async()=>await (await request.get(`${fixture}/__events`)).json() as Array<{path:string,method:string,body?:Record<string,unknown>}>;
  const summaryCalls=async()=>(await events()).filter(e=>e.path==='/rest/v1/rpc/admin_pos_sales_summary');
  await expect.poll(async()=>(await summaryCalls()).length).toBe(1);
  await page.locator('#udv2PosSummaryStatus').selectOption('completed');
  await expect(page.locator('#udv2PosSummaryCards .udv2-summary-card').first()).toContainText('Ventas');
  await expect(page.locator('#udv2PosSummaryCards .udv2-summary-card').first().locator('strong')).toHaveText('2');
  await expect.poll(async()=>(await events()).some(e=>e.path==='/__qa_pos_summary_old_completed')).toBe(true);
  await expect(page.locator('#udv2PosSummaryCards .udv2-summary-card').first().locator('strong')).toHaveText('2');
  expect((await summaryCalls()).map(e=>e.body?.p_status)).toEqual([null,'completed']);
  expect((await events()).filter(e=>['PATCH','PUT','DELETE'].includes(e.method))).toHaveLength(0);
});

test('A7.2 POS audit server filters refresh once after rapid changes',async({page,request})=>{
  await login(page);await ready(page);await configure(request,{posAuditFilterFixture:true});
  await page.locator('[data-sidebar-section="sales"] summary').click();
  await page.locator('#udv2PosTab').click();
  await page.locator('#udv2PosView [data-pos-section="audit"]').click();
  const list=page.locator('#udv2PosAuditList');
  await expect(list).toContainText('Venta completada');
  await page.locator('#udv2PosAuditType').evaluate((select:HTMLSelectElement)=>{
    select.value='all';select.dispatchEvent(new Event('change',{bubbles:true}));
    select.value='employee_login';select.dispatchEvent(new Event('change',{bubbles:true}));
  });
  await expect(list).toContainText('Inicio de sesión');
  await expect(list).not.toContainText('Venta completada');
  const events=await (await request.get(`${fixture}/__events`)).json() as Array<{path:string,body?:Record<string,unknown>}>;
  const auditCalls=events.filter(e=>e.path==='/rest/v1/rpc/admin_pos_audit_feed');
  expect(auditCalls.map(e=>e.body?.p_event_type)).toEqual(['operation','employee_login']);
  await page.locator('#udv2PosAuditType').selectOption('all');
  await expect(list).toContainText('Venta completada');
  await expect(list).toContainText('Inicio de sesión');
});

test('A8.1 workshop searches by name or folio as typed and ignores older responses',async({page,request})=>{
  await configure(request,{receptionFixture:true,receptionRaceFixture:true});
  await receptionSession(page);
  await page.goto('/pos/recepciones');
  const list=page.locator('aside');
  await expect(list.getByRole('button',{name:/Cliente Driver/})).toBeVisible();
  await expect(list.getByRole('button',{name:/Cliente Putter/})).toBeVisible();
  const search=page.getByRole('textbox',{name:'Buscar recepciones'});
  await search.fill('Driver');
  const events=async()=>await (await request.get(`${fixture}/__events`)).json() as Array<{path:string,method:string,body?:Record<string,unknown>}>;
  await expect.poll(async()=>(await events()).some(e=>e.path==='/rest/v1/rpc/pos_reception_recent'&&e.body?.p_search==='Driver')).toBe(true);
  await search.fill('Putter');
  await expect(list.getByRole('button',{name:/Cliente Putter/})).toBeVisible();
  await expect(list.getByRole('button',{name:/Cliente Driver/})).toHaveCount(0);
  await expect.poll(async()=>(await events()).some(e=>e.path==='/__qa_reception_old_completed')).toBe(true);
  await expect(list.getByRole('button',{name:/Cliente Putter/})).toHaveCount(1);
  await list.getByRole('button',{name:/Cliente Putter/}).click();
  await expect(list.getByRole('button',{name:/Cliente Putter/})).toHaveAttribute('aria-pressed','true');
  await list.getByRole('button',{name:'Limpiar'}).click();
  await expect(list.getByRole('button',{name:/Cliente Driver/})).toBeVisible();
  const calls=(await events()).filter(e=>e.path==='/rest/v1/rpc/pos_reception_recent');
  expect(calls.map(e=>e.body?.p_search)).toEqual(['','Driver','Putter','']);
  expect((await events()).filter(e=>['/rest/v1/rpc/pos_reception_create','/rest/v1/rpc/pos_reception_set_ready'].includes(e.path)||
    ['PATCH','PUT','DELETE'].includes(e.method))).toHaveLength(0);
});

test('A8.1 denied workshop history reads retain previous visible records and show an error',async({page,request})=>{
  await configure(request,{receptionFixture:true,receptionHistoryDenied:true});
  await receptionSession(page);
  await page.goto('/pos/recepciones');
  const list=page.locator('aside');
  await expect(list.getByRole('button',{name:/Cliente Driver/})).toBeVisible();
  await page.getByRole('textbox',{name:'Buscar recepciones'}).fill('Putter');
  await expect(list.getByRole('alert')).toContainText('Lectura de recepciones restringida por RLS');
  await expect(list.getByRole('button',{name:/Cliente Driver/})).toBeVisible();
  await expect(list.getByRole('button',{name:/Cliente Putter/})).toBeVisible();
});

test('A8.2 filters reception status locally and keeps the selected workshop detail beside history',async({page,request})=>{
  await configure(request,{receptionFixture:true,receptionTrackingFixture:true});
  await receptionSession(page);
  await page.goto('/pos/recepciones');
  const list=page.locator('aside');
  const filters=list.getByRole('group',{name:'Filtrar por estado en resultados'});
  await expect(filters.getByRole('button',{name:'Todas 3'})).toHaveAttribute('aria-pressed','true');
  const events=async()=>await (await request.get(`${fixture}/__events`)).json() as Array<{path:string,method:string}>;
  await filters.getByRole('button',{name:'Listas 1'}).click();
  await expect(list.getByRole('button',{name:/Cliente Putter/})).toBeVisible();
  await expect(list.getByRole('button',{name:/Cliente Driver/})).toHaveCount(0);
  await expect(list.getByRole('button',{name:/Cliente Entregado/})).toHaveCount(0);
  await list.getByRole('button',{name:/Cliente Putter/}).click();
  const detail=list.getByRole('region',{name:'Detalle de recepción'});
  await expect(detail).toContainText('SR-000129');
  await expect(detail).toContainText('El servicio se cobra posteriormente en caja');
  await expect(detail.getByRole('link',{name:'Escanear y cobrar en POS'})).toHaveAttribute('href','/pos?recepcion=SR-000129');
  await detail.getByText('Ver datos originales del equipo y servicio').click();
  await expect(detail).toContainText('Cambiar grip');
  await expect(detail).toContainText('Buen estado');
  await filters.getByRole('button',{name:'Entregadas 1'}).click();
  await expect(list.getByRole('button',{name:/Cliente Entregado/})).toBeVisible();
  await expect(list.getByRole('button',{name:/Cliente Putter/})).toHaveCount(0);
  await list.getByRole('button',{name:/Cliente Entregado/}).click();
  await expect(detail).toContainText('Venta vinculada: sale-qa-delivered');
  await expect(detail.getByRole('link',{name:'Escanear y cobrar en POS'})).toHaveCount(0);
  await filters.getByRole('button',{name:'Todas 3'}).click();
  await expect(list.getByRole('button',{name:/Cliente Driver/})).toBeVisible();
  const calls=(await events()).filter(e=>e.path==='/rest/v1/rpc/pos_reception_recent');
  expect(calls).toHaveLength(1);
  expect((await events()).filter(e=>['/rest/v1/rpc/pos_reception_create','/rest/v1/rpc/pos_reception_set_ready'].includes(e.path)||
    ['PATCH','PUT','DELETE'].includes(e.method))).toHaveLength(0);
});

test('A8.2 refreshes the selected receipt status from authorized history without a write',async({page,request})=>{
  await configure(request,{receptionFixture:true,receptionTrackingFixture:true});
  await receptionSession(page);
  await page.goto('/pos/recepciones');
  const list=page.locator('aside');
  await list.getByRole('button',{name:/Cliente Putter/}).click();
  const detail=list.getByRole('region',{name:'Detalle de recepción'});
  await expect(detail.getByRole('link',{name:'Escanear y cobrar en POS'})).toBeVisible();
  await configure(request,{receptionTrackingPutterDelivered:true});
  await list.getByRole('button',{name:'Buscar',exact:true}).click();
  await expect(detail).toContainText('Venta vinculada: sale-qa-putter');
  await expect(detail).toContainText('Entregado y cobrado');
  await expect(detail.getByRole('link',{name:'Escanear y cobrar en POS'})).toHaveCount(0);
  const events=await (await request.get(`${fixture}/__events`)).json() as Array<{path:string,method:string}>;
  expect(events.filter(e=>e.path==='/rest/v1/rpc/pos_reception_recent')).toHaveLength(2);
  expect(events.filter(e=>['/rest/v1/rpc/pos_reception_create','/rest/v1/rpc/pos_reception_set_ready'].includes(e.path)||
    ['PATCH','PUT','DELETE'].includes(e.method))).toHaveLength(0);
});

test('A9.1 orders and seller notes load only when opened without observer reload loops',async({page,request})=>{
  await configure(request,{ordersFixture:true});
  await login(page);await ready(page);
  const events=async()=>await (await request.get(`${fixture}/__events`)).json() as Array<{path:string,method:string}>;
  const reads=async()=>(await events()).filter(e=>e.path==='/rest/v1/orders'&&e.method==='GET').length;
  expect(await reads()).toBe(0);

  await page.locator('[data-sidebar-section="sales"] summary').click();
  await page.locator('#udOrdersTab').click();
  await expect(page.locator('#udOrdersView')).toBeVisible();
  await expect(page.locator('#udOrdersList .u-order-card')).toHaveCount(1);
  await expect(page.locator('#udOrdersList .h63-admin-comms')).toHaveCount(1);
  await expect(page.locator('#udOrdersList .h63-admin-comms')).toContainText('Nota sintética sin impacto comercial');
  await expect.poll(reads).toBe(2); // One legacy projection and one seller-note projection.
  await page.waitForTimeout(300);
  expect(await reads()).toBe(2); // Decorating the cards cannot trigger its own observer again.

  await page.getByRole('button',{name:'Actualizar pedidos'}).click();
  await expect.poll(reads).toBe(4);
  await page.locator('[data-sidebar-section="products"] summary').click();
  await page.locator('#udProductsTab').click();
  await page.evaluate(()=>document.dispatchEvent(new Event('visibilitychange')));
  await page.waitForTimeout(220);
  expect(await reads()).toBe(4);
  expect((await events()).filter(e=>e.path==='/rest/v1/orders'&&e.method!=='GET')).toHaveLength(0);
  expect((await events()).filter(e=>['PATCH','PUT','DELETE'].includes(e.method))).toHaveLength(0);
});

test('A9.2 vendors and commissions ignore old responses after leaving and reopening the section',async({page,request})=>{
  await login(page);await ready(page);
  await configure(request,{sellersRaceFixture:true});
  const events=async()=>await (await request.get(`${fixture}/__events`)).json() as Array<{path:string,method:string}>;
  const readCount=async(table:string)=>(await events()).filter(e=>e.method==='GET'&&e.path===`/rest/v1/${table}`).length;
  await page.locator('[data-sidebar-section="commercial"] summary').click();
  await page.locator('#udv2SellersTab').click();
  await expect.poll(()=>readCount('affiliate_sellers')).toBe(1);
  await expect.poll(()=>readCount('affiliate_commissions')).toBe(1);
  await expect(page.locator('#udv2SellerList')).toHaveAttribute('aria-busy','true');

  await page.locator('[data-sidebar-section="website"] summary').click();
  await page.locator('#udv2ContentTab').click();
  await page.locator('[data-sidebar-section="commercial"] summary').click();
  await page.locator('#udv2SellersTab').click();
  await expect(page.locator('#udv2SellerList')).toContainText('Vendedor actualizado');
  await expect(page.locator('#udv2CommissionList')).toContainText('Vendedor actualizado');
  await expect(page.locator('#udv2PendingCommission')).toContainText('20');
  await expect.poll(async()=>(await events()).some(e=>e.path==='/__qa_sellers_old_completed')).toBe(true);
  await expect(page.locator('#udv2SellerList')).not.toContainText('Vendedor anterior');
  await expect(page.locator('#udv2CommissionList')).not.toContainText('Vendedor anterior');
  await expect(page.locator('#udv2SellerList')).not.toHaveAttribute('aria-busy','true');
  expect(await readCount('affiliate_sellers')).toBe(2);
  expect(await readCount('affiliate_commissions')).toBe(2);

  await page.locator('#udv2SellersTab').click();
  expect(await readCount('affiliate_sellers')).toBe(2); // Re-clicking the active tab is not another read.
  await page.locator('#udv2SellerRefresh').click();
  await expect.poll(()=>readCount('affiliate_sellers')).toBe(3);
  await expect.poll(()=>readCount('affiliate_commissions')).toBe(3);
  expect((await events()).filter(e=>['PATCH','PUT','DELETE'].includes(e.method))).toHaveLength(0);
});

test('A9.3 site content reads only the selected tab and ignores older results',async({page,request})=>{
  await login(page);await ready(page);
  await configure(request,{contentRaceFixture:true});
  const events=async()=>await (await request.get(`${fixture}/__events`)).json() as Array<{path:string,method:string}>;
  const count=async(table:string)=>(await events()).filter(e=>e.path===`/rest/v1/${table}`&&e.method==='GET').length;
  await page.locator('[data-sidebar-section="website"] summary').click();
  await page.locator('#udv2ContentTab').click();
  await expect.poll(()=>count('golf_courses')).toBe(1);
  expect(await count('golf_instructors')).toBe(0);
  expect(await count('journal_articles')).toBe(0);
  await expect(page.locator('#udv2ContentBody')).toHaveAttribute('aria-busy','true');

  await page.locator('[data-content-type="instructors"]').click();
  await expect(page.locator('#udv2ContentBody')).toContainText('Profesor de prueba');
  await expect.poll(()=>count('golf_instructors')).toBe(1);
  await page.locator('[data-content-type="courses"]').click();
  await expect(page.locator('#udv2ContentBody')).toContainText('Campo actualizado');
  await expect.poll(async()=>(await events()).some(e=>e.path==='/__qa_content_old_completed')).toBe(true);
  await expect(page.locator('#udv2ContentBody')).not.toContainText('Campo anterior');
  await expect(page.locator('#udv2ContentBody')).not.toHaveAttribute('aria-busy','true');
  expect(await count('golf_courses')).toBe(2);

  await page.locator('[data-content-type="articles"]').click();
  await expect(page.locator('#udv2ContentBody')).toContainText('Noticia sintética');
  expect(await count('journal_articles')).toBe(1);
  await page.locator('#udv2ContentTab').click();
  expect(await count('journal_articles')).toBe(1); // No reread on repeated active navigation.
  await page.locator('#udv2ContentRefresh').click();
  await expect.poll(()=>count('journal_articles')).toBe(2);
  expect(await count('golf_courses')).toBe(2);
  expect(await count('golf_instructors')).toBe(1);
  expect((await events()).filter(e=>['POST','PATCH','PUT','DELETE'].includes(e.method)&&e.path.startsWith('/rest/v1/golf_'))).toHaveLength(0);
});

test('A9.4 classes preserve loaded leads during refresh and reject late reads',async({page,request})=>{
  await login(page);await ready(page);
  await configure(request,{lessonRaceFixture:true});
  const events=async()=>await (await request.get(`${fixture}/__events`)).json() as Array<{path:string,method:string}>;
  const count=async(table:string)=>(await events()).filter(e=>e.method==='GET'&&e.path===`/rest/v1/${table}`).length;
  await page.locator('[data-sidebar-section="commercial"] summary').click();
  await page.locator('#udv2LessonsTab').click();
  await expect.poll(()=>count('golf_lesson_leads')).toBe(1);
  await expect.poll(()=>count('golf_lesson_events')).toBe(1);
  await expect.poll(()=>count('golf_instructors')).toBe(1);
  await expect(page.locator('#udv2LessonList')).toHaveAttribute('aria-busy','true');

  await page.locator('#udv2SellersTab').click();
  await page.locator('#udv2LessonsTab').click();
  await expect(page.locator('#udv2LessonList')).toContainText('Alumno actualizado');
  await expect(page.locator('#udv2LessonList')).toContainText('Profesor de clase QA');
  await expect.poll(async()=>(await events()).some(e=>e.path==='/__qa_lesson_old_completed')).toBe(true);
  await expect(page.locator('#udv2LessonList')).not.toContainText('Alumno anterior');
  await expect(page.locator('#udv2LessonList')).not.toHaveAttribute('aria-busy','true');
  await page.locator('#udv2LessonList .udv2-lesson-toggle').click();
  await expect(page.locator('#udv2LessonList')).toContainText('Solicitud creada');
  await expect(page.locator('#udv2LessonList a[href^="https://wa.me/"]')).toHaveCount(1);
  expect(await count('golf_lesson_leads')).toBe(2);

  await page.locator('#udv2LessonsTab').click();
  expect(await count('golf_lesson_leads')).toBe(2);
  await page.locator('#udv2LessonSearch').fill('Alumno actualizado');
  await page.locator('#udv2LessonRefresh').click();
  await expect.poll(()=>count('golf_lesson_leads')).toBe(3);
  await expect(page.locator('#udv2LessonList')).toContainText('Alumno actualizado');
  await expect(page.locator('#udv2LessonSearch')).toHaveValue('Alumno actualizado');
  await configure(request,{lessonHistoryDenied:true});
  await page.locator('#udv2LessonRefresh').click();
  await expect.poll(()=>count('golf_lesson_leads')).toBe(4);
  await expect(page.locator('#udv2LessonList')).toContainText('Alumno actualizado');
  expect((await events()).filter(e=>['POST','PATCH','PUT','DELETE'].includes(e.method)&&e.path.startsWith('/rest/v1/golf_lesson'))).toHaveLength(0);
});

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
  try{await expect(page.locator('.inv-tablebox tbody tr')).toHaveCount(4);}
  catch(error){
    const snapshot=await (await request.post(`${fixture}/rest/v1/rpc/admin_inventory_catalog`,{data:{}})).json();
    const events=await (await request.get(`${fixture}/__events`)).json() as Array<{path:string,method:string}>;
    console.log('A6.4 fixture-only diagnostics',JSON.stringify({
      catalogIds:(snapshot.rows||[]).map((r:{variant_id:string})=>r.variant_id),
      renderedSkus:await page.locator('.inv-tablebox tbody tr td:nth-child(3)').allTextContents(),
      recentRequests:events.filter(e=>e.path.includes('inventory')||e.path.includes('variant')).slice(-15),
    }));
    throw error;
  }
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
  const events=await (await request.get(`${fixture}/__events`)).json() as Array<{path:string,body?:Record<string,unknown>}>;
  expect(events.filter(e=>e.path==='/rest/v1/rpc/admin_inventory_save_variant'&&e.body?.p_product_id==='p-service')).toHaveLength(0);
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
  await expect(sales.locator('a[href="/pos?tab=recepciones"]')).toBeVisible();
  await expect(sales.locator('a[href="/admin/pos/promociones"]')).toBeVisible();
});

test('A11.2 nested inventory, categories and POS promotions retain the Premium White sidebar',async({page,request})=>{
  await login(page);await ready(page);
  await page.locator('#udInventoryMainNav').click();
  await expect(page).toHaveURL(/\/admin\/inventario$/);
  const side=page.getByRole('navigation',{name:'Áreas de administración de UpNDown Cabo'});
  await expect(side.getByRole('link',{name:'Inventario',exact:true})).toHaveAttribute('aria-current','page');
  await expect(page.locator('.admin-section-shell')).toHaveCount(0);
  await side.getByRole('link',{name:'Categorías y servicios'}).click();
  await expect(page).toHaveURL(/\/admin\/categorias$/);
  await expect(side.getByRole('link',{name:'Categorías y servicios'})).toHaveAttribute('aria-current','page');
  await side.getByText('Ventas y POS').click();
  await side.getByRole('link',{name:'Promociones y servicios POS'}).click();
  await expect(page).toHaveURL(/\/admin\/pos\/promociones$/);
  await expect(side.getByRole('link',{name:'Promociones y servicios POS'})).toHaveAttribute('aria-current','page');
  await side.getByText('Productos e inventario').click();
  await side.getByRole('link',{name:'Productos',exact:true}).click();
  await ready(page);
  await expect(page.locator('#updown-admin .u-admin-nav')).toHaveAttribute('data-premium-sidebar','ready');
  const events=await (await request.get(`${fixture}/__events`)).json() as Array<{method:string}>;
  expect(events.filter(e=>['PATCH','PUT','DELETE'].includes(e.method))).toHaveLength(0);
});

test('A11.2 mobile nav is compact and opens only on demand',async({page})=>{
  await page.setViewportSize({width:390,height:844});
  await login(page);await ready(page);
  const rootNav=page.locator('#updown-admin .u-admin-nav');
  const toggle=rootNav.getByRole('button',{name:/Menú del administrador/});
  await expect(toggle).toBeVisible();
  await expect(toggle).toHaveAttribute('aria-expanded','false');
  await expect(rootNav.locator('#udSidebarSections')).toBeHidden();
  expect((await rootNav.boundingBox())!.height).toBeLessThan(70);
  await toggle.click();
  await expect(toggle).toHaveAttribute('aria-expanded','true');
  await expect(rootNav.locator('[data-sidebar-section="products"] summary')).toBeVisible();
  await rootNav.locator('#udInventoryMainNav').click();
  await expect(page).toHaveURL(/\/admin\/inventario$/);
  const nestedToggle=page.getByRole('button',{name:/Menú del administrador/});
  await expect(nestedToggle).toBeVisible();
  await expect(nestedToggle).toHaveAttribute('aria-expanded','false');
  await expect(page.locator('#udAdminRouteNavigation')).toBeHidden();
  await nestedToggle.click();
  await expect(page.locator('#udAdminRouteNavigation')).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(page.locator('#udAdminRouteNavigation')).toBeHidden();
});

test('A11.2 deep links open Pedidos and Clases without changing commercial data',async({page,request})=>{
  await login(page);await ready(page);
  await page.goto('/admin?section=orders');
  await expect(page.locator('#udOrdersView')).toBeVisible();
  await page.goto('/admin?section=clases');
  await expect(page.locator('#udv2LessonsView')).toBeVisible();
  const events=await (await request.get(`${fixture}/__events`)).json() as Array<{method:string}>;
  expect(events.filter(e=>['PATCH','PUT','DELETE'].includes(e.method))).toHaveLength(0);
});

test('A11.3 preserves the initialized ADMIN when opening Inventory and returning to Commercial',async({page,request})=>{
  await login(page); await ready(page);
  await page.evaluate(() => { (window as Window & { __qaOriginalAdmin?: Element | null }).__qaOriginalAdmin = document.getElementById('updown-admin'); });
  await page.locator('#udInventoryMainNav').click();
  await expect(page).toHaveURL(/\/admin\/inventario$/);
  await expect(page.locator('.ud-admin-root-slot')).toBeHidden();
  await expect(page.locator('.inv-page')).toBeVisible();
  const sidebar = page.getByRole('navigation',{name:'Áreas de administración de UpNDown Cabo'});
  await sidebar.getByText('Comercial').click();
  await sidebar.getByRole('link',{name:'Vendedores'}).click();
  await expect(page).toHaveURL(/\/admin\?section=vendedores$/);
  await expect(page.locator('#udv2SellersView')).toBeVisible();
  await expect(page.locator('.ud-admin-splash')).toHaveCount(0);
  const persistence = await page.evaluate(() => ({
    sameRoot: (window as Window & { __qaOriginalAdmin?: Element | null }).__qaOriginalAdmin === document.getElementById('updown-admin'),
    scripts: document.querySelectorAll('script[data-updown-admin-src]').length,
    boots: performance.getEntriesByName('updown-admin-bootstrap').length,
  }));
  expect(persistence).toEqual({sameRoot:true,scripts:9,boots:1});
  const events=await (await request.get(`${fixture}/__events`)).json() as Array<{method:string}>;
  expect(events.filter(e=>['PATCH','PUT','DELETE'].includes(e.method))).toHaveLength(0);
});

test('A11.3 switches POS/Recepción tabs without losing the mounted cashier session',async({page,request})=>{
  await configure(request,{receptionFixture:true});
  await receptionSession(page);
  await page.goto('/pos');
  const posTab = page.getByRole('tab',{name:/POS$/});
  const receptionTab = page.getByRole('tab',{name:/Recepción de equipos/});
  await expect(posTab).toHaveAttribute('aria-selected','true');
  await receptionTab.click();
  await expect(receptionTab).toHaveAttribute('aria-selected','true');
  await expect(page.getByRole('textbox',{name:'Buscar recepciones'})).toBeVisible();
  await posTab.click();
  await expect(posTab).toHaveAttribute('aria-selected','true');
  await expect(page.getByRole('heading',{name:/Hola, QA Cashier/})).toBeVisible();
  await receptionTab.click();
  await expect(page.getByRole('button',{name:/Cliente Driver/})).toBeVisible();
  const events = await (await request.get(`${fixture}/__events`)).json() as Array<{path:string}>;
  expect(events.filter(e=>e.path==='/rest/v1/rpc/pos_reception_access')).toHaveLength(1);
});

test('A11.3 denies workshop RPCs without POS auth and offers a login path',async({page,request})=>{
  await page.addInitScript(() => { localStorage.setItem('updown-pos-device-token-v1','terminal-qa'); });
  await page.goto('/pos/recepciones');
  await expect(page.getByRole('alert')).toContainText('Necesitas iniciar sesión como empleado');
  await expect(page.getByRole('link',{name:/Iniciar sesión/})).toHaveAttribute('href','/pos');
  const events = await (await request.get(`${fixture}/__events`)).json() as Array<{path:string}>;
  expect(events.filter(e=>e.path==='/rest/v1/rpc/pos_reception_access')).toHaveLength(0);
});

test('A10.1 inventory navigation works without the obsolete polling script',async({page,request})=>{
  await login(page);await ready(page);
  const nav=page.locator('#updown-admin .u-admin-nav');
  await expect(nav.locator('[data-sidebar-section="products"] #udInventoryMainNav')).toHaveAttribute('href','/admin/inventario');
  await expect(page.locator('#udNew')).toBeHidden();
  await expect(page.locator('#udAffiliatesLink')).toHaveCount(0);
  await expect(nav.locator('[data-sidebar-section="commercial"] #udv2SellersTab')).toHaveCount(1);
  await expect(page.locator('script[data-updown-admin-src]')).toHaveCount(9);
  await expect(page.locator('script[data-updown-admin-src*="updown-inventory-nav.js"]')).toHaveCount(0);
  expect(await page.evaluate(()=>'__UPDOWN_ADMIN_NAV_V2__' in window)).toBe(false);
  await nav.locator('[data-sidebar-section="commercial"] summary').click();
  await nav.locator('#udv2SellersTab').click();
  await expect(page.locator('#udv2SellersView')).toBeVisible();
  await expect(page.locator('#udv2ContentView')).toBeHidden();
  await nav.locator('[data-sidebar-section="products"] summary').click();
  await nav.locator('#udProductsTab').click();
  await expect(page.locator('#udProductsView')).toBeVisible();
  const events=await (await request.get(`${fixture}/__events`)).json() as Array<{path:string,method:string}>;
  expect(events.filter(e=>['PATCH','PUT','DELETE'].includes(e.method))).toHaveLength(0);
});

test('A10.3 ADMIN initialization never creates orphan variants or adjusts stock',async({page,request})=>{
  await configure(request,{orphanReviewFixture:true});
  await login(page);await ready(page);
  type EventRow={path:string,method:string,query:string};
  const events=async()=>await (await request.get(`${fixture}/__events`)).json() as EventRow[];
  const forbidden=(rows:EventRow[])=>rows.filter(e=>
    /\/rest\/v1\/rpc\/(admin_inventory_save_variant|admin_inventory_adjust)$/.test(e.path)||
    ['PATCH','PUT','DELETE'].includes(e.method));
  expect(forbidden(await events())).toHaveLength(0);
  // Even the historical delayed post-submit window must remain quiet.
  await page.locator('#udProductForm').evaluate(form=>form.dispatchEvent(new Event('submit',{bubbles:true,cancelable:true})));
  await page.waitForTimeout(4400);
  expect(forbidden(await events())).toHaveLength(0);
  expect((await events()).filter(e=>e.query.includes('id,name,sku,stock,price,sale_price,status'))).toHaveLength(0);
});

test('A10.3 manual review identifies orphan products without any inventory write',async({page,request})=>{
  await configure(request,{orphanReviewFixture:true});
  await login(page);await ready(page);
  await page.goto('/admin/inventario');
  await expect(page.locator('.inv-tablebox tbody tr')).toHaveCount(4);
  const region=page.getByRole('region',{name:'Conciliación de inventario y POS'});
  const events=async()=>await (await request.get(`${fixture}/__events`)).json() as Array<{path:string,method:string}>;
  expect((await events()).filter(e=>e.path==='/rest/v1/rpc/admin_inventory_save_variant')).toHaveLength(0);
  await region.getByRole('button',{name:'Conciliar con POS'}).click();
  const detail=region.getByText('Productos sin variantes · revisión manual (1)');
  await expect(detail).toBeVisible();
  await detail.click();
  await expect(region).toContainText('Producto huérfano sintético');
  await expect(region).toContainText('Existencia padre 3');
  await expect(region).toContainText('cotejar historial, POS y variantes');
  expect((await events()).filter(e=>e.path==='/rest/v1/rpc/admin_inventory_save_variant'||
    e.path==='/rest/v1/rpc/admin_inventory_adjust'||['PATCH','PUT','DELETE'].includes(e.method))).toHaveLength(0);
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
