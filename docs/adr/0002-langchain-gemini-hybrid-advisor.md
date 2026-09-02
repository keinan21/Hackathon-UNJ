# ADR-002: LangChain + Gemini Hybrid Advisor untuk Tebus Murah

- **Status:** Accepted (2026-08-31, grill round Q4/Q6/Q10)
- **Context:** Butuh saran "agar bahan bisa terpakai" + ide tebus murah Indomaret-style. Opsi: ADK vs LangChain, rule vs LLM, on-device vs API. Constraint: DB offline, AI online saja (batch harian + on-demand, cache di Dexie). User pilih LangChain + API (Q6 A).
- **Decision:** Pakai **LangChain + Gemini 2.5 Flash (via API)** dengan pola **hybrid**:
  1. Rule deterministik hitung `days_to_expiry`, `UrgencyScore` per Batch, ranking top-N urgent (tanpa LLM)
  2. LLM hanya dipanggil untuk top-N untuk generate: pairing SKU laku + copy promo + alasan, dengan guardrail `harga_tebus >= hpp*0.85` dan angka dari DB (LLM dilarang ngarang angka)
  3. Hasil `AdvisorSuggestion` di-cache di Dexie, jadi offline tetap bisa lihat saran kemarin. Trigger: 1x daily 07:00 + on-demand saat input batch baru dengan urgency tinggi.
  4. API key simpan encrypted di localStorage device (v1 pure local), nanti bisa pindah ke backend proxy kalau ada sync.
- **Consequences:**
  - (+) Hemat token (tidak panggil LLM untuk semua batch), anti-hallucinate harga
  - (+) Kualitas pairing & wording LLM tetap tinggi, rule jaga akurasi
  - (-) Butuh internet untuk refresh saran → offline lihat cache saja (sesuai Q10)
  - (-) Vendor lock ke Google → mitigasi: bungkus `AdvisorPort` interface (walau Q6 pilih A, tetap siapkan port untuk swap)
- **Alternatives considered:**
  - ADK (Google Agent Dev Kit): agent-native tapi ekosistem inventaris minim vs LangChain
  - Pure rule: murah tapi saran kaku, tidak kreatif untuk tebus murah
  - On-device WebLLM: offline penuh tapi kualitas pairing turun drastis
- **Reversible?** Ya, ganti adapter LangChain → ADK tanpa ubah engine urgency.
