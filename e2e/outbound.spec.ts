import { test, expect } from "@playwright/test";

async function loginSetup(page: import("@playwright/test").Page, nama = "Toko Outbound") {
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

async function seedKategoriViaRepo(page: import("@playwright/test").Page, kat: { id: string; nama: string; threshold: number[] }) {
  await page.evaluate(async ({ k }) => {
    const w = window as unknown as Record<string, unknown>;
    const repo = w.__REAL_REPO__ as { createKategori: (c: { id: string; nama: string; threshold_h_minus: number[]; org_id: string }) => Promise<void> };
    await repo.createKategori({ id: k.id, nama: k.nama, threshold_h_minus: k.threshold, org_id: "toko-01" });
  }, { k: kat });
}

async function seedSkuViaRepo(page: import("@playwright/test").Page, sku: { id: string; nama: string; kategori_id: string; hpp: number; harga_normal: number; kode?: string }) {
  await page.evaluate(async ({ s }) => {
    const w = window as unknown as Record<string, unknown>;
    const repo = w.__REAL_REPO__ as { createSku: (sku: { id: string; nama: string; kategori_id: string; hpp: number; harga_normal: number; kode?: string; org_id: string }) => Promise<void> };
    await repo.createSku({ id: s.id, nama: s.nama, kategori_id: s.kategori_id, hpp: s.hpp, harga_normal: s.harga_normal, kode: s.kode, org_id: "toko-01" });
  }, { s: sku });
}

async function seedBatch(page: import("@playwright/test").Page, batch: { id: string; sku_id: string; qty: number; expiry_date: string | null; hpp_snapshot: number }) {
  await page.evaluate(async ({ b }) => {
    const w = window as unknown as Record<string, unknown>;
    const dv = w.__DEXIE_V2__ as { batches: { put: (x: unknown) => Promise<unknown> } };
    await dv.batches.put({
      id: b.id,
      sku_id: b.sku_id,
      qty: b.qty,
      expiry_date: b.expiry_date,
      received_at: new Date().toISOString(),
      hpp_snapshot: b.hpp_snapshot,
      org_id: "toko-01",
    });
  }, { b: batch });
}

test.describe("Keluar kasir FEFO + form prefill penerima/catatan", () => {
  test.beforeEach(async ({ page }) => {
    await loginSetup(page);
    await page.waitForTimeout(300);
    await clearDexie(page);
    await seedKategoriViaRepo(page, { id: "k-mkr", nama: "Makanan Kering", threshold: [7, 3, 1] });
    await seedSkuViaRepo(page, { id: "sku-1", nama: "Roti Tawar", kategori_id: "k-mkr", hpp: 8000, harga_normal: 12000, kode: "MKR-001" });
    await page.reload();
    await page.waitForTimeout(300);
  });

  test("FEFO: 2 batch 5+10 keluar 7 → 0+8 + transaksi keluar harga_jual_snapshot = harga_normal + penerima/catatan", async ({ page }) => {
    await seedBatch(page, { id: "b-1", sku_id: "sku-1", qty: 5, expiry_date: "2026-09-03", hpp_snapshot: 8000 });
    await seedBatch(page, { id: "b-2", sku_id: "sku-1", qty: 10, expiry_date: "2026-09-10", hpp_snapshot: 8000 });

    await page.goto("/keluar");
    await expect(page.getByTestId("kasir-page")).toBeVisible({ timeout: 10_000 });

    await page.getByTestId("kasir-search").fill("Roti");
    await expect(page.getByTestId("kasir-row-sku-1")).toBeVisible({ timeout: 5000 });

    await page.getByTestId("kasir-qty-sku-1").fill("7");
    await page.getByTestId("kasir-penerima").fill("Pelanggan A");
    await page.getByTestId("kasir-catatan").fill("Penjualan ecer");

    await expect(page.getByTestId("kasir-simpan")).toHaveCSS("min-height", "48px");
    await expect(page.getByTestId("kasir-qty-sku-1")).toHaveCSS("min-height", "48px");

    await page.getByTestId("kasir-simpan").click();

    await expect(page.getByTestId("form-success")).toBeVisible({ timeout: 10_000 });
    await expect(page.getByTestId("form-success")).toContainText("tersimpan");

    const batchInfo = await page.evaluate(async () => {
      const w = window as unknown as Record<string, unknown>;
      const dv = w.__DEXIE_V2__ as { batches: { where: (k: string) => { equals: (v: string) => { toArray: () => Promise<Array<{ id: string; sku_id: string; qty: number; expiry_date: string | null }>> } } } };
      const list = await dv.batches.where("org_id").equals("toko-01").toArray();
      return list.filter((b) => b.sku_id === "sku-1").sort((a, b) => (a.expiry_date ?? "").localeCompare(b.expiry_date ?? ""));
    });
    expect(batchInfo).toHaveLength(2);
    expect(batchInfo[0].qty).toBe(0);
    expect(batchInfo[1].qty).toBe(8);

    const transFound = await page.evaluate(async () => {
      const w = window as unknown as Record<string, unknown>;
      const dv = w.__DEXIE_V2__ as { transaksis: { where: (k: string) => { equals: (v: string) => { toArray: () => Promise<Array<{ sku_id: string; qty_sold: number; jenis: string; harga_jual_snapshot: number; penerima: string | null; catatan: string | null }>> } } } };
      const list = await dv.transaksis.where("org_id").equals("toko-01").toArray();
      return list.find((t) => t.sku_id === "sku-1" && t.jenis === "keluar");
    });
    expect(transFound).toBeTruthy();
    expect(transFound?.qty_sold).toBe(7);
    expect(transFound?.jenis).toBe("keluar");
    expect(transFound?.harga_jual_snapshot).toBe(12000);
    expect(transFound?.penerima).toBe("Pelanggan A");
    expect(transFound?.catatan).toBe("Penjualan ecer");
  });

  test("keranjang kosong → tombol disabled + hint", async ({ page }) => {
    await seedBatch(page, { id: "b-1", sku_id: "sku-1", qty: 10, expiry_date: "2026-09-05", hpp_snapshot: 8000 });
    await page.goto("/keluar");
    await expect(page.getByTestId("kasir-page")).toBeVisible({ timeout: 10_000 });

    await expect(page.getByTestId("kasir-row-sku-1")).toBeVisible({ timeout: 5000 });
    await page.getByTestId("kasir-qty-sku-1").fill("0");
    await expect(page.getByTestId("kasir-simpan")).toBeDisabled();
    await expect(page.getByTestId("kasir-empty-hint")).toBeVisible();
  });

  test("stok tidak cukup → error per-baris, stok utuh", async ({ page }) => {
    await seedBatch(page, { id: "b-1", sku_id: "sku-1", qty: 5, expiry_date: "2026-09-03", hpp_snapshot: 8000 });
    await page.goto("/keluar");
    await expect(page.getByTestId("kasir-page")).toBeVisible({ timeout: 10_000 });

    await expect(page.getByTestId("kasir-row-sku-1")).toBeVisible({ timeout: 5000 });
    await page.getByTestId("kasir-qty-sku-1").fill("10");
    await page.getByTestId("kasir-simpan").click();

    const err = page.getByTestId("kasir-error-sku-1");
    await expect(err).toBeVisible({ timeout: 5000 });
    await expect(err).toContainText("Stok tidak cukup");
  });

  test("read-only SKU dari query ?skuId=sku-1", async ({ page }) => {
    await seedBatch(page, { id: "b-1", sku_id: "sku-1", qty: 8, expiry_date: "2026-09-10", hpp_snapshot: 8000 });
    await page.goto("/keluar?skuId=sku-1");
    await expect(page.getByTestId("outbound-page")).toBeVisible({ timeout: 10_000 });
    await expect(page.getByTestId("outbound-sku-readonly")).toBeVisible({ timeout: 5000 });
    await expect(page.getByTestId("outbound-sku-readonly")).toContainText("Roti Tawar");
    await page.getByTestId("input-qty").fill("2");
    await page.getByTestId("btn-keluar-simpan").click();
    await expect(page.getByTestId("form-success")).toBeVisible({ timeout: 10_000 });
  });
});
