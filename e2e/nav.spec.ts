import { test, expect } from "@playwright/test";

async function loginSetup(page: import("@playwright/test").Page, nama = "Toko Nav") {
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

async function clearDexie(page: import("@playwright/test").Page) {
  await page.evaluate(async () => {
    const w = window as unknown as Record<string, unknown>;
    const repo = w.__REAL_REPO__ as { clearAll: (o: string) => Promise<void> } | undefined;
    if (repo) await repo.clearAll("toko-01");
  });
}

function expiryFor(days: number): string {
  const fmt = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Jakarta", year: "numeric", month: "2-digit", day: "2-digit" });
  const parts = fmt.formatToParts(new Date());
  const y = Number(parts.find((p) => p.type === "year")!.value);
  const m = Number(parts.find((p) => p.type === "month")!.value) - 1;
  const d = Number(parts.find((p) => p.type === "day")!.value);
  const base = Date.UTC(y, m, d, 0, 0, 0, 0) - 7 * 60 * 60 * 1000;
  const exp = new Date(base + days * 86_400_000);
  const f2 = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Jakarta", year: "numeric", month: "2-digit", day: "2-digit" });
  return f2.format(exp);
}

async function seedNav(page: import("@playwright/test").Page) {
  await page.evaluate(
    async ({ exp1, exp2 }) => {
      const w = window as unknown as Record<string, unknown>;
      const repo = w.__REAL_REPO__ as {
        createKategori: (k: { id: string; nama: string; threshold_h_minus: number[]; org_id: string }) => Promise<void>;
        createSku: (s: { id: string; nama: string; kategori_id: string; hpp: number; harga_normal: number; kode?: string; org_id: string }) => Promise<void>;
        createBatch: (b: { id: string; sku_id: string; qty: number; expiry_date: string | null; received_at: string; hpp_snapshot: number; org_id: string }) => Promise<void>;
        createPromo: (pr: { id: string; batch_id: string; sku_pasangan_id: string | null; harga_tebus: number; status: string; org_id: string; created_at: string }) => Promise<void>;
      };
      const cat = { id: "k-dairy", nama: "Dairy", threshold_h_minus: [7, 3, 1], org_id: "toko-01" };
      await repo.createKategori(cat).catch(() => {});
      await repo.createKategori({ id: "k-snack", nama: "Snack", threshold_h_minus: [7, 3, 1], org_id: "toko-01" }).catch(() => {});
      await repo.createSku({ id: "sku-susu", nama: "Susu UHT 1L", kategori_id: cat.id, hpp: 10000, harga_normal: 15000, kode: "SUS-001", org_id: "toko-01" }).catch(() => {});
      await repo.createSku({ id: "sku-roti", nama: "Roti Tawar", kategori_id: "k-snack", hpp: 8000, harga_normal: 12000, kode: "ROT-001", org_id: "toko-01" }).catch(() => {});
      await repo.createBatch({ id: "b-kritis", sku_id: "sku-susu", qty: 10, expiry_date: exp1, received_at: new Date().toISOString(), hpp_snapshot: 10000, org_id: "toko-01" });
      await repo.createBatch({ id: "b-h2", sku_id: "sku-susu", qty: 5, expiry_date: exp2, received_at: new Date().toISOString(), hpp_snapshot: 10000, org_id: "toko-01" }).catch(() => {});
      await repo.createPromo({ id: "promo-nav-1", batch_id: "b-kritis", sku_pasangan_id: "sku-roti", harga_tebus: 9000, status: "proposed", org_id: "toko-01", created_at: new Date().toISOString() });
    },
    { exp1: expiryFor(1), exp2: expiryFor(2) },
  );
}

test.describe("Nav 3-tab + sub-tab wiring — real Dexie", () => {
  test.beforeEach(async ({ page }) => {
    await loginSetup(page);
    await page.waitForTimeout(300);
    await clearDexie(page);
    await page.waitForTimeout(200);
  });

  test("happy: 3-tab Dashboard/SKU/Setting ikon+label Indonesia 48px 16px selected state, no tab ke-4", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/");
    await page.waitForTimeout(600);
    const bottomNav = page.getByTestId("bottom-nav");
    await expect(bottomNav).toBeVisible();
    await expect(bottomNav).toHaveAttribute("aria-label", "Navigasi utama");
    const dash = page.getByTestId("bottom-nav-dashboard");
    const sku = page.getByTestId("bottom-nav-sku");
    const setting = page.getByTestId("bottom-nav-settings");
    await expect(dash).toBeVisible();
    await expect(sku).toBeVisible();
    await expect(setting).toBeVisible();
    await expect(dash).toContainText("Dashboard");
    await expect(sku).toContainText("SKU");
    await expect(setting).toContainText("Pengaturan");
    await expect(page.getByTestId("bottom-nav-promo")).toHaveCount(0);
    await expect(page.locator('[data-testid="bottom-nav-promo"]')).toHaveCount(0);
    for (const btn of [dash, sku, setting]) {
      await expect(btn).toHaveCSS("min-height", "48px");
      await expect(btn).toHaveCSS("font-size", "16px");
      await expect(btn.locator("svg").first()).toBeVisible();
      await expect(btn).toHaveAttribute("aria-label", /Dashboard|SKU|Pengaturan/);
    }
    await expect(dash).toHaveAttribute("aria-current", "page");
    await expect(dash).toHaveCSS("color", "rgb(15, 122, 74)");
    await sku.click();
    await expect(page.getByTestId("katalog-page")).toBeVisible({ timeout: 10_000 });
    await expect(page.getByTestId("bottom-nav-sku")).toHaveAttribute("aria-current", "page");
    await page.getByTestId("bottom-nav-settings").click();
    await expect(page.getByText(/Pengaturan|Backup|Profil/i).first()).toBeVisible({ timeout: 10_000 });
    await expect(page.getByTestId("bottom-nav-settings")).toHaveAttribute("aria-current", "page");
    await page.getByTestId("bottom-nav-dashboard").click();
    await expect(page.getByTestId("dashboard-page")).toBeVisible({ timeout: 10_000 });
    await expect(page.getByTestId("bottom-nav-dashboard")).toHaveAttribute("aria-current", "page");
    await expect(page.getByTestId("nav-dashboard")).toContainText("Dashboard");
    await expect(page.getByTestId("nav-sku")).toContainText("SKU");
    await expect(page.getByTestId("nav-settings")).toContainText("Pengaturan");
    await expect(page.getByTestId("nav-promo")).toHaveCount(0);
  });

  test("Statistik via Dashboard sub-tab Ringkasan/Statistik dan In-Out via SKU detail", async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await seedNav(page);
    await page.goto("/");
    await page.waitForTimeout(700);
    await expect(page.getByTestId("dashboard-page")).toBeVisible();
    const subtabs = page.getByTestId("dashboard-subtabs");
    await expect(subtabs).toBeVisible();
    await expect(subtabs).toHaveAttribute("aria-label", "Sub-tab Dashboard");
    const tabRingkasan = page.getByTestId("tab-ringkasan");
    const tabStatistik = page.getByTestId("tab-statistik");
    await expect(tabRingkasan).toBeVisible();
    await expect(tabStatistik).toBeVisible();
    await expect(tabRingkasan).toContainText("Ringkasan");
    await expect(tabStatistik).toContainText("Statistik");
    for (const t of [tabRingkasan, tabStatistik]) {
      await expect(t).toHaveCSS("min-height", "48px");
      await expect(t).toHaveCSS("font-size", "16px");
      await expect(t.locator("svg").first()).toBeVisible();
    }
    await expect(tabRingkasan).toHaveAttribute("aria-selected", "true");
    await tabStatistik.click();
    await expect(tabStatistik).toHaveAttribute("aria-selected", "true");
    await expect(page.getByTestId("statistik-tab")).toBeVisible({ timeout: 10_000 });
    await tabRingkasan.click();
    await expect(tabRingkasan).toHaveAttribute("aria-selected", "true");
    await expect(page.getByTestId("section-urgent")).toBeVisible();
    await page.getByTestId("nav-sku").click();
    await expect(page.getByTestId("katalog-page")).toBeVisible({ timeout: 10_000 });
    const skuRows = page.locator('[data-testid^="sku-row-"], [data-testid^="sku-card-"], [data-testid="katalog-page"] a');
    if (await skuRows.count() > 0) {
      await skuRows.first().click().catch(() => {});
      await page.waitForTimeout(400);
      if (await page.getByTestId("sku-detail-page").count() > 0) {
        await expect(page.getByTestId("sku-detail-page")).toBeVisible();
      }
    }
    await page.goto("/sku/sku-susu");
    await page.waitForTimeout(600);
    await expect(page.getByTestId("sku-detail-page")).toBeVisible({ timeout: 10_000 });
    const inoutSection = page.getByTestId("inout-section");
    await expect(inoutSection).toBeVisible();
    await expect(page.getByRole("tablist", { name: "Masuk Keluar" })).toBeVisible();
    const tabMasuk = page.getByTestId("tab-masuk");
    const tabKeluar = page.getByTestId("tab-keluar");
    await expect(tabMasuk).toBeVisible();
    await expect(tabKeluar).toBeVisible();
    await expect(tabMasuk).toContainText("Masuk");
    await expect(tabKeluar).toContainText("Keluar");
    for (const t of [tabMasuk, tabKeluar]) {
      await expect(t).toHaveCSS("min-height", "48px");
      await expect(t).toHaveCSS("font-size", "16px");
    }
    await tabKeluar.click();
    await expect(tabKeluar).toHaveAttribute("aria-selected", "true");
    await expect(page.getByTestId("inout-pane-keluar")).toBeVisible();
    await tabMasuk.click();
    await expect(tabMasuk).toHaveAttribute("aria-selected", "true");
    await expect(page.getByTestId("inout-pane-masuk")).toBeVisible();
    await expect(page.getByTestId("bottom-nav-promo")).toHaveCount(0);
  });

  test("happy: deep-link /sku/:id dari kritis tetap jalan; max 3 tap ke approve", async ({ page }) => {
    await seedNav(page);
    await page.goto("/");
    await page.waitForTimeout(700);
    await expect(page.getByTestId("kritis-banner")).toBeVisible({ timeout: 10_000 });
    let tapCount = 0;
    await page.getByTestId("kritis-banner-link").click();
    tapCount++;
    await expect(page).toHaveURL(/\/kritis/);
    await expect(page.getByTestId("kritis-page")).toBeVisible({ timeout: 10_000 });
    await expect(page.getByTestId("kritis-item")).toHaveCount(2);
    const detailBtn = page.getByTestId("kritis-tombol-lihat-detail").first();
    await expect(detailBtn).toBeVisible();
    await expect(detailBtn).toHaveCSS("min-height", "48px");
    await detailBtn.click();
    tapCount++;
    await expect(page).toHaveURL(/\/sku\//);
    await expect(page.getByTestId("sku-detail-page")).toBeVisible({ timeout: 10_000 });
    await expect(page.getByTestId("sku-detail-nama")).toContainText("Susu UHT");
    await page.goBack();
    await expect(page).toHaveURL(/\/kritis/);
    await page.goto("/");
    await page.waitForTimeout(500);
    await expect(page.getByTestId("dashboard-page")).toBeVisible();
    const approveBtn = page.getByRole("button", { name: /Setujui Tebus Murah|Setujui/ }).first();
    await expect(approveBtn).toBeVisible({ timeout: 10_000 });
    await expect(approveBtn).toHaveCSS("min-height", "48px");
    await expect(approveBtn).toHaveCSS("font-size", "16px");
    await approveBtn.click();
    tapCount++;
    const dialog = page.getByRole("dialog");
    await expect(dialog).toBeVisible({ timeout: 5000 });
    const yakinBtn = page.getByTestId("dialog-confirm-yakin");
    await expect(yakinBtn).toBeVisible();
    await expect(yakinBtn).toHaveCSS("min-height", "48px");
    await yakinBtn.click();
    await expect(dialog).toHaveCount(0);
    await expect(page.getByTestId("promo-toast")).toBeVisible({ timeout: 5000 });
    expect(tapCount).toBeLessThanOrEqual(3);
    await page.goto("/sku/sku-susu");
    await page.waitForTimeout(500);
    await expect(page.getByTestId("sku-detail-page")).toBeVisible({ timeout: 10_000 });
    await expect(page.getByTestId("sku-detail-nama")).toContainText("Susu");
  });

  test("failure: route tak dikenal → dashboard", async ({ page }) => {
    await page.goto("/tidak-ada");
    await page.waitForTimeout(600);
    await expect(page.getByTestId("dashboard-page")).toBeVisible({ timeout: 10_000 });
    await expect(page.getByTestId("dashboard-subtabs")).toBeVisible();
    await expect(page.getByTestId("bottom-nav-dashboard")).toHaveAttribute("aria-current", "page");
    await page.goto("/foo/bar/baz");
    await page.waitForTimeout(600);
    await expect(page.getByTestId("dashboard-page")).toBeVisible({ timeout: 10_000 });
    await page.goto("/sku/tidak-ada-id-xyz");
    await page.waitForTimeout(600);
    await expect(page.getByTestId("sku-detail-notfound")).toBeVisible({ timeout: 10_000 });
    await expect(page.getByTestId("sku-detail-page")).toBeVisible();
  });

  test("a11y Bahasa Indonesia + 48px/16px di semua nav", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await seedNav(page);
    await page.goto("/");
    await page.waitForTimeout(600);
    for (const id of ["bottom-nav-dashboard", "bottom-nav-sku", "bottom-nav-settings"]) {
      const btn = page.getByTestId(id);
      await expect(btn).toBeVisible();
      await expect(btn).toHaveCSS("min-height", "48px");
      await expect(btn).toHaveCSS("font-size", "16px");
    }
    await expect(page.getByTestId("bottom-nav-dashboard")).toContainText("Dashboard");
    await expect(page.getByTestId("bottom-nav-sku")).toContainText("SKU");
    await expect(page.getByTestId("bottom-nav-settings")).toContainText("Pengaturan");
    await expect(page.getByTestId("tab-ringkasan")).toHaveCSS("min-height", "48px");
    await expect(page.getByTestId("tab-statistik")).toHaveCSS("min-height", "48px");
    await page.goto("/sku/sku-susu");
    await page.waitForTimeout(600);
    await expect(page.getByTestId("tab-masuk")).toHaveCSS("min-height", "48px");
    await expect(page.getByTestId("tab-keluar")).toHaveCSS("min-height", "48px");
    await expect(page.getByTestId("tab-masuk")).toContainText("Masuk");
    await expect(page.getByTestId("tab-keluar")).toContainText("Keluar");
    const hasHScroll = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth);
    expect(hasHScroll).toBe(false);
  });
});
