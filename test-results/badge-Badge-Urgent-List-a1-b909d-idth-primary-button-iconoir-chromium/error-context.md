# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: badge.spec.ts >> Badge & Urgent List >> a11y: aria-label, select 48px/16px, aria-live, full-width primary button, iconoir
- Location: e2e/badge.spec.ts:145:3

# Error details

```
Error: expect(locator).toBeVisible() failed

Locator: getByRole('button', { name: /Lihat Saran Tebus/i }).first()
Expected: visible
Timeout: 5000ms
Error: element(s) not found

Call log:
  - Expect "toBeVisible" with timeout 5000ms
  - waiting for getByRole('button', { name: /Lihat Saran Tebus/i }).first()

```

```yaml
- banner:
  - img
  - heading "Inventaris Tebus Murah" [level=1]
  - text: PWA
- main:
  - img
  - heading "Ringkasan Warung" [level=2]
  - paragraph: Pantau stok mepet, promo tebus, dan histori — semua 3 tap sampai approve.
  - alert:
    - text: Notifikasi dimatikan, badge tetap update
    - button "Tutup banner notifikasi": Tutup
  - alert:
    - paragraph: Ada 2 batch kritis
    - paragraph: Tap untuk lihat daftar lengkap per batch
    - button "Lihat 2 batch kritis": Lihat Kritis
  - navigation "Navigasi cepat warung":
    - button "Barang Masuk"
    - button "Kasir"
    - button "Lihat SKU"
    - button "Statistik"
  - region "Stok Mepet":
    - heading "Stok Mepet" [level=2]
    - status: 2 perlu perhatian
    - text: Filter kategori
    - combobox "Filter kategori":
      - option "Semua kategori" [selected]
      - option "Perawatan Diri"
      - option "Makanan Kering"
      - option "Sembako"
      - option "Bumbu Dapur"
      - option "Makanan Basah"
      - option "Minuman Kaleng"
      - option "Obat Bebas"
      - option "Makanan Frozen"
      - option "Misc"
      - option "Minuman Botol"
      - option "Rokok"
      - option "Dairy"
      - option "Snack"
    - text: Urutkan stok mepet
    - combobox "Urutkan stok mepet":
      - 'option "Urut: paling dekat" [selected]'
      - 'option "Urut: paling mendesak"'
    - list "Daftar stok mepet":
      - listitem:
        - paragraph: Susu UHT 1L
        - paragraph: Sisa 10 pcs • kadaluarsa 2026-09-08
        - text: Dairy
        - status "Stok mepet H-1, 10 pcs, kadaluarsa 2026-09-08": H-1
        - button "Lihat daftar kritis Susu UHT 1L": Lihat
      - listitem:
        - paragraph: Yoghurt Cup 100ml
        - paragraph: Sisa 8 pcs • kadaluarsa 2026-09-10
        - text: Dairy
        - status "Stok mepet H-3, 8 pcs, kadaluarsa 2026-09-10": H-3
        - button "Lihat daftar kritis Yoghurt Cup 100ml": Lihat
    - status: 2 item mepet kadaluarsa
  - region "Promo Tebus Murah":
    - heading "Promo Tebus Murah" [level=2]
    - status:
      - paragraph: Belum ada promo
      - paragraph: Buat tebus murah dari stok mepet biar tidak jadi sampah.
      - button "Lihat Stok Mepet"
    - text: 0 promo aktif
  - region "Histori Saran":
    - heading "Histori Saran" [level=2]
    - status:
      - paragraph: Belum ada saran tersimpan
      - paragraph: Saran baru muncul tiap jam 7 pagi, atau saat ada stok yang mepet.
  - text: Menampilkan histori terbaru
- complementary:
  - img
  - paragraph: Toko Anda
  - paragraph: Inventaris Tebus Murah
  - text: Offline siap • 3 tap sampai approve
  - list:
    - listitem:
      - button "Dashboard":
        - img
        - text: Dashboard
    - listitem:
      - button "SKU":
        - img
        - text: SKU
    - listitem:
      - button "Pengaturan":
        - img
        - text: Pengaturan
  - paragraph: Butuh bantuan?
  - paragraph: Semua data tersimpan di perangkat. Backup di Pengaturan.
```

# Test source

```ts
  63  |     await expect(page.getByTestId("dashboard-page")).toBeVisible({ timeout: 10_000 });
  64  |   });
  65  | 
  66  |   test("happy: 3 batches H-1/H-3/H-10 shows 2 urgent H-1 red+icon H-3 orange H-10 hidden", async ({ page }) => {
  67  |     await seedUrgent(page, [
  68  |       { id: "b-h1", sku: "sku-susu", qty: 10, days: 1 },
  69  |       { id: "b-h3", sku: "sku-yoghurt", qty: 8, days: 3 },
  70  |       { id: "b-h10", sku: "sku-roti", qty: 5, days: 10 },
  71  |     ]);
  72  | 
  73  |     const items = page.locator('[aria-label="Daftar stok mepet"] li');
  74  |     await expect(items).toHaveCount(2);
  75  | 
  76  |     const h1Badge = page.getByLabel("Stok mepet H-1", { exact: false }).first();
  77  |     await expect(h1Badge).toBeVisible();
  78  |     await expect(h1Badge).toHaveText(/H-1/);
  79  |     await expect(h1Badge).toHaveCSS("background-color", hexToRgb("#C62828"));
  80  |     await expect(h1Badge).toHaveCSS("color", hexToRgb("#FFFFFF"));
  81  |     await expect(h1Badge.locator("svg")).toBeVisible();
  82  | 
  83  |     const h3Badge = page.getByLabel("Stok mepet H-3", { exact: false }).first();
  84  |     await expect(h3Badge).toBeVisible();
  85  |     await expect(h3Badge).toHaveText(/H-3/);
  86  |     await expect(h3Badge).toHaveCSS("background-color", hexToRgb("#EF6C00"));
  87  |     await expect(h3Badge).toHaveCSS("color", hexToRgb("#1A1A1A"));
  88  |     await expect(h3Badge.locator("svg")).toBeVisible();
  89  | 
  90  |     await expect(page.getByLabel(/H-10/)).toHaveCount(0);
  91  |     await expect(page.getByLabel("Stok mepet H-1", { exact: false })).toHaveAttribute("aria-label", /Stok mepet H-1, 10 pcs, kadaluarsa \d{4}-\d{2}-\d{2}/);
  92  |   });
  93  | 
  94  |   test("count shows N perlu perhatian", async ({ page }) => {
  95  |     await seedUrgent(page, [
  96  |       { id: "b-h1", sku: "sku-susu", qty: 10, days: 1 },
  97  |       { id: "b-h3", sku: "sku-yoghurt", qty: 8, days: 3 },
  98  |     ]);
  99  |     await expect(page.getByText("2 perlu perhatian")).toBeVisible();
  100 |   });
  101 | 
  102 |   test("dropdown filter kategori narrows list, Semua restores", async ({ page }) => {
  103 |     await seedUrgent(page, [
  104 |       { id: "b-h1", sku: "sku-susu", qty: 10, days: 1 },
  105 |       { id: "b-h3", sku: "sku-roti", qty: 8, days: 3 },
  106 |     ]);
  107 | 
  108 |     const filter = page.getByTestId("filter-kategori");
  109 |     await expect(filter).toBeVisible();
  110 |     await expect(filter).toHaveValue("Semua");
  111 | 
  112 |     await filter.selectOption("Dairy");
  113 |     const items = page.locator('[aria-label="Daftar stok mepet"] li');
  114 |     await expect(items).toHaveCount(1);
  115 |     await expect(items.first()).toContainText("Susu UHT 1L");
  116 | 
  117 |     await filter.selectOption("Semua");
  118 |     await expect(items).toHaveCount(2);
  119 |   });
  120 | 
  121 |   test("pagination shows 50 then Lihat semua loads rest", async ({ page }) => {
  122 |     const many: SeedBatch[] = Array.from({ length: 60 }, (_, i) => ({ id: `b-${i}`, sku: "sku-susu", qty: 1, days: 1 }));
  123 |     await seedUrgent(page, many, [30, 14, 7]);
  124 |     const items = page.locator('[aria-label="Daftar stok mepet"] li');
  125 |     await expect(items).toHaveCount(50);
  126 |     const lihatSemua = page.getByRole("button", { name: /Lihat semua/ });
  127 |     await expect(lihatSemua).toBeVisible();
  128 |     await expect(lihatSemua).toHaveCSS("min-height", "48px");
  129 |     await expect(lihatSemua).toHaveCSS("font-size", "16px");
  130 | 
  131 |     await lihatSemua.click();
  132 |     await expect(items).toHaveCount(60);
  133 |     await expect(lihatSemua).toHaveCount(0);
  134 |     await expect(page.getByText("60 perlu perhatian")).toBeVisible();
  135 |   });
  136 | 
  137 |   test("failure: expiry null batch shows no badge and empty state", async ({ page }) => {
  138 |     await seedUrgent(page, [{ id: "b-null", sku: "sku-susu", qty: 10, days: null }]);
  139 |     await expect(page.getByText("Stok aman semua")).toBeVisible();
  140 |     await expect(page.getByText("Tidak ada yang mepet kadaluarsa. Cek lagi besok jam 7 pagi.")).toBeVisible();
  141 |     await expect(page.getByLabel(/Stok mepet H-/)).toHaveCount(0);
  142 |     await expect(page.locator('[role="status"][aria-live="polite"]').first()).toBeVisible();
  143 |   });
  144 | 
  145 |   test("a11y: aria-label, select 48px/16px, aria-live, full-width primary button, iconoir", async ({ page }) => {
  146 |     await seedUrgent(page, [
  147 |       { id: "b-h1", sku: "sku-susu", qty: 10, days: 1 },
  148 |       { id: "b-h3", sku: "sku-yoghurt", qty: 8, days: 3 },
  149 |     ]);
  150 | 
  151 |     const badge = page.getByLabel(/Stok mepet H-/).first();
  152 |     await expect(badge).toBeVisible();
  153 |     await expect(badge).toHaveAttribute("aria-label", /Stok mepet H-/);
  154 | 
  155 |     const filter = page.getByTestId("filter-kategori");
  156 |     await expect(filter).toHaveCSS("min-height", "48px");
  157 |     await expect(filter).toHaveCSS("font-size", "16px");
  158 | 
  159 |     await expect(page.locator('[aria-live="polite"]').first()).toBeVisible();
  160 |     await expect(page.getByText("2 perlu perhatian")).toBeVisible();
  161 | 
  162 |     const primaryBtn = page.getByRole("button", { name: /Lihat Saran Tebus/i }).first();
> 163 |     await expect(primaryBtn).toBeVisible();
      |                              ^ Error: expect(locator).toBeVisible() failed
  164 |     await expect(primaryBtn).toHaveCSS("min-height", "48px");
  165 |     await expect(primaryBtn).toHaveCSS("font-size", "16px");
  166 |     await expect(primaryBtn).toHaveClass(/btn-primary/);
  167 |     await expect(primaryBtn).toHaveClass(/btn-block/);
  168 |     const box = await primaryBtn.boundingBox();
  169 |     expect(box).not.toBeNull();
  170 |     expect(box!.width).toBeGreaterThan(200);
  171 | 
  172 |     await expect(badge.locator("svg")).toBeVisible();
  173 | 
  174 |     const statuses = page.locator('[role="status"][aria-live="polite"]');
  175 |     await expect(statuses.first()).toBeVisible();
  176 | 
  177 |     const qtyText = page.locator('[aria-label="Daftar stok mepet"] >> text=pcs').first();
  178 |     await expect(qtyText).toHaveCSS("font-size", "16px");
  179 |   });
  180 | 
  181 |   test("sort select expiry vs urgency changes order", async ({ page }) => {
  182 |     await seedUrgent(page, [
  183 |       { id: "b-h3", sku: "sku-susu", qty: 2, days: 3 },
  184 |       { id: "b-h1", sku: "sku-yoghurt", qty: 20, days: 1 },
  185 |     ]);
  186 |     const items = page.locator('[aria-label="Daftar stok mepet"] li');
  187 |     await expect(items.first()).toContainText("Yoghurt");
  188 | 
  189 |     const sort = page.getByTestId("sort-order");
  190 |     await expect(sort).toBeVisible();
  191 |     await sort.selectOption("urgency");
  192 |     await expect(items.first()).toContainText("Susu UHT 1L");
  193 | 
  194 |     await sort.selectOption("expiry");
  195 |     await expect(items.first()).toContainText("Yoghurt");
  196 |   });
  197 | 
  198 |   test("urgent card links to SKU detail page", async ({ page }) => {
  199 |     await seedUrgent(page, [{ id: "b-h1", sku: "sku-susu", qty: 10, days: 1 }]);
  200 |     await page.getByTestId("sku-detail-sku-susu").click();
  201 |     await expect(page).toHaveURL(/\/sku\/sku-susu/);
  202 |     await expect(page.getByTestId("sku-detail-page")).toBeVisible({ timeout: 10_000 });
  203 |   });
  204 | 
  205 |   test("H-7 badge uses theme info color with dark text", async ({ page }) => {
  206 |     await seedUrgent(page, [{ id: "b-h7", sku: "sku-susu", qty: 5, days: 7 }]);
  207 |     const h7Badge = page.getByLabel(/Stok mepet H-7/).first();
  208 |     await expect(h7Badge).toBeVisible();
  209 |     await expect(h7Badge).toHaveCSS("background-color", hexToRgb("#F9A825"));
  210 |     await expect(h7Badge).toHaveCSS("color", hexToRgb("#1A1A1A"));
  211 |   });
  212 | });
  213 | 
```