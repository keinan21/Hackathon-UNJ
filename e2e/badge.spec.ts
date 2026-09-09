import { test, expect } from "@playwright/test";

function hexToRgb(hex: string): string {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgb(${r}, ${g}, ${b})`;
}

function expiryFor(days: number): string {
  const fmt = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Jakarta", year: "numeric", month: "2-digit", day: "2-digit" });
  const parts = fmt.formatToParts(new Date());
  const y = Number(parts.find((p) => p.type === "year")!.value);
  const m = Number(parts.find((p) => p.type === "month")!.value) - 1;
  const d = Number(parts.find((p) => p.type === "day")!.value);
  const base = Date.UTC(y, m, d, 0, 0, 0, 0) - 7 * 60 * 60 * 1000;
  return fmt.format(new Date(base + days * 86_400_000));
}

type SeedBatch = { id: string; sku: string; qty: number; days: number | null };

async function seedUrgent(
  page: import("@playwright/test").Page,
  batches: SeedBatch[],
  thresholds: number[] = [7, 3, 1],
) {
  const payload = batches.map((b) => ({ id: b.id, sku: b.sku, qty: b.qty, expiry: b.days === null ? null : expiryFor(b.days) }));
  await page.evaluate(
    async ({ items, thr }) => {
      const w = window as unknown as Record<string, unknown>;
      const repo = w.__REAL_REPO__ as {
        clearAll: (o: string) => Promise<void>;
        createKategori: (k: { id: string; nama: string; threshold_h_minus: number[]; org_id: string }) => Promise<void>;
        createSku: (s: { id: string; nama: string; kategori_id: string; hpp: number; harga_normal: number; kode?: string; org_id: string }) => Promise<void>;
        createBatch: (b: { id: string; sku_id: string; qty: number; expiry_date: string | null; received_at: string; hpp_snapshot: number; org_id: string }) => Promise<void>;
      };
      await repo.clearAll("toko-01");
      await repo.createKategori({ id: "k-dairy", nama: "Dairy", threshold_h_minus: thr, org_id: "toko-01" }).catch(() => {});
      await repo.createKategori({ id: "k-snack", nama: "Snack", threshold_h_minus: thr, org_id: "toko-01" }).catch(() => {});
      const skus = [
        { id: "sku-susu", nama: "Susu UHT 1L", kategori_id: "k-dairy", hpp: 10000, harga_normal: 15000, kode: "SUS-001", org_id: "toko-01" },
        { id: "sku-yoghurt", nama: "Yoghurt Cup 100ml", kategori_id: "k-dairy", hpp: 8000, harga_normal: 12000, kode: "YOG-001", org_id: "toko-01" },
        { id: "sku-roti", nama: "Roti Tawar", kategori_id: "k-snack", hpp: 8000, harga_normal: 12000, kode: "ROT-001", org_id: "toko-01" },
      ];
      for (const s of skus) await repo.createSku(s).catch(() => {});
      const now = new Date().toISOString();
      for (const b of items as { id: string; sku: string; qty: number; expiry: string | null }[]) {
        await repo
          .createBatch({ id: b.id, sku_id: b.sku, qty: b.qty, expiry_date: b.expiry, received_at: now, hpp_snapshot: 8000, org_id: "toko-01" })
          .catch(() => {});
      }
    },
    { items: payload, thr: thresholds },
  );
  await page.reload();
  await expect(page.getByRole("heading", { name: "Stok Mepet" })).toBeVisible({ timeout: 10_000 });
  await page.waitForTimeout(500);
}

test.describe("Badge & Urgent List", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/?seed=demo");
    await expect(page.getByTestId("dashboard-page")).toBeVisible({ timeout: 10_000 });
  });

  test("happy: 3 batches H-1/H-3/H-10 shows 2 urgent H-1 red+icon H-3 orange H-10 hidden", async ({ page }) => {
    await seedUrgent(page, [
      { id: "b-h1", sku: "sku-susu", qty: 10, days: 1 },
      { id: "b-h3", sku: "sku-yoghurt", qty: 8, days: 3 },
      { id: "b-h10", sku: "sku-roti", qty: 5, days: 10 },
    ]);

    const items = page.locator('[aria-label="Daftar stok mepet"] li');
    await expect(items).toHaveCount(2);

    const h1Badge = page.getByLabel("Stok mepet H-1", { exact: false }).first();
    await expect(h1Badge).toBeVisible();
    await expect(h1Badge).toHaveText(/H-1/);
    await expect(h1Badge).toHaveCSS("background-color", hexToRgb("#C62828"));
    await expect(h1Badge).toHaveCSS("color", hexToRgb("#FFFFFF"));
    await expect(h1Badge.locator("svg")).toBeVisible();

    const h3Badge = page.getByLabel("Stok mepet H-3", { exact: false }).first();
    await expect(h3Badge).toBeVisible();
    await expect(h3Badge).toHaveText(/H-3/);
    await expect(h3Badge).toHaveCSS("background-color", hexToRgb("#EF6C00"));
    await expect(h3Badge).toHaveCSS("color", hexToRgb("#1A1A1A"));
    await expect(h3Badge.locator("svg")).toBeVisible();

    await expect(page.getByLabel(/H-10/)).toHaveCount(0);
    await expect(page.getByLabel("Stok mepet H-1", { exact: false })).toHaveAttribute("aria-label", /Stok mepet H-1, 10 pcs, kadaluarsa \d{4}-\d{2}-\d{2}/);
  });

  test("count shows N perlu perhatian", async ({ page }) => {
    await seedUrgent(page, [
      { id: "b-h1", sku: "sku-susu", qty: 10, days: 1 },
      { id: "b-h3", sku: "sku-yoghurt", qty: 8, days: 3 },
    ]);
    await expect(page.getByText("2 perlu perhatian")).toBeVisible();
  });

  test("dropdown filter kategori narrows list, Semua restores", async ({ page }) => {
    await seedUrgent(page, [
      { id: "b-h1", sku: "sku-susu", qty: 10, days: 1 },
      { id: "b-h3", sku: "sku-roti", qty: 8, days: 3 },
    ]);

    const filter = page.getByTestId("filter-kategori");
    await expect(filter).toBeVisible();
    await expect(filter).toHaveValue("Semua");

    await filter.selectOption("Dairy");
    const items = page.locator('[aria-label="Daftar stok mepet"] li');
    await expect(items).toHaveCount(1);
    await expect(items.first()).toContainText("Susu UHT 1L");

    await filter.selectOption("Semua");
    await expect(items).toHaveCount(2);
  });

  test("pagination shows 50 then Lihat semua loads rest", async ({ page }) => {
    const many: SeedBatch[] = Array.from({ length: 60 }, (_, i) => ({ id: `b-${i}`, sku: "sku-susu", qty: 1, days: 1 }));
    await seedUrgent(page, many, [30, 14, 7]);
    const items = page.locator('[aria-label="Daftar stok mepet"] li');
    await expect(items).toHaveCount(50);
    const lihatSemua = page.getByRole("button", { name: /Lihat semua/ });
    await expect(lihatSemua).toBeVisible();
    await expect(lihatSemua).toHaveCSS("min-height", "48px");
    await expect(lihatSemua).toHaveCSS("font-size", "16px");

    await lihatSemua.click();
    await expect(items).toHaveCount(60);
    await expect(lihatSemua).toHaveCount(0);
    await expect(page.getByText("60 perlu perhatian")).toBeVisible();
  });

  test("failure: expiry null batch shows no badge and empty state", async ({ page }) => {
    await seedUrgent(page, [{ id: "b-null", sku: "sku-susu", qty: 10, days: null }]);
    await expect(page.getByText("Stok aman semua")).toBeVisible();
    await expect(page.getByText("Tidak ada yang mepet kadaluarsa. Cek lagi besok jam 7 pagi.")).toBeVisible();
    await expect(page.getByLabel(/Stok mepet H-/)).toHaveCount(0);
    await expect(page.locator('[role="status"][aria-live="polite"]').first()).toBeVisible();
  });

  test("a11y: aria-label, select 48px/16px, aria-live, full-width primary button, iconoir", async ({ page }) => {
    await seedUrgent(page, [
      { id: "b-h1", sku: "sku-susu", qty: 10, days: 1 },
      { id: "b-h3", sku: "sku-yoghurt", qty: 8, days: 3 },
    ]);

    const badge = page.getByLabel(/Stok mepet H-/).first();
    await expect(badge).toBeVisible();
    await expect(badge).toHaveAttribute("aria-label", /Stok mepet H-/);

    const filter = page.getByTestId("filter-kategori");
    await expect(filter).toHaveCSS("min-height", "48px");
    await expect(filter).toHaveCSS("font-size", "16px");

    await expect(page.locator('[aria-live="polite"]').first()).toBeVisible();
    await expect(page.getByText("2 perlu perhatian")).toBeVisible();

    const primaryBtn = page.getByRole("button", { name: /Lihat Saran Tebus/i }).first();
    await expect(primaryBtn).toBeVisible();
    await expect(primaryBtn).toHaveCSS("min-height", "48px");
    await expect(primaryBtn).toHaveCSS("font-size", "16px");
    await expect(primaryBtn).toHaveClass(/btn-primary/);
    await expect(primaryBtn).toHaveClass(/btn-block/);
    const box = await primaryBtn.boundingBox();
    expect(box).not.toBeNull();
    expect(box!.width).toBeGreaterThan(200);

    await expect(badge.locator("svg")).toBeVisible();

    const statuses = page.locator('[role="status"][aria-live="polite"]');
    await expect(statuses.first()).toBeVisible();

    const qtyText = page.locator('[aria-label="Daftar stok mepet"] >> text=pcs').first();
    await expect(qtyText).toHaveCSS("font-size", "16px");
  });

  test("sort select expiry vs urgency changes order", async ({ page }) => {
    await seedUrgent(page, [
      { id: "b-h3", sku: "sku-susu", qty: 2, days: 3 },
      { id: "b-h1", sku: "sku-yoghurt", qty: 20, days: 1 },
    ]);
    const items = page.locator('[aria-label="Daftar stok mepet"] li');
    await expect(items.first()).toContainText("Yoghurt");

    const sort = page.getByTestId("sort-order");
    await expect(sort).toBeVisible();
    await sort.selectOption("urgency");
    await expect(items.first()).toContainText("Susu UHT 1L");

    await sort.selectOption("expiry");
    await expect(items.first()).toContainText("Yoghurt");
  });

  test("urgent card links to SKU detail page", async ({ page }) => {
    await seedUrgent(page, [{ id: "b-h1", sku: "sku-susu", qty: 10, days: 1 }]);
    await page.getByTestId("sku-detail-sku-susu").click();
    await expect(page).toHaveURL(/\/sku\/sku-susu/);
    await expect(page.getByTestId("sku-detail-page")).toBeVisible({ timeout: 10_000 });
  });

  test("H-7 badge uses theme info color with dark text", async ({ page }) => {
    await seedUrgent(page, [{ id: "b-h7", sku: "sku-susu", qty: 5, days: 7 }]);
    const h7Badge = page.getByLabel(/Stok mepet H-7/).first();
    await expect(h7Badge).toBeVisible();
    await expect(h7Badge).toHaveCSS("background-color", hexToRgb("#F9A825"));
    await expect(h7Badge).toHaveCSS("color", hexToRgb("#1A1A1A"));
  });
});
