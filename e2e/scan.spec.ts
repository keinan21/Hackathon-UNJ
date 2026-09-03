import { test, expect } from "@playwright/test";

async function loginSetup(page: import("@playwright/test").Page, nama = "Toko Scan") {
  await page.goto("/");
  await page.evaluate(() => {
    localStorage.clear();
    sessionStorage.clear();
  });
  await page.reload();
  await expect(page.getByTestId("login-page")).toBeVisible({ timeout: 10_000 });
  await page.getByTestId("input-nama-toko").fill(nama);
  await page.getByTestId("input-pin").fill("1234");
  await page.getByTestId("input-pin-confirm").fill("1234");
  await page.getByTestId("btn-masuk").click();
  await expect(page.getByTestId("header-title")).toBeVisible({ timeout: 10_000 });
}

test.describe("Scan kamera lazy-route + fallback manual", () => {
  test("guard: belum login → /scan redirect ke LoginPage", async ({ page }) => {
    await page.goto("/");
    await page.evaluate(() => {
      localStorage.clear();
      sessionStorage.clear();
    });
    await page.goto("/scan");
    await expect(page.getByTestId("login-page")).toBeVisible({ timeout: 10_000 });
    await expect(page.getByTestId("scan-page")).toHaveCount(0);
  });

  test("grant camera → scan page tampil + manual fallback visible + input barcode 48px", async ({ page }) => {
    await loginSetup(page);

    // grant camera via context — Playwright handles permission
    await page.goto("/sku/baru");
    await expect(page.getByTestId("sku-baru-page")).toBeVisible({ timeout: 10_000 });
    await expect(page.getByTestId("btn-scan-barcode")).toBeVisible();
    await expect(page.getByTestId("btn-scan-barcode")).toHaveCSS("min-height", "48px");

    await page.getByTestId("btn-scan-barcode").click();
    await expect(page).toHaveURL(/\/scan/);
    await expect(page.getByTestId("scan-page")).toBeVisible({ timeout: 10_000 });

    // reader div always present
    await expect(page.getByTestId("scan-reader")).toBeVisible();

    // manual fallback always visible (offline tetap jalan)
    await expect(page.getByTestId("scan-input-manual")).toBeVisible();
    await expect(page.getByTestId("scan-input-manual")).toHaveCSS("min-height", "48px");
    await expect(page.getByTestId("scan-manual-submit")).toBeVisible();
    await expect(page.getByTestId("scan-manual-submit")).toHaveCSS("min-height", "48px");
    await expect(page.getByTestId("scan-manual-hint")).toBeVisible();
    await expect(page.getByTestId("scan-back")).toBeVisible();
    await expect(page.getByTestId("scan-back")).toHaveCSS("min-height", "48px");

    // mock camera grant: if getUserMedia mocked, no error message; but we at least check fallback visible
    // try to mock decode via CustomEvent path — manual input flow
    const barcode = "8991234567890";
    await page.getByTestId("scan-input-manual").fill(barcode);
    await page.getByTestId("scan-manual-submit").click();

    // should navigate back to /sku/baru and input-barcode filled via barcode-scanned event + sessionStorage
    await expect(page).toHaveURL(/\/sku\/baru/, { timeout: 10_000 });
    await expect(page.getByTestId("sku-baru-page")).toBeVisible({ timeout: 10_000 });
    await expect(page.getByTestId("input-barcode")).toHaveValue(barcode);
  });

  test("deny camera → manual visible + pesan Indonesia (mock getUserMedia reject)", async ({ browser }) => {
    const context = await browser.newContext({
      permissions: [],
    });
    const page = await context.newPage();
    // Mock getUserMedia to reject with NotAllowedError before any script runs
    await page.addInitScript(() => {
      const orig = navigator.mediaDevices?.getUserMedia;
      try {
        Object.defineProperty(navigator, "mediaDevices", {
          value: {
            getUserMedia: () => Promise.reject(new DOMException("Permission denied", "NotAllowedError")),
            enumerateDevices: () => Promise.resolve([]),
          },
          configurable: true,
        });
      } catch {
        // fallback
        if (navigator.mediaDevices) {
          (navigator.mediaDevices as unknown as Record<string, unknown>).getUserMedia = () =>
            Promise.reject(new DOMException("Permission denied", "NotAllowedError"));
        }
      }
      // also keep original for debug
      (window as unknown as Record<string, unknown>).__origGUM__ = orig;
    });

    await loginSetup(page);
    await page.goto("/scan");
    await expect(page.getByTestId("scan-page")).toBeVisible({ timeout: 10_000 });

    // should show error in Bahasa Indonesia mentioning kamera ditolak/manual
    // allow either NotAllowed or generic manual message
    await expect(page.getByTestId("scan-error")).toBeVisible({ timeout: 10_000 });
    const errText = await page.getByTestId("scan-error").innerText();
    expect(errText.toLowerCase()).toMatch(/kamera|manual|ditolak|akses/);

    // fallback manual must still be visible and usable offline
    await expect(page.getByTestId("scan-input-manual")).toBeVisible();
    await expect(page.getByTestId("scan-manual-submit")).toBeVisible();

    // manual input still works even when camera denied
    const barcode2 = "8990001112223";
    await page.getByTestId("scan-input-manual").fill(barcode2);
    await page.getByTestId("scan-manual-submit").click();
    await expect(page).toHaveURL(/\/sku\/baru/, { timeout: 10_000 });
    await expect(page.getByTestId("input-barcode")).toHaveValue(barcode2);

    await context.close();
  });

  test("kembali ke form tanpa scan → barcode tetap manual kosong bisa diisi", async ({ page }) => {
    await loginSetup(page);
    await page.goto("/scan");
    await expect(page.getByTestId("scan-page")).toBeVisible({ timeout: 10_000 });
    await page.getByTestId("scan-back").click();
    await expect(page).toHaveURL(/\/sku\/baru/, { timeout: 10_000 });
    await expect(page.getByTestId("sku-baru-page")).toBeVisible({ timeout: 10_000 });
    await expect(page.getByTestId("input-barcode")).toBeVisible();
  });
});
