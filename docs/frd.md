# FRD — Feature Requirements Document (Index)

## Inventaris AI Tebus Murah

> PWA inventaris perishable offline untuk UMKM toko tunggal. Index ini ringkas 80 baris. Detail per feature ada di `docs/frd/frd-0x-*.md` (6 file, masing-masing 120-150 baris, self-contained).

- **Versi:** 1.0
- **Tanggal:** 2026-08-31
- **Status:** Accepted
- **Zona waktu acuan:** Asia/Jakarta (WIB)
- **Prinsip:** Offline-first, 3-tap max, bahasa Indonesia, angka dari DB bukan dari LLM

---

## Glosarium Inti (verbatim dari CONTEXT.md:8-22)

| Term | Definisi | Catatan |
|------|----------|---------|
| **SKU** | Jenis barang dagang (contoh: "Susu UHT 1L Indomilk"). Tidak punya expiry sendiri. | `kategori_id`, `hpp`, `harga_normal` |
| **Batch / Lot** | Stok fisik spesifik dari satu SKU: `qty` + `expiry_date` + `received_at` + `hpp_snapshot`. | Unit expiry dan urgency |
| **Kategori** | Pengelompokan SKU untuk threshold `threshold_h_minus: [7,3,1]` editable. | Beda kategori beda H- |
| **Expiry** | `expiry_date` per Batch. `null` untuk non-perishable, tidak masuk engine. | Satu field v1 |
| **Days to Expiry** | `ceil((expiry_date - today) / 1day)`. Negatif kadaluarsa. | Basis Asia/Jakarta startOfDay |
| **Avg Daily Usage** | Rata-rata qty terjual per hari per SKU, auto 14 hari, fallback manual. | Untuk urgencyScore |
| **UrgencyScore** | `qty * days_to_expiry / max(avg_daily_usage, 1)`. Kecil atau negatif semakin urgent. | Rule deterministik |
| **AdvisorSuggestion** | `{ batch_id, aksi, alasan, pasangan_tebus_murah, harga_tebus, estimasi_margin, confidence }` | Di-cache Dexie |
| **Tebus Murah** | Bundling: beli SKU laku, tebus Batch mau expiry harga miring. Guardrail `harga_tebus >= hpp*0.85`. | Tebus Murah |
| **Promo Aktif** | Tebus Murah `active` setelah approve. `proposed` sebelum approve. | proposed ke active ke expired/consumed |
| **Supervisor** | Satu user v1, 1 HP, PIN, approve promo, edit threshold, backup. | Tidak ada multi-role |
| **Threshold** | Config per Kategori `H-7, H-3, H-1` editable. | Trigger notifikasi |
| **Notifikasi** | Push PWA dan badge di H-threshold. WA opsional. | Via Service Worker daily 07:00 |

Rujukan: [CONTEXT.md](../CONTEXT.md), [ADR-001](./adr/0001-local-first-dexie-backup-drive.md), [ADR-002](./adr/0002-langchain-gemini-hybrid-advisor.md).

---

## Daftar Isi — Detail per Feature ada di docs/frd/frd-0x-*.md

1. [FRD-01 PWA Shell Offline](./frd/frd-01-pwa.md) — Installable, Service Worker, offline shell, fallback. Trace TASK-01, TASK-04
2. [FRD-02 Inventaris SKU / Batch / Kategori](./frd/frd-02-inventaris.md) — SKU, Batch, Kategori, Avg Usage. Trace TASK-02, TASK-05, TASK-06, TASK-07, TASK-08
3. [FRD-03 Expiry Engine dan Notifikasi](./frd/frd-03-expiry.md) — daysToExpiry, urgencyScore, scheduler 07:00, badge. Trace TASK-08, TASK-09, TASK-10, TASK-11
4. [FRD-04 Advisor Hybrid dan Tebus Murah](./frd/frd-04-tebus-murah.md) — Pairing, Gemini hybrid, guardrail HPP*0.85, Tebus Murah lifecycle. Trace TASK-12, TASK-13, TASK-14, TASK-15, TASK-16
5. [FRD-05 Dashboard, Badge, dan Histori](./frd/frd-05-dashboard.md) — Urgent list, Promo Aktif, Histori. Trace TASK-11, TASK-17, TASK-19
6. [FRD-06 Backup dan Restore](./frd/frd-06-backup.md) — Export terenkripsi PBKDF2 AES-GCM, restore, Drive hook. Trace TASK-03, TASK-18

> Catatan efisiensi konteks AI: load 1 file per agent, 120 baris vs 737 baris global. Hands-off agentic, Bahasa Indonesia, guardrail HPP*0.85, Asia/Jakarta.

---

## Matriks Traceability FRD ke TASK

| FRD | Feature | Trace TASK | File |
|-----|---------|------------|------|
| FRD-01 | F1 PWA Shell Offline | TASK-01, TASK-04 | [frd-01-pwa.md](./frd/frd-01-pwa.md) |
| FRD-02 | F2 Inventaris SKU Batch Kategori | TASK-02, TASK-05, TASK-06, TASK-07, TASK-08 | [frd-02-inventaris.md](./frd/frd-02-inventaris.md) |
| FRD-03 | F3 Expiry Engine Notifikasi | TASK-08, TASK-09, TASK-10, TASK-11 | [frd-03-expiry.md](./frd/frd-03-expiry.md) |
| FRD-04 | F4 Advisor Hybrid Tebus Murah | TASK-12, TASK-13, TASK-14, TASK-15, TASK-16 | [frd-04-tebus-murah.md](./frd/frd-04-tebus-murah.md) |
| FRD-05 | F5 Dashboard Badge Histori | TASK-11, TASK-17, TASK-19 | [frd-05-dashboard.md](./frd/frd-05-dashboard.md) |
| FRD-06 | F6 Backup Restore | TASK-03, TASK-18 | [frd-06-backup.md](./frd/frd-06-backup.md) |

Wave: 0 docs blokir Wave 1 scaffold. Detail dependency lihat [Plan](../.omo/plans/ai-inventory-expiry-advisor.md).

---

## KPI Lintas Feature (ringkas)

| KPI | Target | FRD |
|-----|--------|-----|
| Food waste turun | 50 persen dalam 30 hari | FRD-04 |
| Konversi tebus murah | Lebih dari 30 persen | FRD-04 |
| Ketepatan notifikasi | 100 persen di H threshold | FRD-03 |
| Guardrail HPP*0.85 | 100 persen lolos | FRD-04 |
| Offline shell | Kurang dari 2 detik | FRD-01 |
| 3-tap flow | Kurang sama dengan 3 tap | FRD-04 |
| Backup roundtrip | 100 persen pulih | FRD-06 |

---

## Daftar Referensi

- [CONTEXT.md](../CONTEXT.md) — Glosarium verbatim
- [ADR-001](./adr/0001-local-first-dexie-backup-drive.md) — Local-first Dexie
- [ADR-002](./adr/0002-langchain-gemini-hybrid-advisor.md) — Hybrid advisor
- [Draft](../../.omo/drafts/ai-inventory-expiry-advisor.md) — Topology C1-C6
- [Plan](../../.omo/plans/ai-inventory-expiry-advisor.md) — 24 Todos
