import { test, expect, type Page, type APIRequestContext } from '@playwright/test';
const fixture='http://127.0.0.1:4319';
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
  await configure(request,{summaryError:true});await login(page);await ready(page);
  await expect(page.getByRole('button',{name:'Reintentar variantes'})).toBeVisible();
  await page.locator('#udCatalogSearch').fill('Marca aguila');await expect(card(page,'p1')).toBeVisible();
  await configure(request,{summaryError:false});await page.getByRole('button',{name:'Reintentar variantes'}).click();
  await page.locator('#udCatalogSearch').fill('2000000000046');await expect(card(page,'p1')).toBeVisible();
});

test('script parse failure is surfaced by the loader instead of an eternal spinner',async({page})=>{
  await page.route('**/updown-admin-legacy-runtime.js?*',route=>route.fulfill({contentType:'application/javascript',body:'const broken = ;'}));
  await login(page);await expect(page.locator('#udList [role=alert]')).toContainText('No se pudo iniciar');
  await expect(page.getByRole('button',{name:'Reintentar inicio'})).toBeVisible();
});

test('mobile catalog can filter and open the product editor',async({page})=>{
  await page.setViewportSize({width:390,height:844});await login(page);await ready(page);
  await page.locator('#udCatalogSearch').fill('Driver');await card(page,'p3').locator('.ud-edit').click();
  await expect(page.locator('#udName')).toHaveValue('Driver');await expect(page.locator('#udOnlineVisible')).toHaveValue('online');
});
