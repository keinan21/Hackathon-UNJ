# decisions - inventory-userflow-rewrite
- 2026-09-03: PIN + nama toko offline-first, single Supervisor
- 2026-09-03: Telegram rekap 07:00 + cashflow, token enkripsi + antre 3x 5s/30s/5m dedup batchId+tanggal, via direct HTTPS no backend (ADR-003)
- 2026-09-03: Barcode lib = html5-qrcode lazy, SVG inline tanpa chart dep, BEP hijau #16a34a
- 2026-09-03: Kode prefix 3 huruf kapital, backfill otomatis, rename kategori regenerasi transaksi
- 2026-09-03: Kritis = days <= max threshold kategori, cashflow = omzet - belanja 14d
- 2026-09-03: ADR-003 allowlist Telegram direct-HTTPS tanpa backend — rationale local-first tetap (100% offline jalan, internet hanya outbound notif), queue telegramQueue dedup batchId+tanggal retry 3x 5s/30s/5m, token PBKDF2+AES-GCM via crypto.ts, tidak langgar AGENTS guardrails
- 2026-09-03: ADR-003 allowlist kamera hanya html5-qrcode lazy di /scan — OCR dan QR generation tetap Must NOT, permission hanya di /scan fallback manual, amandemen frd-02:130 dan frd-03 WA->Telegram, architecture Must-NOT allowlist
