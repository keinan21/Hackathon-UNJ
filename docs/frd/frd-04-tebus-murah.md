# FRD-04 Feature F4: Advisor Hybrid dan Tebus Murah

> Stok yang mau expiry tidak jadi sampah. Sistem kasih saran tebus murah ala Indomaret, supervisor setujui cukup 1 tap.

- **FRD ID:** FRD-04
- **Feature:** F4 Advisor Hybrid dan Tebus Murah
- **Versi:** 1.0
- **Tanggal:** 2026-08-31
- **Status:** Accepted
- **Zona waktu acuan:** Asia/Jakarta (WIB)
- **Trace TASK:** TASK-12, TASK-13, TASK-14, TASK-15, TASK-16
- **File sumber:** `docs/frd.md` FRD-04 section verbatim
- **Detail index:** [docs/frd.md](../frd.md)

---

## Glosarium Relevan (verbatim dari CONTEXT.md)

| Term | Definisi | Catatan |
|------|----------|---------|
| **UrgencyScore** | `qty * days_to_expiry / max(avg_daily_usage, 1)`. Semakin kecil atau negatif semakin urgent. Ranking untuk antrian AI. | Rule deterministik, bukan LLM |
| **AdvisorSuggestion** | Output hybrid: `{ batch_id, aksi, alasan, pasangan_tebus_murah, harga_tebus, estimasi_margin, confidence }`. Angka dari DB, narasi dari LLM. | Di-cache di Dexie |
| **Tebus Murah** | Promo bundling: "Beli SKU A yang laku, tebus Batch Y yang mau expiry harga miring". Punya `harga_tebus`, `sku_pasangan_id`, `guardrail: harga_tebus >= hpp*0.85`. | Contoh Indomaret, tebus murah |
| **Promo Aktif** | Tebus Murah yang sudah di-approve supervisor (status `active`), tampil di dashboard dan badge SKU. Belum approve = `proposed`. | Transisi: proposed ke active ke expired atau consumed |

Rujukan wajib: [CONTEXT.md](../../CONTEXT.md), [ADR-002](../adr/0002-langchain-gemini-hybrid-advisor.md).

---

## Vision

Stok yang mau expiry tidak jadi sampah. Sistem kasih saran tebus murah ala Indomaret: beli SKU yang laku, tebus Batch yang mepet harga miring. Saran angka aman, tidak rugi, dan supervisor setujui cukup 1 tap.

---

## Persona

**Supervisor yang tidak mau rugi dan tidak jago bikin kata promo.** Dia mau sistem usulkan: "Susu UHT H-2, pasangkan dengan Roti Tawar, tebus 9000". Dia cek margin, tap Setujui, promo langsung aktif. Jika tidak suka saran AI, dia bisa isi manual tetap dengan guardrail yang sama.

---

## Requirements

- Pairing rule engine tanpa LLM: dari `transaksis` bangun co-occurrence map, untuk SKU urgent cari SKU pasangan yang laku (avg tinggi, tidak urgent), fallback ke pasangan kategori manual misal Roti ke Susu jika tidak ada histori.
- Hybrid advisor: ambil top-N urgent dari ranking FRD-03, baru panggil LangChain plus Gemini 2.5 Flash untuk generate `AdvisorSuggestion` berisi `aksi`, `alasan`, `pasangan_tebus_murah`, `harga_tebus`, `estimasi_margin`, `confidence`. Angka `harga_tebus` dan HPP diambil dari DB, LLM dilarang ngarang harga.
- Guardrail wajib: `harga_tebus >= HPP * 0.85`. Cek sebelum simpan dan sebelum tampilkan. Jika LLM usulkan di bawah floor, tolak dan pakai floor atau minta regenerate. Optional ceiling `harga_tebus <= harga_normal * 0.5` jika config aktif.
- Cache: simpan hasil `AdvisorSuggestion` di Dexie `advisorCache` TTL 24 jam. Trigger harian 07:05 dan on-demand saat Batch baru urgent masuk. Saat offline, tampilkan cache kemarin, jangan error.
- Tebus Murah model: `batch_id`, `sku_pasangan_id`, `harga_tebus`, `status` (`proposed`, `active`, `expired`, `consumed`), `created_at`. Buat promo ada dua jalur: manual template atau AI assist prefill dari advisor.
- Flow propose: supervisor pilih Batch urgent, pilih pasangan dari pairing atau manual, isi `harga_tebus`, validasi floor, simpan sebagai `proposed`. Tidak auto aktif.
- Flow approve: 1-tap tombol besar 48px, `proposed` ke `active`, langsung tampil di dashboard dan badge SKU. Lifecycle: `active` ke `expired` jika lewat expiry, atau `consumed` jika qty Batch jadi 0, dicek harian.
- API key Gemini simpan terenkripsi di localStorage dengan key turunan PIN, tidak plaintext di Dexie. Interface `AdvisorPort` agar bisa swap model nanti.
- Bahasa Indonesia untuk semua label promo, alasan, dan pesan error guardrail.

---

## Acceptance Gherkin

```gherkin
Feature: Advisor Hybrid dan Tebus Murah

  Scenario: Pairing dari co-occurrence
    Given histori transaksi Roti dan Susu bersama 5 kali
    When pairing untuk SKU Susu urgent dipanggil
    Then kembalikan Roti sebagai pasangan

  Scenario: Pairing fallback kategori
    Given tidak ada histori untuk SKU urgent
    When pairing dipanggil
    Then kembalikan pasangan kategori manual yang sudah dikonfigurasi

  Scenario: Advisor hasilkan saran dengan guardrail
    Given Batch urgent qty 10 H-2 HPP 10000 harga_normal 15000
    And pairing kembalikan Roti
    When advisor dipanggil untuk top-N 3
    Then kembalikan 3 AdvisorSuggestion tiap dengan harga_tebus lebih sama dengan 8500
    And field alasan terisi wording promo

  Scenario: Tolak harga di bawah floor
    Given HPP 10000
    When harga_tebus diajukan 8400
    Then sistem tolak dengan pesan "Harga tebus tidak boleh di bawah HPP x 0.85"

  Scenario: Cache hit tanpa panggil LLM lagi
    Given advisor sudah dipanggil sekali dan cache tersimpan
    When advisor dipanggil lagi dalam 24 jam untuk batch sama
    Then kembalikan dari cache tanpa panggil LLM

  Scenario: Offline tampilkan cache
    Given device offline
    And cache advisor kemarin ada
    When supervisor buka halaman saran
    Then saran kemarin tetap tampil tanpa error

  Scenario: Buat promo manual valid
    When supervisor buat promo manual Batch H-2 pasangan Roti harga_tebus 9000
    Then promo tersimpan status proposed

  Scenario: AI assist prefill harga
    Given advisor punya saran harga_tebus 9000 untuk Batch tersebut
    When supervisor tap AI Assist
    Then form terisi harga_tebus 9000 dan bisa di-submit

  Scenario: Approve 1 tap jadi Promo Aktif
    Given promo proposed ada
    When supervisor tap Setujui setinggi 48px
    Then status jadi active
    And promo muncul di Dashboard dan badge SKU terkait

  Scenario: Lifecycle expired
    Given promo active untuk Batch expiry 2026-09-05
    When hari jadi 2026-09-06 dan daily check jalan
    Then status promo jadi expired

  Scenario: Harga di atas harga_normal beri warning
    When harga_tebus diajukan 16000 melebihi harga_normal 15000
    Then tampilkan warning atau tolak sesuai config

  Scenario: Alur 3 tap
    Given supervisor di Dashboard
    When supervisor tap Batch urgent ke 1
    And tap Buat Tebus Murah ke 2
    And tap Setujui ke 3
    Then promo aktif tanpa tap tambahan
```

---

## Trace ke TASK

Trace: TASK-12, TASK-13, TASK-14, TASK-15, TASK-16

- TASK-12 — Pairing rule engine co-occurrence dan fallback kategori.
- TASK-13 — LangChain Gemini hybrid advisor service, cache, guardrail, trigger harian dan on-demand.
- TASK-14 — Tebus Murah template manual dan AI assist flow proposed.
- TASK-15 — 1-tap Approve proposed ke active dan lifecycle Promo Aktif.
- TASK-16 — Guardrail dan validasi komprehensif HPP, harga, anti-ngarang LLM.

---

## KPI

- Waste turun 50 persen setelah 30 hari pakai tebus murah dibanding baseline tanpa promo.
- Konversi promo lebih dari 30 persen dari Batch urgent yang dipromosikan jadi terjual sebelum expiry.
- 100 persen `harga_tebus` lolos guardrail `HPP*0.85` di test, tidak ada yang di bawah floor lolos.
- 1-tap approve tercapai, alur buka lihat approve kurang sama dengan 3 tap.
- Cache hit kurangi panggil LLM hingga 70 persen untuk batch sama dalam 24 jam.

---

## Must NOT Have

- Tidak ada LLM hitung urgencyScore, days_to_expiry, atau HPP.
- Tidak ada auto-activate promo tanpa tap supervisor.
- Tidak ada POS add-to-cart auto atau checkout flow di FRD ini.
- Tidak ada angka harga yang dikarang LLM, semua dari DB.

---

## References

- [CONTEXT.md](../../CONTEXT.md:15-18) — UrgencyScore, AdvisorSuggestion, Tebus Murah, Promo Aktif verbatim.
- [CONTEXT.md](../../CONTEXT.md:26) — Anti-pattern LLM angka.
- [ADR-002](../adr/0002-langchain-gemini-hybrid-advisor.md) — Hybrid rule plus LLM, guardrail, cache Dexie, AdvisorPort.
- Draft C4 Tebus Murah Advisor [.omo/drafts/ai-inventory-expiry-advisor.md](../../.omo/drafts/ai-inventory-expiry-advisor.md).

---

*FRD-04 self-contained. Verifikasi: `grep -q "FRD-04" docs/frd/frd-04-tebus-murah.md && grep -q "TASK-" docs/frd/frd-04-tebus-murah.md`*
