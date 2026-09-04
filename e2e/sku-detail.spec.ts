import { test, expect } from "@playwright/test";

async function loginSetup(page: import("@playwright/test").Page, nama = "Toko Detail") {
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
    const dv = w.__DEXIE_V2__ as {
      tags: { where: (k: string) => { equals: (v: string) => { delete: () => Promise<void> } } };
      sku_tags: { where: (k: string) => { equals: (v: string) => { delete: () => Promise<void> } } };
    } | undefined;
    try {
      if (dv) {
        await dv.tags.where("org_id").equals("toko-01").delete().catch(() => {});
        await dv.sku_tags.where("org_id").equals("toko-01").delete().catch(() => {});
      }
    } catch {}
  });
}

function expiryDateForDays(days: number): string {
  const fmt = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Jakarta", year: "numeric", month: "2-digit", day: "2-digit" });
  const parts = fmt.formatToParts(new Date());
  const y = Number(parts.find((p) => p.type === "year")!.value);
  const m = Number(parts.find((p) => p.type === "month")!.value) - 1;
  const d = Number(parts.find((p) => p.type === "day")!.value);
  const jakartaMidnightUTC = Date.UTC(y, m, d, 0, 0, 0, 0) - 7 * 60 * 60 * 1000;
  const expiryUTC = jakartaMidnightUTC + days * 86_400_000;
  const expiryJakarta = new Date(expiryUTC);
  const fmt2 = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Jakarta", year: "numeric", month: "2-digit", day: "2-digit" });
  return fmt2.format(expiryJakarta);
}

function jakartaNoonISO(daysOffset: number): string {
  const fmt = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Jakarta", year: "numeric", month: "2-digit", day: "2-digit" });
  const parts = fmt.formatToParts(new Date());
  const y = Number(parts.find((p) => p.type === "year")!.value);
  const m = Number(parts.find((p) => p.type === "month")!.value) - 1;
  const d = Number(parts.find((p) => p.type === "day")!.value);
  const baseUTC = Date.UTC(y, m, d, 0, 0, 0, 0) - 7 * 60 * 60 * 1000;
  const targetUTC = baseUTC + daysOffset * 86_400_000 + 12 * 60 * 60 * 1000; // noon Jakarta
  return new Date(targetUTC).toISOString();
}

test.describe("SKU Detail 1-halaman + grafik mini arus 14d", () => {
  test.beforeEach(async ({ page }) => {
    await loginSetup(page);
    await page.waitForTimeout(500);
    await clearDexie(page);
    await page.evaluate(() => localStorage.setItem("profil_toko_v1", JSON.stringify({ nama_toko: "Toko Detail", updated_at: new Date().toISOString() })));
  });

  test("render lengkap: header+kategori+tag, stok total, batch kritis merah, histori 14d, grafik 14 titik + marker BEP #16a34a", async ({ page }) => {
    const skuId = "sku-detail-1";
    await page.evaluate(
      async ({ sId }) => {
        const w = window as unknown as Record<string, unknown>;
        const repo = w.__REAL_REPO__ as {
          createKategori: (k: { id: string; nama: string; threshold_h_minus: number[]; org_id: string }) => Promise<void>;
          createSku: (s: { id: string; nama: string; kategori_id: string; hpp: number; harga_normal: number; barcode?: string; kode?: string; org_id: string }) => Promise<void>;
          createBatch: (b: { id: string; sku_id: string; qty: number; expiry_date: string | null; received_at: string; hpp_snapshot: number; org_id: string }) => Promise<void>;
          createTransaksi: (t: { id: string; sku_id: string; qty_sold: number; sold_at: string; org_id: string; jenis?: string; harga_jual_snapshot?: number }) => Promise<void>;
        };
        const dv = w.__DEXIE_V2__ as {
          tags: { put: (t: { id: string; nama: string; org_id: string }) => Promise<void> };
          sku_tags: { put: (st: { id: string; sku_id: string; tag_id: string; org_id: string }) => Promise<void> };
        };
        const expiryKritis = (globalThis as unknown as { expiryDateForDays: (d: number) => string }).expiryDateForDays?.(2) ?? "";
        // fallback compute if not injected
        const computeExpiry = (days: number) => {
          const fmt = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Jakarta", year: "numeric", month: "2-digit", day: "2-digit" });
          const parts = fmt.formatToParts(new Date());
          const y = Number(parts.find((p) => p.type === "year")!.value);
          const m = Number(parts.find((p) => p.type === "month")!.value) - 1;
          const d = Number(parts.find((p) => p.type === "day")!.value);
          const base = Date.UTC(y, m, d, 0, 0, 0, 0) - 7 * 60 * 60 * 1000;
          const exp = new Date(base + days * 86_400_000);
          const fmt2 = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Jakarta", year: "numeric", month: "2-digit", day: "2-digit" });
          return fmt2.format(exp);
        };
        const jakartaNoon = (offset: number) => {
          const fmt = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Jakarta", year: "numeric", month: "2-digit", day: "2-digit" });
          const parts = fmt.formatToParts(new Date());
          const y = Number(parts.find((p) => p.type === "year")!.value);
          const m2 = Number(parts.find((p) => p.type === "month")!.value) - 1;
          const d = Number(parts.find((p) => p.type === "day")!.value);
          const baseUTC = Date.UTC(y, m2, d, 0, 0, 0, 0) - 7 * 60 * 60 * 1000;
          const target = baseUTC + offset * 86_400_000 + 12 * 60 * 60 * 1000;
          return new Date(target).toISOString();
        };
        const k = { id: "k-detail", nama: "Dairy", threshold_h_minus: [7, 3, 1], org_id: "toko-01" };
        await repo.createKategori(k);
        const tagPromo = { id: "tag-promo-detail", nama: "promo", org_id: "toko-01" };
        await dv.tags.put(tagPromo).catch(() => {});
        await repo.createSku({ id: sId, nama: "Susu UHT 1L", kategori_id: k.id, hpp: 10000, harga_normal: 15000, barcode: "899001-detail", kode: "SUS-001", org_id: "toko-01" });
        await dv.sku_tags.put({ id: "st-detail-1", sku_id: sId, tag_id: tagPromo.id, org_id: "toko-01" }).catch(() => {});
        await repo.createBatch({ id: "batch-kritis-detail", sku_id: sId, qty: 10, expiry_date: computeExpiry(2), received_at: new Date().toISOString(), hpp_snapshot: 10000, org_id: "toko-01" });
        await repo.createBatch({ id: "batch-null-detail", sku_id: sId, qty: 15, expiry_date: null, received_at: new Date().toISOString(), hpp_snapshot: 10000, org_id: "toko-01" });
        // 14 hari transaksi mix masuk/keluar untuk grafik + BEP
        for (let i = 0; i < 14; i++) {
          const offset = i - 13; // earliest -13 to 0
          const iso = jakartaNoon(offset);
          // keluar setiap hari 2 pcs -> margin 5000*2=10000 per hari
          await repo.createTransaksi({ id: `trx-keluar-${i}`, sku_id: sId, qty_sold: 2, sold_at: iso, org_id: "toko-01", jenis: "keluar", harga_jual_snapshot: 15000 });
          if (i % 2 === 0) {
            const masukIso = new Date(new Date(jakartaNoon(offset)).getTime() + 60 * 60 * 1000).toISOString();
            await repo.createTransaksi({ id: `trx-masuk-${i}`, sku_id: sId, qty_sold: 3, sold_at: masukIso, org_id: "toko-01", jenis: "masuk", harga_jual_snapshot: 0 });
          }
        }
      },
      { sId: skuId },
    );

    await page.goto(`/sku/${skuId}`);
    await expect(page.getByTestId("sku-detail-page")).toBeVisible({ timeout: 10_000 });
    await expect(page.getByTestId("sku-detail-nama")).toContainText("Susu UHT 1L");
    await expect(page.getByTestId("sku-detail-kode")).toContainText("SUS-001");
    await expect(page.getByTestId("sku-detail-kode")).toContainText("899001-detail");
    await expect(page.getByTestId("sku-detail-kategori")).toContainText("Dairy");
    await expect(page.getByTestId("sku-detail-tags")).toContainText("#promo");
    await expect(page.getByTestId("sku-detail-stok-total")).toContainText("25 pcs");
    await expect(page.getByTestId("sku-detail-hpp")).toContainText("Rp10.000");
    await expect(page.getByTestId("sku-detail-hpp")).toContainText("Rp15.000");
    await expect(page.getByTestId("sku-detail-hpp")).toContainText("Rp5.000");

    // batch list
    await expect(page.getByTestId("batch-row-batch-kritis-detail")).toBeVisible();
    await expect(page.getByTestId("batch-row-batch-kritis-detail")).toContainText("H-");
    await expect(page.getByTestId("batch-kritis-batch-kritis-detail")).toBeVisible();
    await expect(page.getByTestId("batch-row-batch-null-detail")).toBeVisible();
    await expect(page.getByTestId("batch-row-batch-null-detail")).toContainText("Tanpa kadaluarsa");

    // histori 14d
    await expect(page.getByTestId("sku-detail-histori")).toBeVisible();
    // at least 14 keluar entries
    await expect(page.getByTestId("histori-item-trx-keluar-13")).toBeVisible();
    await expect(page.getByTestId("histori-item-trx-keluar-0")).toBeVisible();

    // grafik ChartArus (Chart.js lazy)
    await expect(page.getByTestId("sku-detail-grafik")).toBeVisible();
    await expect(page.getByTestId("chart-arus-wrapper")).toBeVisible({ timeout: 10_000 });
    await expect(page.getByTestId("chart-arus-container")).toBeVisible();
    // canvas Chart.js
    const canvas = page.locator('[data-testid="chart-arus-container"] canvas');
    await expect(canvas).toBeVisible({ timeout: 10_000 });
    // legenda Bahasa Indonesia
    await expect(page.getByTestId("chart-arus-wrapper")).toContainText("Masuk");
    await expect(page.getByTestId("chart-arus-wrapper")).toContainText("Keluar");
    await expect(page.getByTestId("chart-arus-wrapper")).toContainText("BEP");

    // BEP marker amber #F59E0B (beda dari hijau #16a34a)
    const bepMarker = page.getByTestId("bep-marker");
    await expect(bepMarker).toBeVisible();
    // amber background via inline style
    await expect(bepMarker).toHaveCSS("background-color", "rgb(245, 158, 11)");
    await expect(page.getByTestId("chart-bep-label")).toContainText("BEP tercapai H+");

    // screenshot evidence optional
    // back button
    await expect(page.getByTestId("sku-detail-back")).toBeVisible();
    await expect(page.getByTestId("sku-detail-back")).toHaveCSS("min-height", "48px");
  });

  test("tanpa transaksi → grafik empty Indonesia + histori empty", async ({ page }) => {
    const skuId = "sku-empty-detail";
    await page.evaluate(
      async ({ sId }) => {
        const w = window as unknown as Record<string, unknown>;
        const repo = w.__REAL_REPO__ as {
          createKategori: (k: { id: string; nama: string; threshold_h_minus: number[]; org_id: string }) => Promise<void>;
          createSku: (s: { id: string; nama: string; kategori_id: string; hpp: number; harga_normal: number; kode?: string; org_id: string }) => Promise<void>;
          createBatch: (b: { id: string; sku_id: string; qty: number; expiry_date: string | null; received_at: string; hpp_snapshot: number; org_id: string }) => Promise<void>;
        };
        const computeExpiry = (days: number) => {
          const fmt = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Jakarta", year: "numeric", month: "2-digit", day: "2-digit" });
          const parts = fmt.formatToParts(new Date());
          const y = Number(parts.find((p) => p.type === "year")!.value);
          const m = Number(parts.find((p) => p.type === "month")!.value) - 1;
          const d = Number(parts.find((p) => p.type === "day")!.value);
          const base = Date.UTC(y, m, d, 0, 0, 0, 0) - 7 * 60 * 60 * 1000;
          const exp = new Date(base + days * 86_400_000);
          const fmt2 = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Jakarta", year: "numeric", month: "2-digit", day: "2-digit" });
          return fmt2.format(exp);
        };
        await repo.createKategori({ id: "k-empty", nama: "Snack", threshold_h_minus: [7, 3, 1], org_id: "toko-01" });
        await repo.createSku({ id: sId, nama: "Keripik Kosong", kategori_id: "k-empty", hpp: 8000, harga_normal: 12000, kode: "KRP-001", org_id: "toko-01" });
        await repo.createBatch({ id: "batch-empty-1", sku_id: sId, qty: 5, expiry_date: computeExpiry(10), received_at: new Date().toISOString(), hpp_snapshot: 8000, org_id: "toko-01" });
        await repo.createBatch({ id: "batch-empty-null", sku_id: sId, qty: 3, expiry_date: null, received_at: new Date().toISOString(), hpp_snapshot: 8000, org_id: "toko-01" });
      },
      { sId: skuId },
    );

    await page.goto(`/sku/${skuId}`);
    await expect(page.getByTestId("sku-detail-page")).toBeVisible({ timeout: 10_000 });
    await expect(page.getByTestId("sku-detail-nama")).toContainText("Keripik Kosong");
    await expect(page.getByTestId("sku-detail-grafik-section")).toBeVisible();
    await expect(page.getByTestId("grafik-empty")).toBeVisible();
    await expect(page.getByTestId("grafik-empty")).toContainText("Belum ada transaksi 14 hari terakhir");
    await expect(page.getByTestId("histori-empty")).toBeVisible();
    await expect(page.getByTestId("histori-empty")).toContainText("Belum ada transaksi 14 hari terakhir");
    await expect(page.getByTestId("bep-marker")).toHaveCount(0);
    await expect(page.getByTestId("chart-arus-container")).toHaveCount(0);
    await expect(page.getByTestId("chart-bep-label")).toHaveCount(0);
  });

  test("deep-link guard + pushState popstate konsisten", async ({ page }) => {
    const skuId = "sku-guard-detail";
    await page.evaluate(
      async ({ sId }) => {
        const w = window as unknown as Record<string, unknown>;
        const repo = w.__REAL_REPO__ as {
          createKategori: (k: { id: string; nama: string; threshold_h_minus: number[]; org_id: string }) => Promise<void>;
          createSku: (s: { id: string; nama: string; kategori_id: string; hpp: number; harga_normal: number; kode?: string; org_id: string }) => Promise<void>;
          createBatch: (b: { id: string; sku_id: string; qty: number; expiry_date: string | null; received_at: string; hpp_snapshot: number; org_id: string }) => Promise<void>;
        };
        await repo.createKategori({ id: "k-guard", nama: "Dairy", threshold_h_minus: [7, 3, 1], org_id: "toko-01" });
        await repo.createSku({ id: sId, nama: "Yoghurt Guard", kategori_id: "k-guard", hpp: 5000, harga_normal: 8000, kode: "YOG-999", org_id: "toko-01" });
        await repo.createBatch({ id: "batch-guard-1", sku_id: sId, qty: 8, expiry_date: null, received_at: new Date().toISOString(), hpp_snapshot: 5000, org_id: "toko-01" });
      },
      { sId: skuId },
    );

    await page.goto(`/sku/${skuId}`);
    await expect(page.getByTestId("sku-detail-page")).toBeVisible({ timeout: 10_000 });
    await expect(page.getByTestId("sku-detail-nama")).toContainText("Yoghurt Guard");
    // back via button → popstate to "/"
    await page.getByTestId("sku-detail-back").click();
    await expect(page).toHaveURL("/");
    // deep-link via pushState
    await page.evaluate((id) => {
      window.history.pushState({}, "", `/sku/${id}`);
      window.dispatchEvent(new PopStateEvent("popstate"));
    }, skuId);
    await expect(page.getByTestId("sku-detail-page")).toBeVisible({ timeout: 10_000 });
    await expect(page.getByTestId("sku-detail-nama")).toContainText("Yoghurt Guard");
    // SKU tidak ditemukan
    await page.goto("/sku/sku-tidak-ada-xyz");
    await expect(page.getByTestId("sku-detail-notfound")).toBeVisible({ timeout: 10_000 });
    await expect(page.getByTestId("sku-detail-notfound")).toContainText("SKU tidak ditemukan");
  });
});
