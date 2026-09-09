# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: badge.spec.ts >> Badge & Urgent List >> urgent card links to SKU detail page
- Location: e2e/badge.spec.ts:198:3

# Error details

```
Test timeout of 30000ms exceeded.
```

```
Error: locator.click: Test timeout of 30000ms exceeded.
Call log:
  - waiting for getByTestId('sku-detail-sku-susu')

```

# Page snapshot

```yaml
- generic [ref=f1e3]:
  - generic [ref=f1e4]:
    - banner [ref=f1e5]:
      - heading "Inventaris Tebus Murah" [level=1] [ref=f1e14]
      - generic [ref=f1e15]: PWA
    - main [ref=f1e17]:
      - generic [ref=f1e27]:
        - heading "Ringkasan Warung" [level=2] [ref=f1e28]
        - paragraph [ref=f1e29]: Pantau stok mepet, promo tebus, dan histori — semua 3 tap sampai approve.
      - generic [ref=f1e30]:
        - alert [ref=f1e31]:
          - generic [ref=f1e32]: Notifikasi dimatikan, badge tetap update
          - button "Tutup banner notifikasi" [ref=f1e34] [cursor=pointer]: Tutup
        - generic [ref=f1e35]:
          - alert [ref=f1e36]:
            - generic [ref=f1e40]:
              - paragraph [ref=f1e41]: Ada 1 batch kritis
              - paragraph [ref=f1e42]: Tap untuk lihat daftar lengkap per batch
            - button "Lihat 1 batch kritis" [ref=f1e43] [cursor=pointer]: Lihat Kritis
          - navigation "Navigasi cepat warung" [ref=f1e44]:
            - button "Barang Masuk" [ref=f1e45] [cursor=pointer]
            - button "Kasir" [ref=f1e48] [cursor=pointer]
            - button "Lihat SKU" [ref=f1e52] [cursor=pointer]
            - button "Statistik" [ref=f1e55] [cursor=pointer]
          - generic [ref=f1e60]:
            - generic [ref=f1e61]:
              - region [ref=f1e63]:
                - generic [ref=f1e64]:
                  - heading "Stok Mepet" [level=2] [ref=f1e65]
                  - status [ref=f1e66]: 1 perlu perhatian
                - generic [ref=f1e67]:
                  - generic [ref=f1e68]: Filter kategori
                  - combobox "Filter kategori" [ref=f1e69]:
                    - option "Semua kategori" [selected]
                    - option "Makanan Frozen"
                    - option "Sembako"
                    - option "Bumbu Dapur"
                    - option "Obat Bebas"
                    - option "Makanan Basah"
                    - option "Minuman Kaleng"
                    - option "Makanan Kering"
                    - option "Rokok"
                    - option "Minuman Botol"
                    - option "Misc"
                    - option "Perawatan Diri"
                    - option "Dairy"
                    - option "Snack"
                  - generic [ref=f1e70]: Urutkan stok mepet
                  - combobox "Urutkan stok mepet" [ref=f1e71]:
                    - 'option "Urut: paling dekat" [selected]'
                    - 'option "Urut: paling mendesak"'
                - list "Daftar stok mepet" [ref=f1e72]:
                  - listitem [ref=f1e73]:
                    - generic [ref=f1e74]:
                      - generic [ref=f1e75]:
                        - generic [ref=f1e76]:
                          - paragraph [ref=f1e77]: Susu UHT 1L
                          - paragraph [ref=f1e78]: Sisa 10 pcs • kadaluarsa 2026-09-08
                          - generic [ref=f1e79]: Dairy
                        - status "Stok mepet H-1, 10 pcs, kadaluarsa 2026-09-08" [ref=f1e80]: H-1
                      - button "Lihat daftar kritis Susu UHT 1L" [ref=f1e85] [cursor=pointer]: Lihat
                - status [ref=f1e86]: 1 item mepet kadaluarsa
              - region [ref=f1e88]:
                - heading "Promo Tebus Murah" [level=2] [ref=f1e90]
                - status [ref=f1e91]:
                  - generic [ref=f1e92]:
                    - paragraph [ref=f1e93]: Belum ada promo
                    - paragraph [ref=f1e94]: Buat tebus murah dari stok mepet biar tidak jadi sampah.
                    - button "Lihat Stok Mepet" [ref=f1e96] [cursor=pointer]
                - generic [ref=f1e97]: 0 promo aktif
            - generic [ref=f1e99]:
              - region [ref=f1e100]:
                - heading "Histori Saran" [level=2] [ref=f1e101]
                - status [ref=f1e102]:
                  - generic [ref=f1e103]:
                    - paragraph [ref=f1e108]: Belum ada saran tersimpan
                    - paragraph [ref=f1e109]: Saran baru muncul tiap jam 7 pagi, atau saat ada stok yang mepet.
              - generic [ref=f1e110]: Menampilkan histori terbaru
  - generic [ref=f1e112]:
    - generic "close sidebar"
    - complementary [ref=f1e113]:
      - generic [ref=f1e114]:
        - generic [ref=f1e123]:
          - paragraph [ref=f1e124]: Toko Anda
          - paragraph [ref=f1e125]: Inventaris Tebus Murah
        - generic [ref=f1e126]:
          - generic [ref=f1e127]: Offline siap
          - generic [ref=f1e128]: •
          - generic [ref=f1e129]: 3 tap sampai approve
      - list [ref=f1e130]:
        - listitem [ref=f1e131]:
          - button "Dashboard" [ref=f1e132]
        - listitem [ref=f1e137]:
          - button "SKU" [ref=f1e138]
        - listitem [ref=f1e141]:
          - button "Pengaturan" [ref=f1e142]
      - generic [ref=f1e147]:
        - paragraph [ref=f1e148]: Butuh bantuan?
        - paragraph [ref=f1e149]: Semua data tersimpan di perangkat. Backup di Pengaturan.
```

# Test source

```ts
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
  163 |     await expect(primaryBtn).toBeVisible();
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
> 200 |     await page.getByTestId("sku-detail-sku-susu").click();
      |                                                   ^ Error: locator.click: Test timeout of 30000ms exceeded.
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