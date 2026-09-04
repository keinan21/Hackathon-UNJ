import { test, expect } from "@playwright/test";

async function loginSetup(page: import("@playwright/test").Page, nama = "Toko Promo") {
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

async function seedPromoScenario(
  page: import("@playwright/test").Page,
  opts: { promoId: string; harga: number; qty: number; batchId: string; skuId: string },
) {
  await page.evaluate(
    async ({ p, exp }) => {
      const w = window as unknown as Record<string, unknown>;
      const repo = w.__REAL_REPO__ as {
        createKategori: (k: { id: string; nama: string; threshold_h_minus: number[]; org_id: string }) => Promise<void>;
        createSku: (s: { id: string; nama: string; kategori_id: string; hpp: number; harga_normal: number; kode?: string; org_id: string }) => Promise<void>;
        createBatch: (b: { id: string; sku_id: string; qty: number; expiry_date: string | null; received_at: string; hpp_snapshot: number; org_id: string }) => Promise<void>;
        createPromo: (pr: { id: string; batch_id: string; sku_pasangan_id: string | null; harga_tebus: number; status: string; org_id: string; created_at: string }) => Promise<void>;
        createTransaksi: (t: unknown) => Promise<void>;
      };
      const dv = w.__DEXIE_V2__ as { batches: { put: (o: unknown) => Promise<void> } };
      const cat = { id: "k-promo", nama: "Dairy", threshold_h_minus: [7, 3, 1], org_id: "toko-01" };
      await repo.createKategori(cat).catch(() => {});
      await repo.createSku({ id: p.skuId, nama: "Susu UHT 1L", kategori_id: cat.id, hpp: 10000, harga_normal: 15000, kode: "SUS-001", org_id: "toko-01" }).catch(() => {});
      await repo.createSku({ id: "sku-roti", nama: "Roti Tawar", kategori_id: cat.id, hpp: 8000, harga_normal: 12000, kode: "ROT-001", org_id: "toko-01" }).catch(() => {});
      if (p.qty <= 0) {
        await dv.batches.put({ id: p.batchId, sku_id: p.skuId, qty: 0, expiry_date: exp, received_at: new Date().toISOString(), hpp_snapshot: 10000, org_id: "toko-01" });
      } else {
        await repo.createBatch({ id: p.batchId, sku_id: p.skuId, qty: p.qty, expiry_date: exp, received_at: new Date().toISOString(), hpp_snapshot: 10000, org_id: "toko-01" });
      }
      await repo.createPromo({ id: p.promoId, batch_id: p.batchId, sku_pasangan_id: "sku-roti", harga_tebus: p.harga, status: "proposed", org_id: "toko-01", created_at: new Date().toISOString() });
    },
    { p: opts, exp: expiryFor(2) },
  );
}

test.describe("Promo approve real + histori real", () => {
  test.beforeEach(async ({ page }) => {
    await loginSetup(page);
    await page.waitForTimeout(300);
    await clearDexie(page);
    await page.waitForTimeout(200);
  });

  test("happy: proposed → Setujui → Dialog Yakin → active + toast + dashboard", async ({ page }) => {
    await seedPromoScenario(page, { promoId: "promo-happy", harga: 9000, qty: 10, batchId: "batch-happy", skuId: "sku-susu-happy" });
    await page.goto("/?view=promo");
    await page.waitForTimeout(800);
    await expect(page.getByRole("heading", { name: "Promo Tebus Murah" })).toBeVisible({ timeout: 10_000 });
    const card = page.getByTestId("promo-card-proposed").first();
    await expect(card).toBeVisible({ timeout: 10_000 });
    await expect(card.getByText("Susu UHT 1L")).toBeVisible();
    const btn = page.getByTestId("btn-setujui-tebus").first();
    await expect(btn).toBeVisible();
    await expect(btn).toHaveCSS("min-height", "48px");
    await expect(btn).toHaveCSS("font-size", "16px");
    await btn.click();
    const dialog = page.getByRole("dialog");
    await expect(dialog).toBeVisible({ timeout: 5000 });
    await expect(dialog).toHaveAttribute("aria-modal", "true");
    await expect(page.getByText(/Yakin setujui tebus murah/).first()).toBeVisible();
    await expect(page.getByText(/Tebus Rp9\.000/).first()).toBeVisible();
    const yakin = page.getByTestId("dialog-confirm-yakin");
    await expect(yakin).toBeVisible();
    await expect(yakin).toHaveCSS("min-height", "48px");
    await expect(yakin).toBeEnabled();
    await yakin.click();
    await expect(dialog).toHaveCount(0, { timeout: 5000 });
    await expect(page.getByTestId("promo-card-active").first()).toBeVisible({ timeout: 10_000 });
    await expect(page.getByText("Promo Aktif (1)")).toBeVisible();
    const toast = page.getByTestId("promo-toast");
    await expect(toast).toBeVisible({ timeout: 5000 });
    await expect(toast).toHaveAttribute("role", "status");
    await expect(page.getByText("Tebus murah aktif, tampil di Dashboard")).toBeVisible();
    const dismiss = page.getByTestId("toast-dismiss-x");
    await dismiss.click();
    await expect(toast).toHaveCount(0);
    await page.goto("/?view=dashboard");
    await page.waitForTimeout(400);
    await expect(page.getByTestId("dashboard-page")).toBeVisible();
    await expect(page.getByTestId("promo-card-active").first()).toBeVisible({ timeout: 5000 });
  });

  test("guardrail fail di bawah floor disabled dan alert Rp", async ({ page }) => {
    await seedPromoScenario(page, { promoId: "promo-guard", harga: 8400, qty: 10, batchId: "batch-guard", skuId: "sku-susu-guard" });
    await page.goto("/?view=promo");
    await page.waitForTimeout(800);
    await expect(page.getByTestId("promo-card-proposed").first()).toBeVisible({ timeout: 10_000 });
    await expect(page.getByText(/Di bawah floor Rp8\.500/).first()).toBeVisible();
    const btn = page.getByTestId("btn-setujui-tebus").first();
    await btn.click();
    const dialog = page.getByRole("dialog");
    await expect(dialog).toBeVisible();
    await expect(dialog.getByText(/Harga tebus tidak boleh di bawah HPP x 0\.85 \(Rp 8\.500\)/).first()).toBeVisible();
    const yakin = page.getByTestId("dialog-confirm-yakin");
    await expect(yakin).toBeDisabled();
    await expect(yakin).toContainText("Tidak bisa setujui");
    const batal = page.getByTestId("dialog-cancel-batal");
    await expect(batal).toBeVisible();
    await expect(batal).toHaveCSS("min-height", "48px");
    await batal.click();
    await expect(dialog).toHaveCount(0);
    await expect(page.getByTestId("promo-card-proposed").first()).toBeVisible();
  });

  test("tolak menghapus proposed + toast", async ({ page }) => {
    await seedPromoScenario(page, { promoId: "promo-tolak", harga: 9000, qty: 10, batchId: "batch-tolak", skuId: "sku-susu-tolak" });
    await page.goto("/?view=promo");
    await page.waitForTimeout(800);
    await expect(page.getByTestId("promo-card-proposed").first()).toBeVisible({ timeout: 10_000 });
    const tolakBtn = page.getByTestId("btn-tolak-promo").first();
    await expect(tolakBtn).toBeVisible();
    await expect(tolakBtn).toHaveCSS("min-height", "48px");
    await tolakBtn.click();
    await expect(page.getByTestId("promo-card-proposed")).toHaveCount(0, { timeout: 5000 });
    const toast = page.getByTestId("promo-toast");
    await expect(toast).toBeVisible({ timeout: 5000 });
    await expect(page.getByText("Usulan ditolak")).toBeVisible();
    const gone = await page.evaluate(async () => {
      const w = window as unknown as Record<string, unknown>;
      const repo = w.__REAL_REPO__ as { getPromo: (id: string) => Promise<unknown> };
      const p = await repo.getPromo("promo-tolak");
      return p === undefined;
    });
    expect(gone).toBe(true);
  });

  test("approve tanpa stok → error Stok habis, tidak ubah status", async ({ page }) => {
    await seedPromoScenario(page, { promoId: "promo-nostock", harga: 9000, qty: 0, batchId: "batch-nostock", skuId: "sku-susu-nostock" });
    await page.goto("/?view=promo");
    await page.waitForTimeout(800);
    await expect(page.getByTestId("promo-card-proposed").first()).toBeVisible({ timeout: 10_000 });
    await page.getByTestId("btn-setujui-tebus").first().click();
    const dialog = page.getByRole("dialog");
    await expect(dialog).toBeVisible();
    await page.getByTestId("dialog-confirm-yakin").click();
    const err = page.getByTestId("promo-error");
    await expect(err).toBeVisible({ timeout: 5000 });
    await expect(err).toHaveAttribute("role", "alert");
    await expect(err).toContainText("Stok habis, tidak bisa approve tebus murah");
    await expect(dialog).toBeVisible();
    await page.getByTestId("dialog-cancel-batal").click();
    await expect(dialog).toHaveCount(0);
    await expect(page.getByTestId("promo-card-proposed").first()).toBeVisible();
    await expect(page.getByTestId("promo-card-active")).toHaveCount(0);
    const stillProposed = await page.evaluate(async () => {
      const w = window as unknown as Record<string, unknown>;
      const repo = w.__REAL_REPO__ as { getPromo: (id: string) => Promise<{ status: string }> };
      const p = await repo.getPromo("promo-nostock");
      return p?.status;
    });
    expect(stillProposed).toBe("proposed");
  });

  test("empty state Indonesia ketika belum ada promo + histori 5 terbaru real", async ({ page }) => {
    await page.goto("/?view=promo");
    await page.waitForTimeout(800);
    await expect(page.getByText("Belum ada promo aktif. Buat tebus murah dari stok mepet biar tidak jadi sampah.")).toBeVisible({ timeout: 10_000 });
    await page.goto("/?view=dashboard");
    await page.waitForTimeout(600);
    await expect(page.getByTestId("section-histori").first()).toBeVisible();
    await expect(page.getByTestId("histori-empty")).toBeVisible();
    await expect(page.getByText("Belum ada histori saran. Buat promo dulu.")).toBeVisible();
    const svg = page.locator('[data-testid="histori-empty"] svg');
    await expect(svg).toBeVisible();
    await page.evaluate(async () => {
      const w = window as unknown as Record<string, unknown>;
      const repo = w.__REAL_REPO__ as {
        createKategori: (k: { id: string; nama: string; threshold_h_minus: number[]; org_id: string }) => Promise<void>;
        createSku: (s: { id: string; nama: string; kategori_id: string; hpp: number; harga_normal: number; kode?: string; org_id: string }) => Promise<void>;
        createBatch: (b: { id: string; sku_id: string; qty: number; expiry_date: string | null; received_at: string; hpp_snapshot: number; org_id: string }) => Promise<void>;
        createPromo: (pr: { id: string; batch_id: string; sku_pasangan_id: string | null; harga_tebus: number; status: string; org_id: string; created_at: string }) => Promise<void>;
      };
      const cat = { id: "k-hist", nama: "Dairy", threshold_h_minus: [7, 3, 1], org_id: "toko-01" };
      await repo.createKategori(cat).catch(() => {});
      await repo.createSku({ id: "sku-hist", nama: "Susu UHT 1L", kategori_id: cat.id, hpp: 10000, harga_normal: 15000, kode: "SUS-H", org_id: "toko-01" }).catch(() => {});
      await repo.createSku({ id: "sku-pair", nama: "Roti", kategori_id: cat.id, hpp: 5000, harga_normal: 7000, kode: "ROT-H", org_id: "toko-01" }).catch(() => {});
      const fmt = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Jakarta", year: "numeric", month: "2-digit", day: "2-digit" });
      const exp = fmt.format(new Date(Date.now() + 2 * 86_400_000));
      await repo.createBatch({ id: "batch-hist", sku_id: "sku-hist", qty: 5, expiry_date: exp, received_at: new Date().toISOString(), hpp_snapshot: 10000, org_id: "toko-01" }).catch(() => {});
      for (let i = 0; i < 7; i++) {
        const created = new Date(Date.now() - i * 60_000).toISOString();
        await repo.createPromo({ id: `promo-hist-${i}`, batch_id: "batch-hist", sku_pasangan_id: "sku-pair", harga_tebus: 9000 + i, status: i < 3 ? "proposed" : "active", org_id: "toko-01", created_at: created });
      }
    });
    await page.reload();
    await page.waitForTimeout(800);
    await page.goto("/?view=dashboard");
    await page.waitForTimeout(600);
    await expect(page.getByTestId("section-histori").first()).toBeVisible();
    const items = page.locator('[data-testid="histori-hist-"], [data-testid^="promo-hist-"]');
    const count = await items.count();
    if (count === 5) {
      await expect(items).toHaveCount(5, { timeout: 10_000 });
    } else {
      const fallback = page.locator('[data-testid="section-histori"] li');
      await expect(fallback.first()).toBeVisible({ timeout: 10_000 });
      await expect(fallback).toHaveCount(5, { timeout: 10_000 });
    }
  });
});
