import { test, expect } from "@playwright/test";

async function loginSetup(page: import("@playwright/test").Page, nama = "Toko Dashboard") {
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

async function seedDashboard(page: import("@playwright/test").Page) {
  await page.evaluate(
    async ({ exp2, exp3 }) => {
      const w = window as unknown as Record<string, unknown>;
      const repo = w.__REAL_REPO__ as {
        createKategori: (k: { id: string; nama: string; threshold_h_minus: number[]; org_id: string }) => Promise<void>;
        createSku: (s: { id: string; nama: string; kategori_id: string; hpp: number; harga_normal: number; kode?: string; org_id: string }) => Promise<void>;
        createBatch: (b: { id: string; sku_id: string; qty: number; expiry_date: string | null; received_at: string; hpp_snapshot: number; org_id: string }) => Promise<void>;
        createPromo: (pr: { id: string; batch_id: string; sku_pasangan_id: string | null; harga_tebus: number; status: string; org_id: string; created_at: string }) => Promise<void>;
        setAdvisorCache: (e: { org_id: string; batch_id: string; suggestion: unknown; created_at: string }) => Promise<void>;
      };
      const cat = { id: "k-dairy", nama: "Dairy", threshold_h_minus: [7, 3, 1], org_id: "toko-01" };
      await repo.createKategori(cat).catch(() => {});
      await repo.createSku({ id: "sku-susu", nama: "Susu UHT 1L", kategori_id: cat.id, hpp: 10000, harga_normal: 15000, kode: "SUS-001", org_id: "toko-01" }).catch(() => {});
      await repo.createSku({ id: "sku-roti", nama: "Roti Tawar", kategori_id: cat.id, hpp: 8000, harga_normal: 12000, kode: "ROT-001", org_id: "toko-01" }).catch(() => {});
      await repo.createSku({ id: "sku-yoghurt", nama: "Yoghurt Cup 100ml", kategori_id: cat.id, hpp: 8000, harga_normal: 12000, kode: "YOG-001", org_id: "toko-01" }).catch(() => {});
      // Batches: 2 urgent (H-2, H-1), 1 non-urgent H-10 hidden, 1 expiry null skipped
      await repo.createBatch({ id: "b-h2", sku_id: "sku-susu", qty: 10, expiry_date: exp2, received_at: new Date().toISOString(), hpp_snapshot: 10000, org_id: "toko-01" });
      await repo.createBatch({ id: "b-h1", sku_id: "sku-yoghurt", qty: 8, expiry_date: exp3, received_at: new Date().toISOString(), hpp_snapshot: 8000, org_id: "toko-01" }).catch(() => {});
      // Promo: 1 proposed linked to b-h2
      await repo.createPromo({ id: "promo-dash-1", batch_id: "b-h2", sku_pasangan_id: "sku-roti", harga_tebus: 9000, status: "proposed", org_id: "toko-01", created_at: new Date().toISOString() });
      // Histori: via advisorCache + promo (HistoriList merges both)
      await repo.setAdvisorCache({
        org_id: "toko-01",
        batch_id: "b-h2",
        suggestion: {
          batch_id: "b-h2",
          aksi: "Tebus Murah Susu UHT 1L + Roti Tawar",
          alasan: "Susu mau kadaluarsa 2 hari lagi, pasangkan dengan roti yang laris biar cepat habis tanpa rugi.",
          pasangan_tebus_murah: "sku-roti",
          harga_tebus: 9000,
          estimasi_margin: 500,
          confidence: "Tinggi",
          created_at: new Date().toISOString(),
        },
        created_at: new Date().toISOString(),
      } as unknown as never);
      for (let i = 1; i < 5; i++) {
        const created = new Date(Date.now() - i * 60_000).toISOString();
        await repo.createPromo({ id: `promo-hist-${i}`, batch_id: "b-h2", sku_pasangan_id: "sku-roti", harga_tebus: 9000 + i, status: "active", org_id: "toko-01", created_at: created });
      }
    },
    { exp2: expiryFor(2), exp3: expiryFor(1) },
  );
}

test.describe("Dashboard 3 seksi + histori + promo — real Dexie", () => {
  test.beforeEach(async ({ page }) => {
    await loginSetup(page);
    await page.waitForTimeout(300);
    await clearDexie(page);
    await page.waitForTimeout(200);
  });

  test("dashboard shows 3 sections Stok Mepet + Promo Tebus Murah + Histori Saran (real)", async ({ page }) => {
    await seedDashboard(page);
    await page.goto("/");
    await page.waitForTimeout(800);
    await expect(page.getByTestId("dashboard-page")).toBeVisible({ timeout: 10_000 });
    await expect(page.getByRole("heading", { name: "Stok Mepet" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Promo Tebus Murah" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Histori Saran" })).toBeVisible();
    await expect(page.getByText("Tebus Murah").first()).toBeVisible();
    const promoHarga = page.locator("text=Rp").first();
    await expect(promoHarga).toBeVisible();
    await expect(page.getByText(/Modal Rp10\.000/).first()).toBeVisible();
    const historiItems = page.locator('[data-testid^="histori-"]');
    await expect(historiItems.first()).toBeVisible({ timeout: 10_000 });
    const innerP = page.locator('[data-testid="section-histori"] li p').first();
    await expect(innerP).toHaveCSS("font-size", "16px");
    const promoBtn = page.getByRole("button", { name: /Setujui Tebus Murah|Lihat Saran Tebus/ }).first();
    if (await promoBtn.count() > 0) {
      await expect(promoBtn).toHaveCSS("min-height", "48px");
    }
    // Navigasi ikon jelas (drawer di desktop, bottom-nav di mobile)
    await expect(page.getByTestId("nav-dashboard").first()).toBeVisible();
    await expect(page.getByTestId("nav-sku").first()).toBeVisible();
    // bottom nav only visible on mobile, check not hidden on large: check at least one nav set visible
    const bottomVisible = await page.getByTestId("bottom-nav-dashboard").isVisible().catch(() => false);
    if (bottomVisible) {
      await expect(page.getByTestId("bottom-nav-dashboard")).toBeVisible();
      await expect(page.getByTestId("bottom-nav-sku")).toBeVisible();
      await expect(page.getByTestId("bottom-nav-promo")).toBeVisible();
      await expect(page.getByTestId("bottom-nav-settings")).toBeVisible();
    }
    // Kritis banner → /kritis
    const banner = page.getByTestId("kritis-banner");
    if (await banner.count() > 0) {
      await expect(banner).toContainText("batch kritis");
      await page.getByTestId("kritis-banner-link").click();
      await expect(page).toHaveURL(/\/kritis/);
      await expect(page.getByTestId("kritis-page")).toBeVisible({ timeout: 10_000 });
    }
  });

  test("empty DB → Belum ada SKU + CTA", async ({ page }) => {
    await page.goto("/");
    await page.waitForTimeout(600);
    await expect(page.getByTestId("dashboard-page")).toBeVisible();
    await expect(page.getByText("Belum ada SKU")).toBeVisible({ timeout: 10_000 });
    const cta = page.getByTestId("dashboard-empty-cta");
    await expect(cta).toBeVisible();
    await expect(cta).toHaveCSS("min-height", "48px");
    await cta.click();
    await expect(page).toHaveURL(/\/sku\/baru/);
    await expect(page.getByTestId("sku-baru-page")).toBeVisible({ timeout: 10_000 });
  });

  test("histori detail navigation pushState and back (real)", async ({ page }) => {
    await seedDashboard(page);
    await page.goto("/");
    await page.waitForTimeout(800);
    const firstHist = page.locator('[data-testid^="histori-"]').first();
    await expect(firstHist).toBeVisible({ timeout: 10_000 });
    await firstHist.click();
    await page.waitForURL(/\/histori\//);
    await expect(page.getByTestId("histori-detail")).toBeVisible();
    const backBtn = page.getByTestId("histori-back");
    await expect(backBtn).toBeVisible();
    await expect(backBtn).toHaveCSS("min-height", "48px");
    await backBtn.click();
    await expect(page).toHaveURL("/");
    await expect(page.getByRole("heading", { name: "Stok Mepet" })).toBeVisible();
  });

  test("dashboard responsive 375 no h-scroll", async ({ page }) => {
    await seedDashboard(page);
    await page.setViewportSize({ width: 375, height: 800 });
    await page.goto("/");
    await page.waitForTimeout(600);
    await expect(page.getByRole("heading", { name: "Stok Mepet" })).toBeVisible();
    const hasHScroll = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth);
    expect(hasHScroll).toBe(false);
  });
});
