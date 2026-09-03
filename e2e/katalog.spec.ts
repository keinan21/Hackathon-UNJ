import { test, expect } from "@playwright/test";

async function loginSetup(page: import("@playwright/test").Page, nama = "Toko Katalog") {
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
    const dv = w.__DEXIE_V2__ as { tags: { where: (k: string) => { equals: (v: string) => { delete: () => Promise<void> } } }; sku_tags: { where: (k: string) => { equals: (v: string) => { delete: () => Promise<void> } } } } | undefined;
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

test.describe("Katalog real + search + filter kategori/tag", () => {
  test.beforeEach(async ({ page }) => {
    await loginSetup(page);
    await page.waitForTimeout(500);
    await clearDexie(page);
    await page.evaluate(() => localStorage.setItem("profil_toko_v1", JSON.stringify({ nama_toko: "Toko Katalog", updated_at: new Date().toISOString() })));
  });

  test("empty state Belum ada SKU → Tambah SKU navigasi /sku/baru segera hadir", async ({ page }) => {
    await page.goto("/");
    await page.getByTestId("nav-sku").click();
    const katalog = page.getByTestId("katalog-page");
    await expect(katalog).toBeVisible({ timeout: 10_000 });
    await expect(page.getByTestId("katalog-empty")).toBeVisible();
    await expect(page.getByText("Belum ada SKU")).toBeVisible();
    await expect(page.getByText("Tambah SKU").first()).toBeVisible();
    const btn = page.getByTestId("btn-empty-tambah-sku");
    await expect(btn).toBeVisible();
    await expect(btn).toHaveCSS("min-height", "48px");
    await expect(btn).toHaveCSS("font-size", "16px");
    await btn.click();
    await expect(page).toHaveURL(/\/sku\/baru/);
    await expect(page.getByTestId("sku-baru-page")).toBeVisible();
    await expect(page.getByText("segera hadir")).toBeVisible();
    await page.getByTestId("sku-baru-back").click();
    await expect(page).toHaveURL("/");
    await page.getByTestId("nav-sku").click();
    await expect(page.getByTestId("katalog-empty")).toBeVisible();
  });

  test("search debounce 300ms nama/kode/barcode/tag + chips Semua kategori tag", async ({ page }) => {
    const kodeSusu = `SUS-${Date.now().toString().slice(-4)}`;
    await page.evaluate(
      async ({ kode }) => {
        const w = window as unknown as Record<string, unknown>;
        const repo = w.__REAL_REPO__ as {
          createKategori: (k: { id: string; nama: string; threshold_h_minus: number[]; org_id: string }) => Promise<void>;
          createSku: (s: { id: string; nama: string; kategori_id: string; hpp: number; harga_normal: number; barcode?: string; kode?: string; org_id: string }) => Promise<void>;
          createBatch: (b: { id: string; sku_id: string; qty: number; expiry_date: string | null; received_at: string; hpp_snapshot: number; org_id: string }) => Promise<void>;
        };
        const dv = w.__DEXIE_V2__ as {
          tags: { put: (t: { id: string; nama: string; org_id: string }) => Promise<void> };
          sku_tags: { put: (st: { id: string; sku_id: string; tag_id: string; org_id: string }) => Promise<void> };
        };
        const kDairy = { id: "k-dairy-katalog", nama: "Dairy", threshold_h_minus: [7, 3, 1], org_id: "toko-01" };
        const kSnack = { id: "k-snack-katalog", nama: "Snack", threshold_h_minus: [7, 3, 1], org_id: "toko-01" };
        await repo.createKategori(kDairy);
        await repo.createKategori(kSnack);
        const tagPromo = { id: "tag-promo", nama: "promo", org_id: "toko-01" };
        await dv.tags.put(tagPromo).catch(() => {});
        await repo.createSku({ id: "sku-susu", nama: "Susu UHT 1L", kategori_id: kDairy.id, hpp: 10000, harga_normal: 15000, barcode: "899001", kode, org_id: "toko-01" });
        await repo.createSku({ id: "sku-roti", nama: "Roti Tawar", kategori_id: kSnack.id, hpp: 8000, harga_normal: 12000, barcode: "899002", kode: "ROT-001", org_id: "toko-01" });
        await repo.createSku({ id: "sku-beras", nama: "Beras 5kg", kategori_id: kSnack.id, hpp: 50000, harga_normal: 60000, kode: "BER-001", org_id: "toko-01" });
        await dv.sku_tags.put({ id: "st-1", sku_id: "sku-susu", tag_id: tagPromo.id, org_id: "toko-01" }).catch(() => {});
        const exp10 = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Jakarta", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date(Date.now() + 10 * 86_400_000));
        await repo.createBatch({ id: "batch-susu", sku_id: "sku-susu", qty: 10, expiry_date: exp10, received_at: new Date().toISOString(), hpp_snapshot: 10000, org_id: "toko-01" });
      },
      { kode: kodeSusu },
    );

    await page.reload();
    await page.getByTestId("nav-sku").click();
    await expect(page.getByTestId("katalog-page")).toBeVisible({ timeout: 10_000 });
    await expect(page.getByTestId("sku-card-sku-susu")).toBeVisible({ timeout: 10_000 });
    await expect(page.getByTestId("sku-card-sku-roti")).toBeVisible();
    await expect(page.getByTestId("sku-card-sku-beras")).toBeVisible();
    await expect(page.getByTestId("katalog-search")).toBeVisible();

    const search = page.getByTestId("katalog-search");
    await expect(search).toHaveCSS("min-height", "48px");
    await expect(search).toHaveCSS("font-size", "16px");

    await expect(page.getByTestId("chip-semua")).toBeVisible();
    await expect(page.getByTestId("chip-semua")).toHaveAttribute("aria-pressed", "true");
    await expect(page.getByTestId("chip-kategori-k-dairy-katalog")).toBeVisible();
    await expect(page.getByTestId("chip-kategori-k-snack-katalog")).toBeVisible();
    await expect(page.getByTestId("chip-tag-tag-promo")).toBeVisible();

    await page.getByTestId("chip-kategori-k-dairy-katalog").click();
    await expect(page.getByTestId("sku-card-sku-susu")).toBeVisible();
    await expect(page.getByTestId("sku-card-sku-roti")).toHaveCount(0);
    await expect(page.getByTestId("chip-kategori-k-dairy-katalog")).toHaveAttribute("aria-pressed", "true");

    await page.getByTestId("chip-semua").click();
    await expect(page.getByTestId("chip-semua")).toHaveAttribute("aria-pressed", "true");
    await expect(page.getByTestId("sku-card-sku-roti")).toBeVisible();

    await page.getByTestId("chip-tag-tag-promo").click();
    await expect(page.getByTestId("sku-card-sku-susu")).toBeVisible();
    await expect(page.getByTestId("sku-card-sku-roti")).toHaveCount(0);

    await page.getByTestId("chip-semua").click();

    await search.fill("susu");
    await page.waitForTimeout(150);
    await expect(page.getByTestId("sku-card-sku-susu")).toBeVisible();
    await expect(page.getByTestId("sku-card-sku-roti")).toBeVisible();
    await page.waitForTimeout(250);
    await expect(page.getByTestId("sku-card-sku-susu")).toBeVisible();
    await expect(page.getByTestId("sku-card-sku-roti")).toHaveCount(0);
    await expect(page.getByTestId("sku-card-sku-beras")).toHaveCount(0);

    await search.fill(kodeSusu.slice(0, 6));
    await page.waitForTimeout(400);
    await expect(page.getByTestId("sku-card-sku-susu")).toBeVisible();
    await expect(page.getByTestId("sku-card-sku-roti")).toHaveCount(0);

    await search.fill("899002");
    await page.waitForTimeout(400);
    await expect(page.getByTestId("sku-card-sku-roti")).toBeVisible();
    await expect(page.getByTestId("sku-card-sku-susu")).toHaveCount(0);

    await search.fill("promo");
    await page.waitForTimeout(400);
    await expect(page.getByTestId("sku-card-sku-susu")).toBeVisible();
    await expect(page.getByTestId("sku-card-sku-roti")).toHaveCount(0);

    await search.fill("xyz-tidak-ada-123");
    await page.waitForTimeout(400);
    await expect(page.getByTestId("katalog-empty-search")).toBeVisible();
    await expect(page.getByText(/Tidak ada hasil/)).toBeVisible();

    await search.fill("");
    await page.waitForTimeout(400);
    await expect(page.getByTestId("sku-card-sku-susu")).toBeVisible();
    await expect(page.getByTestId("sku-card-sku-roti")).toBeVisible();
    await expect(page.getByTestId("sku-card-sku-beras")).toBeVisible();
  });

  test("badge kritis ikut threshold kategori max via engine expiry", async ({ page }) => {
    await page.evaluate(async () => {
      const w = window as unknown as Record<string, unknown>;
      const repo = w.__REAL_REPO__ as {
        createKategori: (k: { id: string; nama: string; threshold_h_minus: number[]; org_id: string }) => Promise<void>;
        createSku: (s: { id: string; nama: string; kategori_id: string; hpp: number; harga_normal: number; barcode?: string; kode?: string; org_id: string }) => Promise<void>;
        createBatch: (b: { id: string; sku_id: string; qty: number; expiry_date: string | null; received_at: string; hpp_snapshot: number; org_id: string }) => Promise<void>;
      };
      const fmt = (days: number) => {
        const f = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Jakarta", year: "numeric", month: "2-digit", day: "2-digit" });
        const parts = f.formatToParts(new Date());
        const y = Number(parts.find((p) => p.type === "year")!.value);
        const m = Number(parts.find((p) => p.type === "month")!.value) - 1;
        const d = Number(parts.find((p) => p.type === "day")!.value);
        const base = Date.UTC(y, m, d, 0, 0, 0, 0) - 7 * 60 * 60 * 1000;
        const exp = new Date(base + days * 86_400_000);
        const f2 = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Jakarta", year: "numeric", month: "2-digit", day: "2-digit" });
        return f2.format(exp);
      };
      await repo.createKategori({ id: "k-kritis", nama: "KritisCat", threshold_h_minus: [7, 3, 1], org_id: "toko-01" });
      await repo.createKategori({ id: "k-long", nama: "LongCat", threshold_h_minus: [14, 7, 3], org_id: "toko-01" });
      await repo.createSku({ id: "sku-kritis-1", nama: "Yoghurt Kritis", kategori_id: "k-kritis", hpp: 5000, harga_normal: 8000, kode: "YOG-001", org_id: "toko-01" });
      await repo.createSku({ id: "sku-aman-1", nama: "Biskuit Aman", kategori_id: "k-kritis", hpp: 4000, harga_normal: 6000, kode: "BIS-001", org_id: "toko-01" });
      await repo.createSku({ id: "sku-long-kritis", nama: "Keju Long", kategori_id: "k-long", hpp: 20000, harga_normal: 30000, kode: "KEJ-001", org_id: "toko-01" });
      await repo.createBatch({ id: "batch-kritis-1", sku_id: "sku-kritis-1", qty: 10, expiry_date: fmt(2), received_at: new Date().toISOString(), hpp_snapshot: 5000, org_id: "toko-01" });
      await repo.createBatch({ id: "batch-aman-1", sku_id: "sku-aman-1", qty: 20, expiry_date: fmt(10), received_at: new Date().toISOString(), hpp_snapshot: 4000, org_id: "toko-01" });
      await repo.createBatch({ id: "batch-long-1", sku_id: "sku-long-kritis", qty: 5, expiry_date: fmt(10), received_at: new Date().toISOString(), hpp_snapshot: 20000, org_id: "toko-01" });
      await repo.createSku({ id: "sku-null", nama: "Garam Null", kategori_id: "k-kritis", hpp: 2000, harga_normal: 3000, kode: "GAR-001", org_id: "toko-01" });
      await repo.createBatch({ id: "batch-null-1", sku_id: "sku-null", qty: 15, expiry_date: null, received_at: new Date().toISOString(), hpp_snapshot: 2000, org_id: "toko-01" });
    });

    await page.reload();
    await page.getByTestId("nav-sku").click();
    await expect(page.getByTestId("katalog-page")).toBeVisible({ timeout: 10_000 });
    await expect(page.getByTestId("sku-card-sku-kritis-1")).toBeVisible({ timeout: 10_000 });
    await expect(page.getByTestId("badge-kritis-sku-kritis-1")).toBeVisible();
    await expect(page.getByTestId("badge-kritis-sku-kritis-1")).toContainText("Kritis");
    await expect(page.getByTestId("badge-kritis-sku-aman-1")).toHaveCount(0);
    await expect(page.getByTestId("badge-kritis-sku-long-kritis")).toBeVisible();
    await expect(page.getByTestId("badge-kritis-sku-null")).toHaveCount(0);
  });

  test("expand SKU → BatchRows dan tombol Tambah SKU navigasi benar", async ({ page }) => {
    await page.evaluate(async () => {
      const w = window as unknown as Record<string, unknown>;
      const repo = w.__REAL_REPO__ as {
        createKategori: (k: { id: string; nama: string; threshold_h_minus: number[]; org_id: string }) => Promise<void>;
        createSku: (s: { id: string; nama: string; kategori_id: string; hpp: number; harga_normal: number; org_id: string }) => Promise<void>;
        createBatch: (b: { id: string; sku_id: string; qty: number; expiry_date: string | null; received_at: string; hpp_snapshot: number; org_id: string }) => Promise<void>;
      };
      const fmt = (days: number) => {
        const f = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Jakarta", year: "numeric", month: "2-digit", day: "2-digit" });
        const parts = f.formatToParts(new Date());
        const y = Number(parts.find((p) => p.type === "year")!.value);
        const m = Number(parts.find((p) => p.type === "month")!.value) - 1;
        const d = Number(parts.find((p) => p.type === "day")!.value);
        const base = Date.UTC(y, m, d, 0, 0, 0, 0) - 7 * 60 * 60 * 1000;
        const exp = new Date(base + days * 86_400_000);
        const f2 = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Jakarta", year: "numeric", month: "2-digit", day: "2-digit" });
        return f2.format(exp);
      };
      await repo.createKategori({ id: "k-expand", nama: "ExpandCat", threshold_h_minus: [7, 3, 1], org_id: "toko-01" });
      await repo.createSku({ id: "sku-expand", nama: "Susu Expand", kategori_id: "k-expand", hpp: 9000, harga_normal: 13000, org_id: "toko-01" });
      await repo.createBatch({ id: "batch-exp-1", sku_id: "sku-expand", qty: 12, expiry_date: fmt(5), received_at: new Date().toISOString(), hpp_snapshot: 9000, org_id: "toko-01" });
      await repo.createBatch({ id: "batch-exp-2", sku_id: "sku-expand", qty: 8, expiry_date: null, received_at: new Date().toISOString(), hpp_snapshot: 9000, org_id: "toko-01" });
    });
    await page.reload();
    await page.getByTestId("nav-sku").click();
    await expect(page.getByTestId("sku-card-sku-expand")).toBeVisible({ timeout: 10_000 });
    await expect(page.getByTestId("batch-rows-sku-expand")).toHaveCount(0);
    await page.getByTestId("sku-expand-sku-expand").click();
    await expect(page.getByTestId("batch-rows-sku-expand")).toBeVisible();
    await expect(page.getByTestId("batch-row-batch-exp-1")).toBeVisible();
    await expect(page.getByTestId("batch-row-batch-exp-2")).toBeVisible();
    await expect(page.getByTestId("batch-row-batch-exp-2")).toContainText("Tanpa kadaluarsa");
    await page.getByTestId("sku-expand-sku-expand").click();
    await expect(page.getByTestId("batch-rows-sku-expand")).toHaveCount(0);
    const tambahBtn = page.getByTestId("btn-tambah-sku");
    await expect(tambahBtn).toBeVisible();
    await expect(tambahBtn).toHaveCSS("min-height", "48px");
    await expect(tambahBtn).toHaveCSS("font-size", "16px");
    await tambahBtn.click();
    await expect(page).toHaveURL(/\/sku\/baru/);
    await expect(page.getByText("segera hadir")).toBeVisible();
  });

  test("search kosong → tampil semua, tidak ada dispatch kosong katalog:tambah-sku", async ({ page }) => {
    await page.evaluate(async () => {
      const w = window as unknown as Record<string, unknown>;
      const repo = w.__REAL_REPO__ as {
        createKategori: (k: { id: string; nama: string; threshold_h_minus: number[]; org_id: string }) => Promise<void>;
        createSku: (s: { id: string; nama: string; kategori_id: string; hpp: number; harga_normal: number; org_id: string }) => Promise<void>;
      };
      await repo.createKategori({ id: "k-search-empty", nama: "SearchCat", threshold_h_minus: [7, 3, 1], org_id: "toko-01" });
      await repo.createSku({ id: "sku-a", nama: "Apel Fuji", kategori_id: "k-search-empty", hpp: 5000, harga_normal: 7000, org_id: "toko-01" });
    });
    await page.reload();
    await page.getByTestId("nav-sku").click();
    await expect(page.getByTestId("sku-card-sku-a")).toBeVisible({ timeout: 10_000 });
    const search = page.getByTestId("katalog-search");
    await search.fill("");
    await page.waitForTimeout(400);
    await expect(page.getByTestId("sku-card-sku-a")).toBeVisible();
    await expect(page.getByTestId("katalog-count")).toContainText("1 SKU");

    const hasDispatch = await page.evaluate(() => {
      const html = document.documentElement.innerHTML;
      return html.includes("katalog:tambah-sku");
    });
    expect(hasDispatch).toBe(false);

    const listenerFired = await page.evaluate(() => {
      let fired = false;
      const handler = () => { fired = true; };
      window.addEventListener("katalog:tambah-sku", handler as EventListener);
      const btn = document.querySelector('[data-testid="btn-tambah-sku"]') as HTMLElement | null;
      btn?.click();
      window.removeEventListener("katalog:tambah-sku", handler as EventListener);
      return fired;
    });
    expect(listenerFired).toBe(false);
    await expect(page).toHaveURL(/\/sku\/baru/);
  });
});
