# CONTEXT.md — Inventaris AI Tebus Murah

> Glossary domain untuk project inventaris perishable powered by AI. Dibuat via grill-with-docs, di-update inline saat istilah terkunci.

## Ubiquitous Language

| Term | Definisi | Catatan |
|------|----------|---------|
| **SKU** | Jenis barang dagang (contoh: "Susu UHT 1L Indomilk"). Tidak punya expiry sendiri. | Identitas katalog, punya `kategori_id`, `hpp`, `harga_normal` |
| **Batch / Lot** | Stok fisik spesifik dari satu SKU: `qty` + `expiry_date` + `received_at` + `hpp_snapshot`. Satu SKU bisa punya N batch dengan tanggal beda. | Unit yang dihitung untuk expiry & urgency |
| **Kategori** | Pengelompokan SKU untuk threshold notifikasi (contoh: Dairy, Snack, Beras). Punya config `threshold_h_minus: [7,3,1]` yang editable. | Beda kategori beda H- |
| **Expiry** | `expiry_date` per Batch. Barang non-perishable tetap punya Batch tapi `expiry_date = null` dan tidak masuk engine notifikasi. | Jangan campur dengan best-before vs hard expiry — v1 pakai satu field |
| **Days to Expiry** | `ceil((expiry_date - today) / 1day)`. Negatif = sudah kadaluarsa. | Dihitung harian oleh engine |
| **Avg Daily Usage** | Rata-rata qty terjual/hari per SKU, auto-hitung dari histori transaksi (fallback input manual jika histori <14 hari). | Untuk urgencyScore |
| **UrgencyScore** | `qty * days_to_expiry / max(avg_daily_usage, 1)`. Semakin kecil (atau negatif) semakin urgent. Ranking untuk antrian AI. | Rule deterministik, bukan LLM |
| **AdvisorSuggestion** | Output hybrid: `{ batch_id, aksi, alasan, pasangan_tebus_murah, harga_tebus, estimasi_margin, confidence }`. Angka dari DB, narasi dari LLM. | Di-cache di Dexie |
| **Tebus Murah** | Promo bundling: "Beli SKU A (laku), tebus Batch Y (mau expiry) harga miring". Punya `harga_tebus`, `sku_pasangan_id`, `guardrail: harga_tebus >= hpp*0.85`. | Contoh Indomaret |
| **Promo Aktif** | Tebus Murah yang sudah di-approve supervisor (status `active`), tampil di dashboard & badge SKU. Belum approve = `proposed`. | Transisi: proposed → active → expired/consumed |
| **Supervisor** | Satu-satunya user v1, pegang 1 HP device. Punya PIN. Bisa approve promo, edit threshold, backup. | Tidak ada multi-role v1 |
| **Threshold** | Config per Kategori: `H-7, H-3, H-1` default, editable. Trigger notifikasi push + badge. | |
| **Notifikasi** | Push PWA + badge dashboard di H-threshold. WA opsional (tidak wajib v1). Eskalasi tidak ada v1. | Di-schedule via Service Worker + daily batch |

## Anti-Pattern yang Dilarang
- Jangan sebut "barang" tanpa klarifikasi SKU vs Batch — selalu pakai SKU/Batch.
- Jangan simpan expiry di SKU — expiry milik Batch.
- Jangan biarkan LLM menentukan angka harga/HPP — LLM hanya wording & pairing, angka dari DB.
