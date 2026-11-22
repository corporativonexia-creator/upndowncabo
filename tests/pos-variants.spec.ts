import { test, expect, type Page } from '@playwright/test';
async function openPos(page: Page, count = 3) {
  await page.route('https://**/*', route => route.abort());
  await page.route('**/api/pos/login', async route => {
    const response = await page.request.post('http://127.0.0.1:4319/auth/v1/token',{data:{password:'fixture-password'}});
    await route.fulfill({json:await response.json()});
  });
  await page.goto('/pos');
  await page.locator('[name=employee]').fill('QA01');
  await page.locator('[name=password]').fill('fixture-password');
  await page.getByRole('button',{name:'Entrar',exact:true}).click();
  await expect(page.locator('.pos-product')).toHaveCount(count);
}
test.beforeEach(async({request})=>{
  await request.post('http://127.0.0.1:4319/__reset',{data:{}});
  await request.post('http://127.0.0.1:4319/__options',{data:{posFixture:true}});
});
test('search, scan twice, charge exact variant and refresh its stock',async({page,request})=>{
  await openPos(page);
  await expect(page.locator('.pos-product').filter({hasText:'Driver'})).toHaveCount(0);
  const variant=page.locator('.pos-product').filter({hasText:'ROP-001-XXL'});
  await expect(variant).toContainText('475.00');
  await expect(variant.locator('img')).toHaveAttribute('src','http://127.0.0.1:4319/variant.png');
  const search=page.getByPlaceholder('Escanea código o busca producto, SKU, marca o modelo…');
  await search.fill('XXL');await expect(page.locator('.pos-product')).toHaveCount(1);
  await search.fill('2000000000053');await search.press('Enter');
  await search.fill('2000000000053');await search.press('Enter');
  await page.getByText('Efectivo recibido',{exact:true}).locator('..').locator('input').fill('1000');
  await page.getByRole('button',{name:/COBRAR/}).click();
  await expect(page.getByText(/Venta #1 cobrada/)).toBeVisible();
  const events=await (await request.get('http://127.0.0.1:4319/__events')).json();
  const calls=events.filter((e:{path:string})=>e.path.endsWith('/pos_create_sale_v22'));
  expect(calls).toHaveLength(1);expect(calls[0].body.p_items).toEqual([{product_id:'p1',variant_id:'v2',quantity:2}]);
  expect(calls[0].body.p_payments[0].amount).toBe(950);
  expect(calls[0].body.p_discount_amount).toBe(0);
  expect(calls[0].body.p_promo_approval_token).toBeNull();
  expect(calls[0].body.p_payments[0].metadata.pos_request_id).toMatch(/^[\da-f-]{36}$/);
  await expect(variant).toContainText('Stock: 3');
  await expect(page.locator('.pos-product').filter({hasText:'ROP-001-XS'})).toContainText('Stock: 5');
});
test('out-of-stock variant cannot be added by scan or button',async({page,request})=>{
  await request.post('http://127.0.0.1:4319/__options',{data:{zeroStock:true}});
  await openPos(page);
  const variant=page.locator('.pos-product').filter({hasText:'ROP-001-XS'});
  await expect(variant.getByRole('button')).toBeDisabled();
  const search=page.getByPlaceholder('Escanea código o busca producto, SKU, marca o modelo…');
  await search.fill('2000000000046');await search.press('Enter');
  await expect(page.getByText(/está agotado/)).toBeVisible();
  await expect(page.getByRole('button',{name:/COBRAR/})).toBeDisabled();
});

test('compact header holds shift metrics above the scanner, and mobile cart jump stays accessible',async({page})=>{
  await page.setViewportSize({width:390,height:844});
  await openPos(page);
  const scanner=page.locator('#posQuickSearch');
  await expect(scanner).toBeVisible();
  await expect(page.locator('.pos-header-summary')).toContainText('Ventas del turno');
  const scannerBox=await scanner.boundingBox();
  const summaryBox=await page.locator('.pos-header-summary').boundingBox();
  expect(summaryBox?.y).toBeLessThan(scannerBox?.y??Infinity);
  await page.locator('.pos-product').first().getByRole('button',{name:/Agregar/}).click();
  const cartJump=page.getByRole('button',{name:/Ver carrito/});
  await expect(cartJump).toBeVisible();
  await cartJump.click();
  await expect(page.locator('#posCartPanel')).toBeFocused();
});

test('cart stays visible beside shift activity and cash movements while scrolling',async({page})=>{
  await page.setViewportSize({width:1280,height:720});
  await openPos(page);
  await page.locator('.pos-product').first().getByRole('button',{name:/Agregar/}).click();
  await expect(page.locator('.pos-workflow-ops .pos-history')).toBeVisible();
  await expect(page.locator('.pos-workflow-ops .pos-cash-tools')).toBeVisible();
  const cart=page.locator('#posCartPanel');
  await page.locator('.pos-cash-tools').scrollIntoViewIfNeeded();
  const box=await cart.boundingBox();
  expect(box).not.toBeNull();
  expect(box!.y).toBeGreaterThanOrEqual(0);
  expect(box!.y).toBeLessThan(80);
  expect(box!.height).toBeLessThanOrEqual(720);
  await expect(cart.getByRole('button',{name:/COBRAR/})).toBeVisible();
});

test('a ready workshop reception selects the service parent despite its Única variant',async({page,request})=>{
  await request.post('http://127.0.0.1:4319/__options',{data:{posServiceFixture:true,receptionFixture:true}});
  await openPos(page,4);
  await page.getByRole('button',{name:'Servicios',exact:true}).click();
  await expect(page.locator('.pos-product')).toHaveCount(1);
  await expect(page.locator('.pos-product')).toContainText('Cambio de grip');
  await page.locator('#posServiceFolio').fill('SR-000129');
  await page.getByRole('button',{name:'Cargar recepción'}).click();
  await expect(page.getByText(/Recepción SR000129 cargada/)).toBeVisible();
  await expect(page.locator('.pos-cart-item')).toContainText('Cambio de grip');
});

test('a standalone service sends a parent ID and an explicit free price',async({page,request})=>{
  await request.post('http://127.0.0.1:4319/__options',{data:{posServiceFixture:true}});
  await openPos(page,4);
  await page.getByRole('button',{name:'Servicios',exact:true}).click();
  await page.locator('.pos-product').getByRole('button',{name:/Agregar Cambio de grip/}).click();
  await page.getByText('Precio libre del servicio (MXN)',{exact:true}).locator('..').locator('input').fill('385');
  await page.getByText('Efectivo recibido',{exact:true}).locator('..').locator('input').fill('400');
  await page.getByRole('button',{name:/COBRAR/}).click();
  await expect(page.getByText(/Venta #1 cobrada/)).toBeVisible();
  const events=await (await request.get('http://127.0.0.1:4319/__events')).json();
  const call=events.find((event:{path:string})=>event.path.endsWith('/pos_create_sale_v22'));
  expect(call.body.p_items).toEqual([{product_id:'service-qa',quantity:1,service_unit_price:385}]);
});

test('a confirmed sale never becomes SALE_ERROR when history refresh fails',async({page,request})=>{
  await request.post('http://127.0.0.1:4319/__options',{data:{postCheckoutHistoryError:true}});
  await openPos(page);
  await page.locator('.pos-product').filter({hasText:'ROP-001-XXL'}).getByRole('button',{name:/Agregar/}).click();
  await page.getByText('Efectivo recibido',{exact:true}).locator('..').locator('input').fill('1000');
  await page.getByRole('button',{name:/COBRAR/}).click();
  const confirmed=page.getByRole('alert').filter({hasText:'Venta #1 cobrada'});
  await expect(confirmed).toBeVisible();
  await expect(confirmed).toContainText('no vuelvas a cobrar');
  await expect(page.getByText(/SALE_ERROR/)).toHaveCount(0);
  const events=await (await request.get('http://127.0.0.1:4319/__events')).json();
  expect(events.filter((event:{path:string})=>event.path.endsWith('/pos_create_sale_v22'))).toHaveLength(1);
});

test('unconfirmed sale keeps the cart and prompts to check history before retry',async({page,request})=>{
  await request.post('http://127.0.0.1:4319/__options',{data:{posSaleError:true}});
  await openPos(page);
  await page.locator('.pos-product').filter({hasText:'ROP-001-XXL'}).getByRole('button',{name:/Agregar/}).click();
  await page.getByText('Efectivo recibido',{exact:true}).locator('..').locator('input').fill('1000');
  await page.getByRole('button',{name:/COBRAR/}).click();
  const unconfirmed=page.locator('.pos-checkout-feedback[role="alert"]');
  await expect(unconfirmed).toContainText('No pudimos confirmar el resultado de la venta');
  await expect(unconfirmed).toContainText('Revisa Ventas del turno');
  await expect(page.locator('.pos-cart-item')).toHaveCount(1);
});
