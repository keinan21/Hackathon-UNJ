# CONTEXT.md — Inventaris AI Tebus Murah

> Glossary domain untuk project inventaris perishable powered by AI. Dibuat via grill-with-docs, di-update inline saat istilah terkunci.

## Ubiquitous Language

| Term | Definisi | Catatan |
|------|----------|---------|
| **SKU** | Jenis barang dagang (contoh: "Susu UHT 1L Indomilk"). Tidak punya expiry sendiri. | Identitas katalog, punya `kode`, `kategori_id`, `hpp`, `harga_normal`, `barcode` opsional |
| **Kode SKU** | Kode unik per `org_id` dengan format prefix 3 huruf kapital dari nama kategori + 3 digit urut (contoh: DAI-001, SNA-012, BER-003). Auto-generate saat buat SKU, backfill untuk SKU lama, rename kategori regenerasi kode se-kategori dalam satu transaksi Dexie dengan cek unik dan rollback jika konflik. | Prefix = 3 huruf kapital nama kategori yang dinormalisasi, unik per org, untuk label rak dan scan cepat |
| **Batch / Lot** | Stok fisik spesifik dari satu SKU: `qty` + `expiry_date` + `received_at` + `hpp_snapshot`. Satu SKU bisa punya N batch dengan tanggal beda. | Unit yang dihitung untuk expiry dan urgency, keluar pakai FEFO |
| **Kategori** | Pengelompokan SKU untuk threshold notifikasi (contoh: Dairy, Snack, Beras). Punya config `threshold_h_minus: [7,3,1]` yang editable, menurun, unik, tidak kosong. | Beda kategori beda H-, tentukan kapan masuk kritis |
| **Tag** | Label bebas per SKU untuk pencarian dan filter, many-to-many via `sku_tags` (contoh: "laris", "kulkas", "promo"). Tidak pengaruhi threshold, notifikasi, atau guardrail. Unik per `org_id`. | Beda dari Kategori, Tag hanya untuk filter katalog, bukan aturan bisnis |
| **Expiry** | `expiry_date` per Batch. Barang non-perishable tetap punya Batch tapi `expiry_date = null` dan tidak masuk engine notifikasi. | Jangan campur dengan best-before vs hard expiry, v1 pakai satu field |
| **Days to Expiry** | `ceil((expiry_date - today) / 1day)`. Negatif = sudah kadaluarsa. | Dihitung harian oleh engine, basis Asia/Jakarta startOfDay |
| **Avg Daily Usage** | Rata-rata qty terjual per hari per SKU, auto-hitung dari histori transaksi (fallback input manual jika histori kurang dari 14 hari). | Untuk urgencyScore |
| **UrgencyScore** | `qty * days_to_expiry / max(avg_daily_usage, 1)`. Semakin kecil atau negatif semakin urgent. Ranking untuk antrian AI. | Rule deterministik, bukan LLM |
| **AdvisorSuggestion** | Output hybrid: `{ batch_id, aksi, alasan, pasangan_tebus_murah, harga_tebus, estimasi_margin, confidence }`. Angka dari DB, narasi dari LLM. | Di-cache di Dexie `advisorCache` TTL 24 jam |
| **Tebus Murah** | Promo bundling: "Beli SKU A (laku), tebus Batch Y (mau expiry) harga miring". Punya `harga_tebus`, `sku_pasangan_id`, `guardrail: harga_tebus >= hpp*0.85`. | Contoh Indomaret, floor per-jenis promo tetap HPP*0.85 |
| **Promo Aktif** | Tebus Murah yang sudah di-approve supervisor (status `active`), tampil di dashboard dan badge SKU. Belum approve = `proposed`. | Transisi: proposed ke active ke expired atau consumed |
| **Supervisor** | Satu-satunya user v1, pegang 1 HP device. Punya PIN. Bisa approve promo, edit threshold, backup. | Tidak ada multi-role v1 |
| **Threshold** | Config per Kategori: `H-7, H-3, H-1` default, editable. Trigger notifikasi push dan badge. Kritis = `days <= max(threshold)` kategori induk. | Contoh [7,3,1] max 7, [14,7,3] max 14 |
| **Notifikasi** | Push PWA dan badge dashboard di H-threshold. Telegram rekap 07:00 termasuk cashflow. Eskalasi tidak ada v1. | Di-schedule via Service Worker dan daily batch 07:00 |
| **Omzet** | Total penjualan 14 hari: `Σ harga_jual_snapshot * qty keluar` dari `transaksis` jenis keluar. Angka dari DB, bukan LLM. | Periode rolling 14 hari |
| **Margin** | Laba kotor 14 hari: `omzet - Σ hpp_snapshot * qty keluar` (HPP terjual). Angka dari DB, bukan LLM. | Jika margin negatif berarti rugi |
| **Cashflow** | Arus kas 14 hari: `cashflow = omzet - belanja 14d`, di mana `belanja = Σ harga_beli * qty masuk` dari `transaksis` jenis masuk. Angka dari DB, bukan LLM. | Untuk rekap Telegram 07:00 bersama omzet dan margin |

## Anti-Pattern yang Dilarang
- Jangan sebut "barang" tanpa klarifikasi SKU vs Batch, selalu pakai SKU/Batch.
- Jangan simpan expiry di SKU, expiry milik Batch.
- Jangan biarkan LLM menentukan angka harga/HPP/omzet/margin/cashflow/BEP, LLM hanya wording dan pairing, angka dari DB.
- Jangan campur Kategori vs Tag: Kategori tentukan threshold dan notifikasi, Tag hanya label filter bebas. Jangan pakai Tag untuk atur H-.
- Jangan hardcode threshold `[7,3,1]` di komponen, pakai `updateKategoriThreshold` dan baca dari Dexie.
- Jangan simpan PIN, token Telegram, atau API key plaintext, pakai PBKDF2 100k + AES-GCM via `src/lib/crypto.ts`.
