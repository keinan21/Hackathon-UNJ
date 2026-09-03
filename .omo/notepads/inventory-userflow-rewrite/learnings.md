# learnings - inventory-userflow-rewrite
## Conventions (from repo)
- Dexie v1 schema at src/db/db.ts, org_id=toko-01 indexed sync-ready, use InventoryRepository pattern
- expiry engine src/engine/expiry.ts Asia/Jakarta startOfDay ceil, urgencyScore qty*days/max(avg,1)
- guardrail HPP*0.85 at src/lib/validation.ts, before LLM and before approve
- PIN hash PBKDF2 100k + AES-GCM at src/lib/crypto.ts, never plaintext
- 48px min button, 16px font, Bahasa Indonesia, 3-tap max
- 1 worktree per TASK, 1 reviewer per PR, CI hijau, squash merge
- ADR-003 pattern: Status/Context/Decision/Consequences/Alternatives + Reversible + Tidak langgar local-first rationale, contek ADR-001/002, tulis Q14/Q15 di decisions.md grill log, tambah tradeoff #8
- Must-NOT amandemen docs: frd-02 allowlist scan, frd-03 WA stub -> Telegram allowlist, architecture C4 + telegramQueue tabel + Must-NOT allowlist, AGENTS local-first + Crew D + Must/Must NOT allowlist
- Token Telegram tidak pernah plaintext, reuse crypto.ts deriveKey/generateSalt/generateIv, antre Dexie telegramQueue dedup batchId+tanggal
- html5-qrcode lazy di /scan saja, OCR tetap Must NOT, fallback manual jika permission denied, bundle tetap kecil
- Verification: grep -q ADR-003 decisions, grep -q telegram architecture, grep supabase 0, bun test src 97 pass
- 2026-09-03: HUMAN.md — Bahasa Indonesia sederhana owner non-teknis, hindari pola [0-9]{8,10}:AA pakai <TOKEN_BOT_KAMU> agar grep 0, langkah BotFather /newbot username berakhir bot, chat ID @userinfobot atau getUpdates, tempel Wave 5 Setting terenkripsi crypto.ts salt16 iv12, peringatan JANGAN commit token, revoke via /revoke, evidence inventory-userflow-03-human.json
- 2026-09-03: Task 2 FRD rewrite - per-feature edit tanpa timpa struktur, tambah Requirements kode auto prefix + Tag vs Kategori + FEFO + durasi, must keep expiry di SKU tetap dilarang, Telegram 07:00 plus cashflow dan kritis max threshold, 3 tab + grafik mini SVG tanpa chart dep, backup v2 header v2, CONTEXT anti-pattern jangan campur Kategori/Tag, AGENTS must detail omzet/margin/cashflow deterministik dan telegramQueue dedup, verification grep 3 tab + Tag + todo 0 + bun test src 97 pass, evidence inventory-userflow-02-frd.json, branch feat/frd-userflow-rewrite
