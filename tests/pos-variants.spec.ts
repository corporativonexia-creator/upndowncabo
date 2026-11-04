import { test, expect, type Page } from '@playwright/test';
async function openPos(page: Page) {
  await page.route('https://**/*', route => route.abort());
  await page.route('**/api/pos/login', async route => {
    const response = await page.request.post('http://127.0.0.1:4319/auth/v1/token',{data:{password:'fixture-password'}});
    await route.fulfill({json:await response.json()});
  });
  await page.goto('/pos');
  await page.locator('[name=employee]').fill('QA01');
  await page.locator('[name=password]').fill('fixture-password');
  await page.getByRole('button',{name:'Entrar',exact:true}).click();
  await expect(page.locator('.pos-product')).toHaveCount(3);
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
  const calls=events.filter((e:{path:string})=>e.path.endsWith('/pos_create_sale'));
  expect(calls).toHaveLength(1);expect(calls[0].body.p_items).toEqual([{product_id:'p1',variant_id:'v2',quantity:2}]);
  expect(calls[0].body.p_payments[0].amount).toBe(950);
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
