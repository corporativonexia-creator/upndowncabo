import { expect, test, type Page } from '@playwright/test';

// Runs only against the fixture-backed, locally served app: no production Supabase calls.
const fixture = 'http://127.0.0.1:4319';

async function signInToPreview(page: Page) {
  await page.goto('/vista-previa');
  await expect(page).toHaveURL(/\/login\?next=/);
  await page.locator('[name=email]').fill('admin@example.test');
  await page.locator('[name=password]').fill('fixture-password');
  await page.getByRole('button', { name: 'Entrar', exact: true }).click();
  await expect(page).toHaveURL(/\/vista-previa\/?$/);
  await expect(page.locator('#updown-store')).toBeVisible();
}

test.beforeEach(async ({ page, request }) => {
  await request.post(`${fixture}/__reset`, { data: {} });
  await page.route('https://**/*', route => route.abort());
});

test('mobile portrait: menu and intelligent search open and close on the first tap', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name.endsWith('desktop'));
  await page.setViewportSize({ width: 390, height: 844 });
  await signInToPreview(page);
  const menu = page.locator('.uds-native-menu-trigger');
  const dialog = page.locator('#udsNativeMenuDialog');
  await expect(menu).toBeVisible();
  await menu.click();
  await expect(dialog).toHaveAttribute('open', '');
  await expect(menu).toHaveAttribute('aria-expanded', 'true');
  await dialog.locator('.uds-native-menu-head button').click();
  await expect(dialog).not.toHaveAttribute('open', '');
  await expect(menu).toHaveAttribute('aria-expanded', 'false');
  await page.locator('.uds-native-mobile-actions button[aria-label*="Buscar"]').click();
  await expect(page.locator('.uds-search-panel')).toHaveAttribute('open', '');
  await page.locator('.uds-search-dismiss').click();
  await expect(page.locator('.uds-search-panel')).not.toHaveAttribute('open', '');
});

test('mobile landscape: menu and product dialog close remain inside viewport', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name.endsWith('desktop'));
  await page.setViewportSize({ width: 844, height: 390 });
  await signInToPreview(page);
  const menu = page.locator('.uds-native-menu-trigger');
  await expect(menu).toBeVisible();
  await menu.click();
  const dialog = page.locator('#udsNativeMenuDialog');
  await expect(dialog).toHaveAttribute('open', '');
  await dialog.locator('.uds-native-menu-head button').click();
  await expect(dialog).not.toHaveAttribute('open', '');

  // CSS-only modal geometry check, intentionally no fabricated purchase or catalog data.
  await page.evaluate(() => {
    const modal = document.getElementById('udsModal');
    modal?.classList.add('is-open');
    modal?.setAttribute('aria-hidden', 'false');
  });
  const close = page.locator('#udsCloseModal');
  await expect(close).toBeVisible();
  const bounds = await close.boundingBox();
  expect(bounds).not.toBeNull();
  expect(bounds!.x).toBeGreaterThanOrEqual(0);
  expect(bounds!.y).toBeGreaterThanOrEqual(0);
  expect(bounds!.x + bounds!.width).toBeLessThanOrEqual(845);
  expect(bounds!.y + bounds!.height).toBeLessThanOrEqual(391);
});

test('desktop: storefront and product controls render without mobile header', async ({ page }, testInfo) => {
  test.skip(!testInfo.project.name.endsWith('desktop'));
  await signInToPreview(page);
  await expect(page.locator('.uds-native-mobile-header')).toHaveCount(0);
  await expect(page.locator('#udsCatalog')).toBeAttached();
  await expect(page.locator('#udsModal')).not.toBeVisible();
  await expect(page.locator('#udsCart')).toBeAttached();
});
