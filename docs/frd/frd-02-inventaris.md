# FRD-02 Feature F2: Inventaris SKU / Batch / Kategori

> Satu jenis barang adalah SKU, stok fisiknya adalah Batch dengan tanggal kadaluarsa masing-masing, dan tiap kelompok punya aturan H- sendiri.

- **FRD ID:** FRD-02
- **Feature:** F2 Inventaris SKU / Batch / Kategori
- **Versi:** 1.1 (2026-09-03: tambah kode SKU prefix, Tag vs Kategori, FEFO)
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
| **SKU** | Jenis barang dagang (contoh: "Susu UHT 1L Indomilk"). Tidak punya expiry sendiri. | Identitas katalog, punya `kode`, `kategori_id`, `hpp`, `harga_normal` |
| **Kode SKU** | Kode unik per org format `XXX-NNN` prefix 3 huruf kapital + 3 digit urut, auto-generate, backfill lama, rename regenerasi transaksi. | Contoh DAI-001, unik per org_id |
| **Tag** | Label bebas per SKU, many-to-many via `sku_tags`, tidak pengaruhi threshold. | Beda dari Kategori |
| **Batch / Lot** | Stok fisik spesifik dari satu SKU: `qty` + `expiry_date` + `received_at` + `hpp_snapshot`. Satu SKU bisa punya N batch dengan tanggal beda. | Unit yang dihitung untuk expiry dan urgency, keluar pakai FEFO |
| **Kategori** | Pengelompokan SKU untuk threshold notifikasi (contoh: Sembako, Bumbu Dapur, Makanan Kering, Makanan Basah, Makanan Frozen, Minuman Kaleng, Minuman Botol, Obat Bebas, Perawatan Diri, Rokok, Misc). Punya config `threshold_h_minus` yang editable per kategori. | Beda kategori beda H- |
| **Expiry** | `expiry_date` per Batch. Barang non-perishable tetap punya Batch tapi `expiry_date = null` dan tidak masuk engine notifikasi. | v1 pakai satu field saja |
| **Days to Expiry** | `ceil((expiry_date - today) / 1day)`. Negatif berarti sudah kadaluarsa. | Dihitung harian oleh engine, basis Asia/Jakarta startOfDay |
| **Avg Daily Usage** | Rata-rata qty terjual per hari per SKU, auto-hitung dari histori transaksi (fallback input manual jika histori kurang dari 14 hari). | Untuk urgencyScore |

Rujukan wajib: [CONTEXT.md](../../CONTEXT.md), [ADR-001](../adr/0001-local-first-dexie-backup-drive.md), [ADR-003](../adr/0003-telegram-notif.md).

---

## Vision

Supervisor catat stok dengan benar: satu jenis barang adalah SKU dengan kode pendek untuk label rak, stok fisiknya adalah Batch dengan tanggal kadaluarsa masing-masing dan keluar pakai FEFO, dan tiap kelompok punya aturan H- sendiri. Tag bantu cari cepat tanpa ubah aturan notifikasi. Data rapi, tidak campur aduk, dan siap untuk dihitung urgency.

---

## Persona

**Supervisor yang terima barang dari supplier tiap pagi.** Dia buka karung, cek nota, input ke HP. Dia tidak mau bingung beda SKU vs Batch. Dia mau pilih Kategori Makanan Kering, ketik nama Roti Tawar, lihat preview kode MKR-001, lalu tambah Batch 10 pcs expiry 2026-09-10 via tanggal kalender atau durasi 30 hari. Tag "kulkas" ia tempel agar filter cepat. Kalau barang tidak ada kadaluarsa seperti beras karung, cukup isi tanpa tanggal. Saat jual, stok yang paling mepet expiry keluar duluan tanpa ia atur manual.

---

## Requirements

- Model SKU: `id`, `kode` (wajib, format `XXX-NNN` prefix 3 huruf kapital, unik per `org_id`, auto-generate), `nama` (wajib, tidak kosong), `kategori_id` (wajib), `hpp` (angka lebih dari 0), `harga_normal` (lebih dari atau sama dengan HPP, beri warning jika di bawah HPP), `barcode` opsional (unik per org jika diisi), `org_id` default `toko-01`. Relasi many-to-many ke Tag via `sku_tags`.
- Kode SKU auto: `computeKode(kategoriNama, org_id)` pakai peta prefix kurasi untuk 11 kategori default (Sembako SEM, Bumbu Dapur BUM, Makanan Kering MKR, Makanan Basah MBS, Makanan Frozen MFZ, Minuman Kaleng MKL, Minuman Botol MBT, Obat Bebas OBT, Perawatan Diri PRW, Rokok RKK, Misc MSC), fallback derivasi 3 huruf kapital untuk kategori buatan user, lalu suffix 3 digit urut per kategori per org (001, 002). Unik per org di-index `&[org_id+kode]`. Backfill: migrasi Dexie v1 ke v2 generate kode untuk SKU lama yang belum punya kode dalam satu transaksi. Rename kategori: regenerasi kode semua SKU di kategori tersebut dalam SATU transaksi Dexie, cek unik, jika konflik rollback dan tampil pesan Indonesia. Tampilkan preview kode di form sebelum simpan.
- Model Kategori: `id`, `nama` (11 default: Sembako [60,30,14] SEM, Bumbu Dapur [30,14,7] BUM, Makanan Kering [30,14,7] MKR, Makanan Basah [7,3,1] MBS, Makanan Frozen [14,7,3] MFZ, Minuman Kaleng [60,30,14] MKL, Minuman Botol [30,14,7] MBT, Obat Bebas [90,30,14] OBT, Perawatan Diri [90,30,14] PRW, Rokok [180,90,30] RKK, Misc [14,7,3] MSC), `threshold_h_minus` array angka, editable, validasi menurun, lebih dari 0, tidak duplikat, tidak kosong, `org_id` default `toko-01`.
- Model Tag: `id`, `nama` (bebas, contoh "laris", "kulkas"), unik per `org_id`, tidak pengaruhi threshold atau notifikasi. Tabel `tags` dan `sku_tags` many-to-many. CRUD terpisah dari Kategori.
- Tag vs Kategori: Kategori tentukan threshold dan warna badge dan masuk tidaknya ke halaman kritis. Tag hanya untuk filter dan search katalog. Jangan campur, jangan pakai Tag untuk atur H-. Validasi: Tag tidak punya threshold_h_minus, Kategori tidak dipakai sebagai filter bebas.
- Model Batch / Lot: `id`, `sku_id` (wajib, foreign key), `qty` (lebih dari 0), `expiry_date` nullable (null untuk non-perishable, dan batch null tidak masuk engine), `received_at` auto now, `hpp_snapshot` copy dari SKU saat terima atau dari `harga_beli` input masuk, `org_id`.
- Satu SKU bisa punya N Batch dengan tanggal beda, list batch per SKU diurutkan expiry paling dekat dulu.
- Validasi: expiry tidak disimpan di SKU. Upaya simpan expiry di SKU harus ditolak skema.
- FEFO consume rule: saat barang keluar (`transaksis` jenis keluar), kurangi stok Batch dengan `expiry_date` paling dekat dulu (First Expired First Out). Batch `expiry_date null` di-skip dari FEFO dan tidak dikurangi kecuali semua batch ber-expiry habis. Tulis `transaksis` jenis keluar dengan `harga_jual_snapshot = harga_normal` saat itu. Jika qty keluar lebih dari total stok ber-expiry, tolak dengan pesan Indonesia "Stok tidak cukup".
- Avg Daily Usage disimpan per SKU: auto dari histori `transaksis` (sku_id, qty_sold, sold_at) selama 14 hari terakhir, fallback input manual jika data kurang dari 14 hari.
- Input tanggal Batch: dukung dua mode, pilih tanggal kalender atau isi durasi X hari dari `received_at` yang dikonversi ke `expiry_date` via startOfDay Asia/Jakarta. Validasi `expiry_date >= received_at` atau tolak "Tanggal tidak valid".
- HPP timpa: barang masuk timpa `SKU.hpp = harga_beli` terakhir dan arsip ke `hpp_history { sku_id, hpp_lama, hpp_baru, created_at, org_id }`. Jika `harga_normal < hpp` baru tampil warning Indonesia, tetap simpan. Guardrail promo tetap pakai `hpp_snapshot` Batch.
- Threshold default per kategori sesuai daftar 11 kurasi (contoh Sembako [60,30,14], Rokok [180,90,30], Makanan Basah [7,3,1]), tetap editable via `updateKategoriThreshold`.
- Semua operasi lewat `InventoryRepository` Dexie, dengan index `sku_id`, `kategori_id`, `expiry_date`, `org_id`, dan `&[org_id+kode]` untuk kode.

---

## Acceptance Gherkin

```gherkin
Feature: Inventaris SKU Batch Kategori

  Scenario: Buat SKU valid dengan kode auto
    Given kategori Makanan Kering dengan threshold [30,14,7] sudah ada
    When supervisor buat SKU nama "Roti Tawar" kategori Makanan Kering hpp 8000 harga_normal 12000
    Then SKU tersimpan dengan kode MKR-001 unik per org dan bisa dicari by kategori_id
    And preview kode tampil sebelum simpan

  Scenario: Kode unik per org dan backfill
    Given SKU lama tanpa kode dari v1 masih ada
    When migrasi v2 jalan
    Then semua SKU lama ter-backfill kode tanpa duplikat
    When buat SKU baru kategori Makanan Kering lagi
    Then kode jadi MKR-002 bukan MKR-001

  Scenario: Rename kategori regenerasi kode transaksi
    Given SKU Roti kode MKR-001 kategori Makanan Kering
    When supervisor rename kategori Makanan Kering jadi Makanan Kering Premium
    Then kode SKU berubah jadi MKR-001 yang baru tetap unik dalam satu transaksi
    And jika konflik duplikat maka rollback dan tampil pesan Indonesia

  Scenario: Tolak HPP tidak valid
    When supervisor buat SKU dengan hpp 0
    Then sistem tolak dengan pesan "HPP harus lebih dari 0"

  Scenario: Larang expiry di SKU
    When payload buat SKU berisi field expiry_date
    Then sistem tolak karena skema SKU tidak punya expiry

  Scenario: Buat Batch dengan expiry via tanggal
    Given SKU Susu sudah ada dengan hpp 12000
    When supervisor tambah Batch qty 10 expiry 2026-09-05
    Then Batch tersimpan dengan hpp_snapshot 12000 dan received_at terisi
    And batch muncul di list SKU tersebut urut expiry paling dekat

  Scenario: Buat Batch via durasi
    Given SKU Susu hpp 12000 received_at 2026-09-02
    When supervisor isi durasi 30 hari
    Then expiry_date jadi 2026-10-02 startOfDay Asia/Jakarta

  Scenario: Batch non-perishable tanpa expiry
    When supervisor tambah Batch qty 20 tanpa isi expiry_date
    Then Batch tersimpan dengan expiry_date null
    And Batch tersebut tidak muncul di query engine expiry dan tidak ikut FEFO

  Scenario: Tolak qty nol
    When supervisor tambah Batch qty 0
    Then sistem tolak dengan pesan "Qty harus lebih dari 0"

  Scenario: FEFO consume
    Given SKU Susu punya Batch A 5 pcs expiry 2026-09-05 dan Batch B 10 pcs expiry 2026-09-10
    When supervisor keluar 7 pcs
    Then Batch A jadi 0 dan Batch B jadi 8
    And transaksis jenis keluar tercatat harga_jual_snapshot = harga_normal

  Scenario: FEFO stok tidak cukup
    When supervisor keluar qty melebihi total stok ber-expiry
    Then ditolak "Stok tidak cukup"

  Scenario: Tag vs Kategori terpisah
    Given Tag "kulkas" dan Kategori Makanan Kering ada
    When supervisor attach Tag kulkas ke SKU Roti
    Then filter Tag kulkas tampilkan Roti tapi tidak ubah threshold atau badge
    When buat Tag duplikat nama sama per org
    Then ditolak pesan Indonesia

  Scenario: Edit threshold kategori valid dan tidak valid
    Given kategori Sembako threshold [60,30,14]
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

- TASK-02 — Dexie schema dan `InventoryRepository` interface, tabel `skus` (plus `kode` unik per org), `kategoris`, `batches`, `transaksis`, `tags`, `sku_tags`, `hpp_history`, index dan `org_id` sync-ready.
- TASK-05 — Seed kategori dan threshold `[7,3,1]` editable dengan validasi menurun unik via `updateKategoriThreshold`.
- TASK-06 — SKU dan Kategori CRUD plus validasi HPP dan harga, kode auto `computeKode` dan preview.
- TASK-07 — Batch Lot CRUD dengan `hpp_snapshot`, expiry null handling, input tanggal atau durasi, HPP timpa plus `hpp_history`.
- TASK-08 — Avg Daily Usage calculator dan model histori transaksi, FEFO `consumeFEFO`.

---

## KPI

- 100 persen SKU valid tersimpan dengan kode unik per org tanpa expiry di level SKU.
- 100 persen Batch non-perishable dengan expiry null tidak masuk engine notifikasi dan tidak ikut FEFO.
- Validasi threshold cegah duplikat dan array kosong, error message bahasa Indonesia jelas.
- Query list batch per SKU terurut expiry benar 100 persen di test.
- FEFO potong batch terdekat dulu benar 100 persen di test.

---

## Must NOT Have

- Tidak ada simpan expiry di SKU (tetap dilarang, skema tolak).
- Tidak ada HPP auto dari supplier integrasi v1, input manual per Batch, timpa ke SKU plus arsip `hpp_history`.
- Tidak ada cloud sync untuk inventaris v1.
- Tidak ada OCR baca nota foto dan tidak ada QR code generation v1 (tetap Must NOT).
- Barcode scan camera: **allowlist hanya `html5-qrcode` lazy di route `/scan`** untuk isi field `barcode` SKU dan cari SKU saat terima barang (ADR-003). Tidak preload di dashboard, permission hanya di `/scan`, fallback input manual jika denied. Kamera tidak dipakai untuk fitur lain.
- Tidak ada Tag yang pengaruhi threshold, Tag hanya filter katalog.

---

## References

- [CONTEXT.md](../../CONTEXT.md:8-14) — Definisi verbatim SKU, Kode SKU, Tag, Batch, Kategori, Expiry, Days to Expiry, Avg Daily Usage.
- [CONTEXT.md](../../CONTEXT.md:16) — Omzet, Margin, Cashflow untuk referensi transaksi.
- [ADR-001](../adr/0001-local-first-dexie-backup-drive.md) — Local-first Dexie, Repository pattern, single device.
- [ADR-003](../adr/0003-telegram-notif.md) — Allowlist barcode scan `html5-qrcode` lazy di `/scan`, OCR tetap Must NOT.
- Draft C2 Inventaris Core [.omo/drafts/ai-inventory-expiry-advisor.md](../../.omo/drafts/ai-inventory-expiry-advisor.md).

---

---

## Polish Wave 5 — Biar Jadi (Real Data, Anti-Dummy)

**Gap sekarang:** Dexie schema ada tapi UI CRUD masih mock, `FakeRepository` belum ganti Dexie real.

| Crew | Sisa kerja di FRD-02 | File | Done jika |
|------|----------------------|------|-----------|
| **B Core** | Final `db.ts` `org_id=toko-01` indexed `sync-ready sharding`, `seed.ts [7,3,1]` editable `updateKategoriThreshold`, migrasi v2 kode plus FEFO | `src/db/**` | `bun test src/db/*.test.ts` 16 pass, batch null skip engine |
| **A Frontend** | Form SKU/Batch real 48px Bahasa Indonesia, validasi `hpp>0`, `harga_normal>=hpp`, empty `Belum ada SKU`, preview kode | `src/features/sku/**`, `src/features/batch/**`, `src/App.tsx` | `npx playwright test` tambah SKU ke Batch H-2 muncul di dashboard |

Branch: `feat/polish-inventaris-b` dan `feat/polish-inventaris-a`.

*FRD-02 self-contained. Verifikasi: `grep -q "FRD-02" docs/frd/frd-02-inventaris.md && grep -q "TASK-" docs/frd/frd-02-inventaris.md && grep -q "Wave 5 Polish" docs/frd/frd-02-inventaris.md`*
