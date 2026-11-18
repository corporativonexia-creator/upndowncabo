import { test, expect } from "@playwright/test";

const FIXTURE = "http://127.0.0.1:4319";
// Fail closed: never run a browser fixture against a live Supabase URL.
if (process.env.NEXT_PUBLIC_SUPABASE_URL !== FIXTURE ||
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY !== "fixture-publishable-key" ||
    process.env.NEXT_PUBLIC_ENABLE_LEGACY_CHECKOUT !== "false") {
  throw new Error("Premium release QA requires loopback Supabase and disabled checkout");
}

test.beforeEach(async ({ page, request }) => {
  const reset = await request.post(FIXTURE + "/__reset", { data: {} });
  expect(reset.ok()).toBe(true);
  // Browser requests must never escape the two local fixture servers.
  await page.route("**/*", async route => {
    const url = new URL(route.request().url());
    if (url.hostname === "127.0.0.1" && ["4319", "4320"].includes(url.port)) {
      await route.continue();
    } else {
      await route.abort();
    }
  });
});

async function signInToPreview(page: import("@playwright/test").Page) {
  await page.goto("/vista-previa");
  await expect(page).toHaveURL(/\/login\?next=/);
  await page.locator('[name="email"]').fill("admin@example.test");
  await page.locator('[name="password"]').fill("fixture-password");
  await page.getByRole("button", { name: "Entrar", exact: true }).click();
  await expect(page).toHaveURL(/\/vista-previa(?:\?|$)/);
  await waitForCurrentCatalog(page);
}

async function waitForCurrentCatalog(page: import("@playwright/test").Page) {
  await page.waitForFunction(() => {
    const w = window as Window & {
      __UPDOWN_PARITY_BOOTED__?: boolean;
      __UPDOWN_SEARCH_STATUS__?: string;
    };
    const button = document.querySelector<HTMLButtonElement>("#udsPreviewViewList");
    const grid = document.querySelector("#udsGrid");
    return w.__UPDOWN_PARITY_BOOTED__ === true
      && w.__UPDOWN_SEARCH_STATUS__ === "ready"
      && button?.isConnected === true && grid?.isConnected === true;
  }, null, { timeout: 25_000 });
}

async function assertView(page: import("@playwright/test").Page, view: "list" | "grid") {
  const list = page.locator("#udsPreviewViewList");
  const grid = page.locator("#udsGrid");
  const isList = view === "list";
  await expect(grid).toHaveClass(isList ? /uds-preview-list/ : /uds-preview-gallery/);
  await expect(grid).not.toHaveClass(isList ? /uds-preview-gallery/ : /uds-preview-list/);
  await expect(list).toHaveAttribute("aria-pressed", String(isList));
  expect(await page.evaluate(() => localStorage.getItem("upDownPreviewCatalogView")))
    .toBe(isList ? "lista" : "galeria");
  expect(new URL(page.url()).searchParams.get("vista"))
    .toBe(isList ? "lista" : null);
}

test("main remains closed and unauthenticated preview remains private", async ({ page }) => {
  await page.goto("/");
  await expect(page).toHaveURL(/\/proximamente(?:\?|$)/);
  await page.goto("/vista-previa");
  await expect(page).toHaveURL(/\/login\?next=/);
});

test("twenty accumulated 760 to 1024 to 1440 transitions keep gallery/list bound", async ({ page, request }) => {
  test.setTimeout(240_000);
  await page.setViewportSize({ width: 760, height: 900 });
  await request.post(FIXTURE + "/__options", { data: { productDelay: 125 } });
  const errors: string[] = [];
  page.on("pageerror", error => errors.push(error.message));
  await signInToPreview(page);

  for (let cycle = 1; cycle <= 20; cycle++) {
    await page.setViewportSize({ width: 760, height: 900 });
    await expect(page.locator('[data-storefront-ux="mobile"]')).toBeVisible();

    await page.setViewportSize({ width: 1024, height: 900 });
    await expect(page.locator('[data-storefront-ux="desktop"]')).toBeVisible();

    // Moving again while RPCs are in flight was the reported failure sequence.
    await page.setViewportSize({ width: 1440, height: 900 });
    await waitForCurrentCatalog(page);
    await page.locator("#udsPreviewViewGrid").click();
    await assertView(page, "grid");
    await page.locator("#udsPreviewViewList").click();
    await assertView(page, "list");

    // Previous-language async callbacks must not restore an older gallery.
    await page.evaluate(() => window.dispatchEvent(new Event("updown:copy-ready")));
    await assertView(page, "list");

    await page.locator("#udsPreviewViewGrid").click();
    await assertView(page, "grid");
    console.log("PASS viewport transition " + cycle + "/20");
  }
  expect(errors).toEqual([]);
});

test("small-screen views and ES/EN stay functional after responsive transitions", async ({ page }) => {
  test.setTimeout(120_000);
  await page.setViewportSize({ width: 390, height: 844 });
  await signInToPreview(page);
  for (const width of [320, 390, 760, 1024, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    await waitForCurrentCatalog(page);
    await page.locator("#udsPreviewViewList").click();
    await assertView(page, "list");
    await page.locator("#udsPreviewViewGrid").click();
    await assertView(page, "grid");
  }
  await page.locator("#udsLangEn").click();
  await expect(page.locator("#udsPreviewViewList")).toBeVisible();
  await page.locator("#udsPreviewViewList").click();
  await assertView(page, "list");
  await page.reload();
  await waitForCurrentCatalog(page);
  await assertView(page, "list");
});
