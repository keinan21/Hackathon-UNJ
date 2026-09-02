# FRD-02 Feature F2: Inventaris SKU / Batch / Kategori

> Satu jenis barang adalah SKU, stok fisiknya adalah Batch dengan tanggal kadaluarsa masing-masing, dan tiap kelompok punya aturan H- sendiri.

- **FRD ID:** FRD-02
- **Feature:** F2 Inventaris SKU / Batch / Kategori
- **Versi:** 1.0
- **Tanggal:** 2026-08-31
- **Status:** Accepted
- **Zona waktu acuan:** Asia/Jakarta (WIB)
- **Trace TASK:** TASK-02, TASK-05, TASK-06, TASK-07, TASK-08
- **File sumber:** `docs/frd.md` FRD-02 section verbatim
- **Detail index:** [docs/frd.md](../frd.md)

---

## Glosarium Relevan (verbatim dari CONTEXT.md)

| Term | Definisi | Catatan |
|------|----------|---------|
| **SKU** | Jenis barang dagang (contoh: "Susu UHT 1L Indomilk"). Tidak punya expiry sendiri. | Identitas katalog, punya `kategori_id`, `hpp`, `harga_normal` |
| **Batch / Lot** | Stok fisik spesifik dari satu SKU: `qty` + `expiry_date` + `received_at` + `hpp_snapshot`. Satu SKU bisa punya N batch dengan tanggal beda. | Unit yang dihitung untuk expiry dan urgency |
| **Kategori** | Pengelompokan SKU untuk threshold notifikasi (contoh: Dairy, Snack, Beras). Punya config `threshold_h_minus: [7,3,1]` yang editable. | Beda kategori beda H- |
| **Expiry** | `expiry_date` per Batch. Barang non-perishable tetap punya Batch tapi `expiry_date = null` dan tidak masuk engine notifikasi. | v1 pakai satu field saja, tidak bedakan best-before vs hard expiry |
| **Days to Expiry** | `ceil((expiry_date - today) / 1day)`. Negatif berarti sudah kadaluarsa. | Dihitung harian oleh engine, basis Asia/Jakarta startOfDay |
| **Avg Daily Usage** | Rata-rata qty terjual per hari per SKU, auto-hitung dari histori transaksi (fallback input manual jika histori kurang dari 14 hari). | Untuk urgencyScore |

Rujukan wajib: [CONTEXT.md](../../CONTEXT.md), [ADR-001](../adr/0001-local-first-dexie-backup-drive.md).

---

## Vision

Supervisor catat stok dengan benar: satu jenis barang adalah SKU, stok fisiknya adalah Batch dengan tanggal kadaluarsa masing-masing, dan tiap kelompok punya aturan H- sendiri. Data rapi, tidak campur aduk, dan siap untuk dihitung urgency.

---

## Persona

**Supervisor yang terima barang dari supplier tiap pagi.** Dia buka karung, cek nota, input ke HP. Dia tidak mau bingung beda SKU vs Batch. Dia mau pilih Kategori Dairy, ketik nama Susu UHT 1L Indomilk, lalu tambah Batch 10 pcs expiry 2026-09-10. Kalau barang tidak ada kadaluarsa seperti beras karung, cukup isi tanpa tanggal.

---

## Requirements

- Model SKU: `id`, `nama` (wajib, tidak kosong), `kategori_id` (wajib), `hpp` (angka lebih dari 0), `harga_normal` (lebih dari atau sama dengan HPP, beri warning jika di bawah HPP), `barcode` opsional, `org_id` default `toko-01`.
- Model Kategori: `id`, `nama` (Dairy, Snack, Beras default), `threshold_h_minus` array angka, editable, validasi menurun, lebih dari 0, tidak duplikat, tidak kosong, `org_id` default `toko-01`.
- Model Batch / Lot: `id`, `sku_id` (wajib, foreign key), `qty` (lebih dari 0), `expiry_date` nullable (null untuk non-perishable, dan batch null tidak masuk engine), `received_at` auto now, `hpp_snapshot` copy dari SKU saat terima, `org_id`.
- Satu SKU bisa punya N Batch dengan tanggal beda, list batch per SKU diurutkan expiry paling dekat dulu.
- Validasi: expiry tidak disimpan di SKU. Upaya simpan expiry di SKU harus ditolak skema.
- Avg Daily Usage disimpan per SKU: auto dari histori `transaksis` (sku_id, qty_sold, sold_at) selama 14 hari terakhir, fallback input manual jika data kurang dari 14 hari.
- Threshold default generik `[7,3,1]` untuk semua kategori, seed boleh override per kategori tapi tetap editable.
- Semua operasi lewat `InventoryRepository` Dexie, dengan index `sku_id`, `kategori_id`, `expiry_date`, `org_id`.

---

## Acceptance Gherkin

```gherkin
Feature: Inventaris SKU Batch Kategori

  Scenario: Buat SKU valid
    Given kategori Dairy dengan threshold [7,3,1] sudah ada
    When supervisor buat SKU nama "Susu UHT 1L Indomilk" kategori Dairy hpp 12000 harga_normal 15000
    Then SKU tersimpan dan bisa dicari by kategori_id

  Scenario: Tolak HPP tidak valid
    When supervisor buat SKU dengan hpp 0
    Then sistem tolak dengan pesan "HPP harus lebih dari 0"

  Scenario: Larang expiry di SKU
    When payload buat SKU berisi field expiry_date
    Then sistem tolak karena skema SKU tidak punya expiry

  Scenario: Buat Batch dengan expiry
    Given SKU Susu sudah ada dengan hpp 12000
    When supervisor tambah Batch qty 10 expiry 2026-09-05
    Then Batch tersimpan dengan hpp_snapshot 12000 dan received_at terisi
    And batch muncul di list SKU tersebut urut expiry paling dekat

  Scenario: Batch non-perishable tanpa expiry
    When supervisor tambah Batch qty 20 tanpa isi expiry_date
    Then Batch tersimpan dengan expiry_date null
    And Batch tersebut tidak muncul di query engine expiry

  Scenario: Tolak qty nol
    When supervisor tambah Batch qty 0
    Then sistem tolak dengan pesan "Qty harus lebih dari 0"

  Scenario: Edit threshold kategori valid dan tidak valid
    Given kategori Dairy threshold [7,3,1]
    When supervisor ubah jadi [14,7,3]
    Then berhasil simpan
    When supervisor ubah jadi [3,3,1]
    Then ditolak karena duplikat
    When supervisor ubah jadi []
    Then ditolak karena tidak boleh kosong

  Scenario: Fallback Avg Daily Usage
    Given SKU baru tanpa histori 14 hari
    When sistem hitung Avg Daily Usage
    Then pakai nilai manual fallback yang diinput supervisor, bukan NaN
```

---

## Trace ke TASK

Trace: TASK-02, TASK-05, TASK-06, TASK-07, TASK-08

- TASK-02 — Dexie schema dan `InventoryRepository` interface, tabel `skus`, `kategoris`, `batches`, `transaksis`, index dan `org_id` sync-ready.
- TASK-05 — Seed kategori dan threshold `[7,3,1]` editable dengan validasi.
- TASK-06 — SKU dan Kategori CRUD plus validasi HPP dan harga.
- TASK-07 — Batch Lot CRUD dengan `hpp_snapshot` dan expiry null handling.
- TASK-08 — Avg Daily Usage calculator dan model histori transaksi.

---

## KPI

- 100 persen SKU valid tersimpan tanpa expiry di level SKU.
- 100 persen Batch non-perishable dengan expiry null tidak masuk engine notifikasi.
- Validasi threshold cegah duplikat dan array kosong, error message bahasa Indonesia jelas.
- Query list batch per SKU terurut expiry benar 100 persen di test.

---

## Must NOT Have

- Tidak ada simpan expiry di SKU.
- Tidak ada HPP auto dari supplier integrasi v1, input manual per Batch.
- Tidak ada cloud sync untuk inventaris v1.
- Tidak ada barcode scan camera v1.

---

## References

- [CONTEXT.md](../../CONTEXT.md:8-14) — Definisi verbatim SKU, Batch, Kategori, Expiry, Days to Expiry, Avg Daily Usage.
- [ADR-001](../adr/0001-local-first-dexie-backup-drive.md) — Local-first Dexie, Repository pattern, single device.
- Draft C2 Inventaris Core [.omo/drafts/ai-inventory-expiry-advisor.md](../../.omo/drafts/ai-inventory-expiry-advisor.md).

---

*FRD-02 self-contained. Verifikasi: `grep -q "FRD-02" docs/frd/frd-02-inventaris.md && grep -q "TASK-" docs/frd/frd-02-inventaris.md`*
