---
slug: ai-inventory-expiry-advisor
status: awaiting-approval
intent: clear
review_required: true
pending-action: write and review .omo/plans/ai-inventory-expiry-advisor.md
approach: Vite+React+Dexie PWA local-first (backup Drive opsional), LangChain+Gemini hybrid advisor, hands-off docs (PRD/Design/Architecture/Decision/TASK) + tebus murah 1-tap
review:
  momus: { status: pending, workspace_root: /home/yusuf/dev/2026/UNEJ, runtime_home: null, target: .omo/plans/ai-inventory-expiry-advisor.md, round_id: null, plan_sha256: null, launch_id: null, session: null, result: null }
  independent: { status: pending, workspace_root: /home/yusuf/dev/2026/UNEJ, runtime_home: null, target: .omo/plans/ai-inventory-expiry-advisor.md, round_id: null, plan_sha256: null, launch_id: null, session: null, result: null }
---

# Draft: ai-inventory-expiry-advisor

## Components (topology ledger)
| id | outcome | status | evidence path |
|----|---------|--------|---------------|
| C1 | PWA Offline Shell (Vite+React+Dexie+vite-plugin-pwa) bisa install & jalan tanpa internet, data persist di IndexedDB | active | /home/yusuf/dev/2026/UNEJ/docs/adr/0001-local-first-dexie-backup-drive.md |
| C2 | Inventaris Core (SKU→N Batch, Kategori threshold, CRUD + avg_daily_usage) | active | /home/yusuf/dev/2026/UNEJ/CONTEXT.md |
| C3 | Expiry Engine + Notifikasi (days_to_expiry, urgencyScore, push PWA H-7/H-3/H-1 per kategori) | active | /home/yusuf/dev/2026/UNEJ/docs/adr/0002-langchain-gemini-hybrid-advisor.md |
| C4 | Tebus Murah Advisor (hybrid rule+LLM, pairing, guardrail HPP*0.85, 1-tap approve → Promo Aktif) | active | /home/yusuf/dev/2026/UNEJ/CONTEXT.md |
| C5 | Backup/Restore (export JSON terenkripsi + Drive opsional) | active | /home/yusuf/dev/2026/UNEJ/docs/adr/0001-local-first-dexie-backup-drive.md |
| C6 | Dashboard & Badge SKU (list urgent, promo aktif, histori saran) | active | /home/yusuf/dev/2026/UNEJ/CONTEXT.md |

## Open assumptions (announced defaults)
| assumption | adopted default | rationale | reversible? |
|------------|-----------------|-----------|-------------|
| Kategori threshold awal | Dairy H-7/H-3/H-1, Snack H-14/H-7/H-3, Beras H-30/H-14/H-7 (editable) | Beda perishable beda H, user bisa edit (Q3) | Ya |
| HPP input | manual per Batch saat receive | UMKM tidak ada integrasi supplier v1 | Ya → auto dari supplier nanti |
| avg_daily_usage | auto dari histori penjualan, fallback manual jika <14 hari | Butuh untuk urgencyScore (Q9) | Ya |
| LangChain model | Gemini 2.5 Flash (fallback GPT-4o-mini) | Murah untuk saran tebus murah | Ya via AdvisorPort |
| Tebus murah max diskon | harga_tebus >= HPP*0.85 dan <= harga_normal*0.5 | Guardrail anti-rugi (Q7) | Ya configurable |

## Findings (cited - path:lines)
- Greenfield kosong: no package.json/src/.git — /home/yusuf/dev/2026/UNEJ (ls 2026-08-31) + explore ses_faa211...
- CONTEXT.md glossary locked 2026-08-31 — /home/yusuf/dev/2026/UNEJ/CONTEXT.md:1-30
- ADR-001 local-first Dexie — /home/yusuf/dev/2026/UNEJ/docs/adr/0001-local-first-dexie-backup-drive.md
- ADR-002 hybrid advisor — /home/yusuf/dev/2026/UNEJ/docs/adr/0002-langchain-gemini-hybrid-advisor.md
- Grill decisions Q1-Q13 locked — conversation 2026-08-31, Q11 single device supervisor

## Decisions (with rationale)
- Q1 A perishable fokus, Q2 A single toko, Q3 A push PWA per kategori, Q4 C hybrid+tebus murah, Q7 A+C merged 1-tap, Q8 B local+Drive backup, Q9 C batch+avg, Q10 DB offline AI online cache, Q11 A single device, Q12 A promo list v1, Q13 A Vite+Dexie TDD — rationale in draft above

## Scope IN
- PWA installable offline, IndexedDB Dexie, Repository pattern
- SKU/Kategori/Batch CRUD, expiry per batch, threshold editable per kategori
- Expiry engine + urgencyScore + notifikasi push PWA + badge + WA opt-in hook
- Hybrid advisor + tebus murah (pairing rule+LLM, guardrail, 1-tap approve)
- Dashboard urgent + promo aktif + badge SKU + histori saran
- Backup/restore JSON + Drive opsional
- Dashboard & settings threshold

## Scope OUT (Must NOT have)
- Backend cloud wajib, multi-HP sync v1, multi-role auth v1
- POS keranjang auto-suggest v1, cetak label/QR v1
- OCR foto nota / vision expiry v1
- WA API wajib, eskalasi notifikasi v1

## Open questions
- NONE — frontier habis 2026-08-31

## Approval gate
status: awaiting-approval
approver: user (setuju 2026-08-31 - "setuju, tulis plan untuk menulis prd")
next: write .omo/plans/ai-inventory-expiry-advisor.md then append todos
