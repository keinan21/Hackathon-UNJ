import { test, expect } from "@playwright/test";

async function loginSetup(page: import("@playwright/test").Page, nama = "Toko Inbound") {
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

test.describe("Inbound form — tanggal/durasi + pengirim/harga/catatan", () => {
  test.beforeEach(async ({ page }) => {
    await loginSetup(page);
    await page.waitForTimeout(300);
    await clearDexie(page);
    await seedKategoriViaRepo(page, { id: "k-mkr", nama: "Makanan Kering", threshold: [7, 3, 1] });
    await seedSkuViaRepo(page, { id: "sku-1", nama: "Roti Tawar", kategori_id: "k-mkr", hpp: 8000, harga_normal: 12000, kode: "MKR-001" });
    await page.reload();
    await page.waitForTimeout(300);
  });

  test("durasi 30 → expiry = masuk+30 startOfDay Jakarta", async ({ page }) => {
    await page.goto("/masuk");
    await expect(page.getByTestId("inbound-page")).toBeVisible({ timeout: 10_000 });

    await page.getByTestId("select-inbound-sku").selectOption("sku-1");
    await page.getByTestId("input-qty").fill("10");
    await page.getByTestId("radio-durasi").click();
    await expect(page.getByTestId("input-durasi")).toBeVisible();
    await page.getByTestId("input-durasi").fill("30");
    await page.getByTestId("input-hpp").fill("9000");
    await page.getByTestId("input-pengirim").fill("Supplier A");
    await page.getByTestId("textarea-catatan").fill("Nota #123");

    await expect(page.getByTestId("btn-masuk-simpan")).toHaveCSS("min-height", "48px");
    await expect(page.getByTestId("input-qty")).toHaveCSS("min-height", "48px");

    await page.getByTestId("btn-masuk-simpan").click();

    await expect(page.getByTestId("form-success")).toBeVisible({ timeout: 10_000 });
    await expect(page.getByTestId("form-success")).toContainText("berhasil");

    await page.waitForTimeout(600);
    await expect(page).toHaveURL("/");

    const batchInfo = await page.evaluate(async () => {
      const w = window as unknown as Record<string, unknown>;
      const dv = w.__DEXIE_V2__ as { batches: { where: (k: string) => { equals: (v: string) => { toArray: () => Promise<Array<{ sku_id: string; qty: number; expiry_date: string | null; hpp_snapshot: number }>> } } } };
      const batches = await dv.batches.where("org_id").equals("toko-01").toArray();
      return batches.find((b) => b.sku_id === "sku-1");
    });
    expect(batchInfo).toBeTruthy();
    expect(batchInfo?.qty).toBe(10);
    expect(batchInfo?.hpp_snapshot).toBe(9000);

    // verify expiry = masuk+30 via Jakarta startOfDay
    const expectedExpiry = await page.evaluate(() => {
      const fmt = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Jakarta", year: "numeric", month: "2-digit", day: "2-digit" });
      const toStart = (d: Date) => {
        const parts = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Jakarta", year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(d);
        const y = Number(parts.find((p) => p.type === "year")!.value);
        const mo = Number(parts.find((p) => p.type === "month")!.value);
        const da = Number(parts.find((p) => p.type === "day")!.value);
        return new Date(Date.UTC(y, mo - 1, da, 0, 0, 0, 0) - 7 * 60 * 60 * 1000);
      };
      const start = toStart(new Date());
      const expiry = new Date(start.getTime() + 30 * 86400000);
      return fmt.format(expiry);
    });
    expect(batchInfo?.expiry_date).toBe(expectedExpiry);

    // verify hpp updated
    const skuAfter = await page.evaluate(async () => {
      const w = window as unknown as Record<string, unknown>;
      const repo = w.__REAL_REPO__ as { getSku: (id: string) => Promise<{ hpp: number }> };
      return repo.getSku("sku-1");
    });
    expect(skuAfter?.hpp).toBe(9000);

    // verify transaksi masuk recorded
    const transFound = await page.evaluate(async () => {
      const w = window as unknown as Record<string, unknown>;
      const dv = w.__DEXIE_V2__ as { transaksis: { where: (k: string) => { equals: (v: string) => { toArray: () => Promise<Array<{ sku_id: string; jenis: string; pengirim: string | null; catatan: string | null }>> } } } };
      const list = await dv.transaksis.where("org_id").equals("toko-01").toArray();
      return list.find((t) => t.sku_id === "sku-1" && t.jenis === "masuk");
    });
    expect(transFound).toBeTruthy();
    expect(transFound?.pengirim).toBe("Supplier A");
    expect(transFound?.catatan).toBe("Nota #123");
  });

  test("expiry < received → Tanggal tidak valid", async ({ page }) => {
    await page.goto("/masuk");
    await expect(page.getByTestId("inbound-page")).toBeVisible({ timeout: 10_000 });

    await page.getByTestId("select-inbound-sku").selectOption("sku-1");
    await page.getByTestId("input-qty").fill("5");
    // default mode tanggal — isi kemarin
    const yesterday = await page.evaluate(() => {
      const fmt = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Jakarta", year: "numeric", month: "2-digit", day: "2-digit" });
      const toStart = (d: Date) => {
        const parts = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Jakarta", year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(d);
        const y = Number(parts.find((p) => p.type === "year")!.value);
        const mo = Number(parts.find((p) => p.type === "month")!.value);
        const da = Number(parts.find((p) => p.type === "day")!.value);
        return new Date(Date.UTC(y, mo - 1, da, 0, 0, 0, 0) - 7 * 60 * 60 * 1000);
      };
      const start = toStart(new Date());
      const yest = new Date(start.getTime() - 86400000);
      return fmt.format(yest);
    });
    await page.getByTestId("input-tanggal").fill(yesterday);
    await page.getByTestId("input-hpp").fill("8000");
    await page.getByTestId("btn-masuk-simpan").click();

    await expect(page.getByTestId("form-error")).toBeVisible({ timeout: 5000 });
    await expect(page.getByTestId("form-error")).toContainText("Tanggal tidak valid");
  });

  test("empty state jika belum pilih SKU handled via validation", async ({ page }) => {
    await page.goto("/masuk");
    await expect(page.getByTestId("inbound-page")).toBeVisible({ timeout: 10_000 });
    await page.getByTestId("input-qty").fill("5");
    await page.getByTestId("input-tanggal").fill("2099-12-31");
    await page.getByTestId("input-hpp").fill("8000");
    // leave SKU empty
    await page.getByTestId("btn-masuk-simpan").click();
    await expect(page.getByTestId("form-error")).toBeVisible({ timeout: 5000 });
    await expect(page.getByTestId("form-error")).toContainText("Pilih SKU");
  });
});
