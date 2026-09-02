# ai-inventory-expiry-advisor - Work Plan

## TL;DR (For humans)

**What you'll get:** PWA inventaris perishable offline di HP supervisor (Vite+React+Dexie) + **hands-off docs komprehensif** (FRD per-feature, Design/UX, Architecture, Decisions, TASK) sehingga developer bisa eksekusi tanpa tanya lagi — plus engine expiry H-7/H-3/H-1 per kategori & saran tebus murah hybrid 1-tap Approve.

**Why this approach:** (1) Local-First Dexie via Repository pattern — zero cloud, tetap offline, backup Drive selamatkan HP hilang (ADR-001). (2) Hybrid advisor — rule hitung urgencyScore, LLM hanya pairing+wording dengan guardrail HPP*0.85 hemat token & anti-hallucinate (ADR-002). (3) Docs-first hands-off — **FRD per-feature**+Design+Architecture+TASK ditulis sebelum kode biar 1 feature = 1 FRD section = N tasks traceable, eksekutor zero interview, UX diukur untuk UMKM non-tech (literacy, 1-tangan, offline).

**What it will NOT do:** Tidak bikin backend/cloud wajib, multi-HP sync, multi-role auth v1, POS keranjang auto-suggest, OCR foto nota, cetak label/QR, atau WA API penuh — semua fase 2.

**Effort:** Large (was Medium — added 4 doc todos comprehensive + UX validation)
**Risk:** Medium - hybrid LLM + offline cache + docs completeness risk
**Decisions to sanity-check:** (1) Dexie pure local + backup Drive (ADR-001). (2) LangChain+Gemini Flash hybrid (ADR-002). (3) Threshold generik [7,3,1] editable (C-02). (4) Guardrail floor HPP*0.85 wajib (C-03). (5) UX target UMKM non-tech: 3-tap max, bahasa Indonesia, font 16px+, offline-first.

Your next move: high-accuracy review (Momus+Oracle) → fix → `$start-work ai-inventory-expiry-advisor` . Full execution detail follows below.

---

> TL;DR (machine): Large effort, Medium risk, 24 todos + 4 verifiers — PWA offline Dexie + hybrid Gemini + hands-off docs (FRD-per-feature/Design/Architecture/Decision/TASK) delivered.

## Scope
### Must have
- PWA installable offline (Vite+React+TS+Dexie+vite-plugin-pwa, Service Worker cache app shell, manifest.webmanifest, offline fallback)
- InventoryRepository interface (Dexie impl) — SKU→N Batch (qty, expiry_date, HPP snapshot, received_at, expiry null skip engine), Kategori dengan threshold_h_minus editable, validasi expiry milik Batch bukan SKU
- Avg Daily Usage auto dari histori transaksi (fallback manual jika <14 hari), urgencyScore = qty * days_to_expiry / max(avg,1)
- Expiry engine: days_to_expiry = ceil((expiry_date - startOfDay(Asia/Jakarta))/1day), urgency ranking
- Notifikasi push PWA + badge dashboard di H-threshold per kategori (default [7,3,1] generik, seed contoh Dairy/Snack/Beras editable), scheduler daily 07:00 + on-demand saat input batch urgent, WA hook opsional (tidak send)
- Hybrid advisor: rule ranking top-N urgent → LangChain+Gemini Flash generate pairing SKU laku + copy promo + harga_tebus (cache di Dexie, angka dari DB, LLM dilarang ngarang harga/HPP), trigger 1x daily + on-demand, API key encrypted localStorage
- Tebus Murah: AI usul 2-3 opsi + template manual, proposed→active via 1-tap approve, guardrail harga_tebus >= HPP*0.85 (floor wajib), promo aktif tampil dashboard & badge SKU, lifecycle active→expired/consumed
- Dashboard: list urgent sorted urgency, promo aktif, histori saran, badge per SKU
- Backup/Restore: export JSON terenkripsi AES-GCM-256 key=PBKDF2(PIN,salt) + tombol Backup ke Drive (manual), import restore
- Supervisor single device PIN auth (single org, 1 gudang, 1 HP)
- **Hands-off docs komprehensif (must have baru B):** `docs/frd.md` (FRD breakdown per feature: F1 PWA Shell, F2 Inventaris SKU/Batch, F3 Expiry Engine+Notifikasi, F4 Advisor+Tebus Murah, F5 Dashboard, F6 Backup — tiap feature punya requirements, acceptance Gherkin, trace ke TASK), `docs/design.md` (UX untuk UMKM non-tech: user journey, wireframe low-fi, 3-tap flow, bahasa Indonesia, aksesibilitas), `docs/architecture.md` (system architecture scalable pragmatis: local-first, Repository pattern, sync-ready, scalability 1→10 toko, tradeoffs), `docs/decisions.md` (Decision log semua ADR + rationale), `TASK.md` (agentic task breakdown hands-off per FRD feature, dependency, QA per task) — semua wajib ada sebelum kode, diverifikasi F1

### Must NOT have (guardrails, anti-slop, scope boundaries)
- MUST NOT create backend server, API route, Supabase/Firebase cloud DB, multi-HP sync, conflict resolution
- MUST NOT implement multi-role auth/roles/permissions beyond single supervisor PIN
- MUST NOT implement POS cart/checkout, auto-suggest add-to-cart, transaction checkout flow
- MUST NOT implement OCR foto nota, vision expiry, camera OCR, Tesseract
- MUST NOT implement WA Business API send, queue, eskalasi notifikasi
- MUST NOT implement cetak label/QR generation
- MUST NOT let LLM compute urgencyScore, days_to_expiry, harga/HPP — LLM only wording & pairing, angka dari DB (CONTEXT.md anti-pattern)
- MUST NOT store expiry in SKU

## Verification strategy
> Zero human intervention - all verification is agent-executed.
- Test decision: **TDD untuk engine (urgency, expiry, guardrail, pairing) + tests-after untuk UI PWA**, framework **Vitest (unit) + Playwright (PWA UI) + bun**
- Evidence: `.omo/evidence/task-<N>-ai-inventory-expiry-advisor.<ext>` (attemptDir = currentAttemptDir from `omo ulw-loop status --json`, `.omo/evidence/ulw/<session>/<goalId>/a<attempt>`; outside ulw-loop use `.omo/evidence/ai-inventory/`)
- PWA checks: `bun run build && test -f dist/manifest.webmanifest && test -f dist/sw.js`
- Dexie checks: in-memory fake-indexeddb via `fake-indexeddb` in Vitest
- LLM checks: mock AdvisorPort (no real API key in tests), assert guardrail; integration test with mock Gemini response

## Execution strategy
### Parallel execution waves
- Wave 0: Hands-off Docs (21-24) — PRD, Design UX, Architecture, Decisions+TASK — 4 todos (jalan dulu, blokir eksekusi kalau tidak approve)
- Wave 1: Foundation (1-5) — scaffold, DB, auth, PWA shell, seed — 5 todos
- Wave 2: Core Inventaris + Engine (6-11) — CRUD, avg, expiry, notif, badge — 6 todos
- Wave 3: Advisor Tebus Murah (12-16) — pairing, hybrid LLM, template, approve, guardrail — 5 todos
- Wave 4: Dashboard/Backup/Polish (17-20) — UI, backup, settings, E2E — 4 todos
Target 5-8 per wave except final. Docs wave 0 must APPROVE before Wave 1-4 start (dependency).

### Dependency matrix
| Todo | Depends on | Blocks | Can parallelize with |
| --- | --- | --- | --- |
| 1 | 21,22,23,24 | 2,3,4,5 | — |
| 2 | 1 | 6,7,8,9,10,13,18 | 3,4 |
| 3 | 1 | 18 | 2,4 |
| 4 | 1 | 11,17,20 | 2,3 |
| 5 | 2 | 10,11 | 3,4 |
| 6 | 2 | 7,12,17 | 5 |
| 7 | 6 | 8,9,10,11,12 | — |
| 8 | 7 | 9 | 6 |
| 9 | 7,8 | 10,11,12 | — |
| 10 | 5,9 | 11 | 12,13 |
| 11 | 9,10,5 | 17 | 12,13 |
| 12 | 7,9 | 13 | 10,11 |
| 13 | 2,9,12 | 14,15,17 | 10,11 |
| 14 | 13 | 15 | 10,11,12 |
| 15 | 14 | 17 | 16 |
| 16 | 13,14 | 17 | 15 |
| 17 | 11,15 | 20 | 18,19 |
| 18 | 2,3 | 20 | 17,19 |
| 19 | 5,17 | 20 | 17,18 |
| 20 | 4,17,18,19 | — | — |
| 21 | none | 22,23,24,1 | — |
| 22 | 21 | 23,1 | 23,24 |
| 23 | 21 | 24,1 | 22,24 |
| 24 | 21,22,23 | 1 | — |

## Todos
- [~] 1. Init Vite+React+TS scaffold + PWA tooling + project structure (GATE: Wave 0 docs must exist) — deferred: user stop implementasi 2026-08-31, 4-crew AGENTS.md dulu
  What to do / Must NOT do: GATE check `test -f docs/frd.md && test -f docs/design.md && test -f docs/architecture.md && test -f docs/decisions.md && test -f TASK.md` must pass before `npm create vite@latest`; then add `dexie`, `vite-plugin-pwa`, `fake-indexeddb`, `vitest`, `playwright`, `langchain`, `@google/generative-ai`; create `src/db/`, `src/engine/`, `src/advisor/`, `src/features/`, `src/lib/`, `public/icons/`; config `vite.config.ts` PWA minimal; HUSKY/lint optional. MUST NOT create backend/server, Supabase, OCR deps.
  Parallelization: Wave 1 | Blocked by: 21,22,23,24 | Blocks: 2,3,4,5
  References (executor has NO interview context - be exhaustive): /home/yusuf/dev/2026/UNEJ/docs/adr/0001-local-first-dexie-backup-drive.md:5-14, /home/yusuf/dev/2026/UNEJ/docs/adr/0002-langchain-gemini-hybrid-advisor.md:5-9, /home/yusuf/dev/2026/UNEJ/.omo/drafts/ai-inventory-expiry-advisor.md:32, /home/yusuf/dev/2026/UNEJ/CONTEXT.md:1-10, /home/yusuf/dev/2026/UNEJ/docs/frd.md:1-20 (future artifact — created by 21), /home/yusuf/dev/2026/UNEJ/docs/design.md:1-20 (future artifact — created by 22)
  Acceptance criteria (agent-executable): `bun install && bun run build` exit 0 && `test -f dist/manifest.webmanifest && test -f dist/sw.js && grep -q "dexie" package.json && grep -q "vite-plugin-pwa" vite.config.ts`
  QA scenarios (name the exact tool + invocation): happy: `bun test` (Vitest empty suite passes) + `bun run build` produces manifest/sw — Evidence .omo/evidence/task-1-ai-inventory-expiry-advisor.log; failure: missing PWA plugin → build still passes but sw.js absent → test fails on file check — Evidence .omo/evidence/task-1-ai-inventory-expiry-advisor-fail.log
  Commit: Y | chore(scaffold): init Vite React Dexie PWA structure

- [~] 2. Dexie DB schema + InventoryRepository interface + migrations (sync-ready org_id) — deferred: user stop implementasi 2026-08-31
  What to do / Must NOT do: Create `src/db/db.ts` Dexie with tables `skus`, `kategoris`, `batches`, `transaksis`, `promos`, `advisorCache`; add `org_id` column default `toko-01` indexed on skus/batches (reserved for 1→10 sharding, comment `// sync-ready sharding`), define `InventoryRepository` interface (methods CRUD per entity); Dexie impl `DexieRepository`; handle expiry null (non-perishable skip), index `expiry_date`, `sku_id`, `kategori_id`, `org_id`. MUST NOT add cloud sync logic v1, keep org_id default single value.
  Parallelization: Wave 1 | Blocked by: 1 | Blocks: 6,7,8,9,10,13,18
  References: /home/yusuf/dev/2026/UNEJ/docs/adr/0001-local-first-dexie-backup-drive.md:5-14, /home/yusuf/dev/2026/UNEJ/CONTEXT.md:8-15, /home/yusuf/dev/2026/UNEJ/.omo/drafts/ai-inventory-expiry-advisor.md:42-44
  Acceptance criteria: `bun test src/db/db.test.ts` — create SKU+Batch with expiry, query by sku_id returns N, batch expiry null not indexed for engine, repository interface has methods for each entity — all pass
  QA scenarios: happy: `bun test src/db/db.test.ts --reporter=verbose` insert 3 batches diff expiry → query sorted → Evidence .omo/evidence/task-2-ai-inventory-expiry-advisor.json; failure: try insert Batch without sku_id → Dexie bulkError → test asserts reject — Evidence .omo/evidence/task-2-ai-inventory-expiry-advisor-fail.json
  Commit: Y | feat(db): Dexie schema + InventoryRepository

- [~] 3. Supervisor PIN auth + encrypted API key storage (single device) — deferred: user stop implementasi 2026-08-31, 4-crew AGENTS.md dulu
  What to do / Must NOT do: Create `src/features/auth/pinStore.ts` + `src/lib/crypto.ts` (PBKDF2 derive, AES-GCM optional for key); PIN hash via bcrypt/subtle, stored in Dexie `settings`; API key (Gemini) encrypted via PIN-derived key in localStorage; single supervisor, no roles. MUST NOT implement multi-role, lockout escalation beyond simple fail count.
  Parallelization: Wave 1 | Blocked by: 1 | Blocks: 18
  References: /home/yusuf/dev/2026/UNEJ/CONTEXT.md:19, /home/yusuf/dev/2026/UNEJ/docs/adr/0001-local-first-dexie-backup-drive.md:9-14, /home/yusuf/dev/2026/UNEJ/docs/adr/0002-langchain-gemini-hybrid-advisor.md:9, /home/yusuf/dev/2026/UNEJ/.omo/drafts/ai-inventory-expiry-advisor.md:39
  Acceptance criteria: `bun test src/features/auth/pinStore.test.ts` — set PIN "1234" → verify true, wrong "0000" false, API key roundtrip encrypt/decrypt succeeds, no plaintext key in Dexie — pass
  QA scenarios: happy: set→verify→store key→retrieve decrypt — Evidence .omo/evidence/task-3-ai-inventory-expiry-advisor.json; failure: wrong PIN decrypt fails → assert null/error — Evidence .omo/evidence/task-3-ai-inventory-expiry-advisor-fail.json
  Commit: Y | feat(auth): supervisor PIN + encrypted API key

- [~] 4. PWA shell + manifest + Service Worker offline cache — deferred: user stop implementasi 2026-08-31, 4-crew AGENTS.md dulu
  What to do / Must NOT do: Config `vite-plugin-pwa` with manifest (name, icons, display standalone, themeColor), Workbox runtime cache for app shell & Dexie not needed; offline fallback page; install prompt hook. MUST NOT add server, cloud.
  Parallelization: Wave 1 | Blocked by: 1 | Blocks: 11,17,20
  References: /home/yusuf/dev/2026/UNEJ/docs/adr/0001-local-first-dexie-backup-drive.md:5-14, /home/yusuf/dev/2026/UNEJ/CONTEXT.md:20-21, /home/yusuf/dev/2026/UNEJ/.omo/drafts/ai-inventory-expiry-advisor.md:46, /home/yusuf/dev/2026/UNEJ/docs/design.md:1-30 (future artifact — created by 22, for PWA install UX)
  Acceptance criteria: `bun run build && npx playwright test e2e/pwa.spec.ts` — manifest contains name/icons, sw.js exists, page loads offline via `page.route` fallback — pass
  QA scenarios: happy: playwright offline emulation → reload still renders shell — Evidence .omo/evidence/task-4-ai-inventory-expiry-advisor.png; failure: missing icon → manifest validation fails — Evidence .omo/evidence/task-4-ai-inventory-expiry-advisor-fail.log
  Commit: Y | feat(pwa): manifest + SW offline shell

- [~] 5. Seed kategori + threshold config (generic [7,3,1] editable) — deferred: user stop implementasi 2026-08-31, AGENTS.md 4-crew done
  What to do / Must NOT do: Create `src/db/seed.ts` seed 3 kategori (Dairy, Snack, Beras) with threshold_h_minus [7,3,1] default (editable), allow supervisor edit via `updateKategoriThreshold`; validate non-empty, descending, >0, no dup. Resolve C-02: generik [7,3,1] is truth, seed example values are overrides editable. MUST NOT hardcode non-editable.
  Parallelization: Wave 1 | Blocked by: 2 | Blocks: 10,11
  References: /home/yusuf/dev/2026/UNEJ/CONTEXT.md:10-11, /home/yusuf/dev/2026/UNEJ/CONTEXT.md:20, /home/yusuf/dev/2026/UNEJ/.omo/drafts/ai-inventory-expiry-advisor.md:25, /home/yusuf/dev/2026/UNEJ/docs/adr/0001-local-first-dexie-backup-drive.md:5
  Acceptance criteria: `bun test src/db/seed.test.ts` — seed creates 3 kategori, each threshold [7,3,1], edit to [14,7,3] succeeds, edit to [3,3,1] rejects duplicate, edit to [] rejects — pass
  QA scenarios: happy: seed→query kategori→threshold [7,3,1] — Evidence .omo/evidence/task-5-ai-inventory-expiry-advisor.json; failure: threshold [1,7,3] not descending → validation error — Evidence .omo/evidence/task-5-ai-inventory-expiry-advisor-fail.json
  Commit: Y | feat(kategori): seed threshold editable

- [~] 6. SKU & Kategori CRUD + validation (HPP/harga) — deferred: user stop implementasi 2026-08-31
  What to do / Must NOT do: `src/features/sku/skuService.ts` + Kategori CRUD UI; SKU fields nama, kategori_id, hpp, harga_normal, barcode optional; validate hpp>0, harga_normal>=hpp (warn if not), nama non-empty. MUST NOT store expiry in SKU.
  Parallelization: Wave 2 | Blocked by: 2 | Blocks: 7,12,17
  References: /home/yusuf/dev/2026/UNEJ/CONTEXT.md:8, /home/yusuf/dev/2026/UNEJ/CONTEXT.md:24-26, /home/yusuf/dev/2026/UNEJ/.omo/drafts/ai-inventory-expiry-advisor.md:43
  Acceptance criteria: `bun test src/features/sku/skuService.test.ts` — create SKU Dairy valid passes, create SKU with hpp<=0 rejects, create SKU with expiry field rejects (schema), kategori required — pass
  QA scenarios: happy: create SKU → list → edit harga — Evidence .omo/evidence/task-6-ai-inventory-expiry-advisor.json; failure: hpp>harga_normal → warn but allow or reject per guard — Evidence .omo/evidence/task-6-ai-inventory-expiry-advisor-fail.json
  Commit: Y | feat(sku): SKU Kategori CRUD

- [~] 7. Batch/Lot CRUD (qty, expiry_date, HPP snapshot) — deferred: user stop implementasi 2026-08-31, AGENTS.md 4-crew done
  What to do / Must NOT do: `src/features/batch/batchService.ts` CRUD batch per SKU: qty>0, expiry_date nullable (null=non-perishable skip engine), received_at auto now, hpp_snapshot copy from SKU at receive time; list batches per SKU sorted expiry asc. MUST NOT store expiry in SKU, MUST handle null correctly.
  Parallelization: Wave 2 | Blocked by: 6 | Blocks: 8,9,10,11,12
  References: /home/yusuf/dev/2026/UNEJ/CONTEXT.md:9, /home/yusuf/dev/2026/UNEJ/CONTEXT.md:12, /home/yusuf/dev/2026/UNEJ/CONTEXT.md:24, /home/yusuf/dev/2026/UNEJ/.omo/drafts/ai-inventory-expiry-advisor.md:43
  Acceptance criteria: `bun test src/features/batch/batchService.test.ts` — create batch qty 10 expiry 2026-09-05 passes, create batch expiry null passes but not returned by engine query, qty 0 rejects — pass
  QA scenarios: happy: create SKU → 3 batches diff expiry → list sorted — Evidence .omo/evidence/task-7-ai-inventory-expiry-advisor.json; failure: expiry in past allowed? warn but not reject — Evidence .omo/evidence/task-7-ai-inventory-expiry-advisor-fail.json
  Commit: Y | feat(batch): Batch Lot CRUD

- [~] 8. Avg Daily Usage calculator + histori transaksi model — deferred: user stop implementasi 2026-08-31, AGENTS.md 4-crew done
  What to do / Must NOT do: `src/engine/avgUsage.ts` + `transaksis` table (sku_id, qty_sold, sold_at); avg = total_qty_sold / days_with_history over last 14d (or 30d if no data), fallback manual input if <14 hari data; store per SKU. MUST NOT hallucinate usage.
  Parallelization: Wave 2 | Blocked by: 7 | Blocks: 9
  References: /home/yusuf/dev/2026/UNEJ/CONTEXT.md:14-15, /home/yusuf/dev/2026/UNEJ/.omo/drafts/ai-inventory-expiry-advisor.md:27
  Acceptance criteria: `bun test src/engine/avgUsage.test.ts` — 10 hari histori 20 qty sold → avg 2, <14 hari fallback manual 1.5 used, ceil days logic Asia/Jakarta — pass
  QA scenarios: happy: insert 14d transaksis → calc avg 2.3 — Evidence .omo/evidence/task-8-ai-inventory-expiry-advisor.json; failure: no histori → returns manual fallback, not NaN — Evidence .omo/evidence/task-8-ai-inventory-expiry-advisor-fail.json
  Commit: Y | feat(engine): avg daily usage

- [~] 9. Expiry engine: days_to_expiry + urgencyScore deterministic — deferred: user stop implementasi 2026-08-31, AGENTS.md 4-crew done
  What to do / Must NOT do: `src/engine/expiry.ts` functions `daysToExpiry(expiry_date: string, today=Asia/Jakarta startOfDay)` using `date-fns-tz` or `Intl.DateTimeFormat` with `timeZone: 'Asia/Jakarta'` + ceil, `urgencyScore(qty, days, avg)` = qty*days / max(avg,1) → lower/more negative = more urgent, sorting helper, skip expiry null. MUST NOT let LLM compute, MUST use local TZ Asia/Jakarta (not UTC).
  Parallelization: Wave 2 | Blocked by: 7,8 | Blocks: 10,11,12
  References: /home/yusuf/dev/2026/UNEJ/CONTEXT.md:12-15, /home/yusuf/dev/2026/UNEJ/CONTEXT.md:26, /home/yusuf/dev/2026/UNEJ/docs/adr/0002-langchain-gemini-hybrid-advisor.md:7
  Acceptance criteria: `bun test src/engine/expiry.test.ts` — daysToExpiry 2026-09-05 from 2026-09-02 =3, expiry null returns null, urgencyScore 10*3/2=15, negative days -2 → -10, sort urgent first — pass
  QA scenarios: happy: 5 batches sorted by urgency — Evidence .omo/evidence/task-9-ai-inventory-expiry-advisor.json; failure: avg 0 → divisor 1 not Infinity — Evidence .omo/evidence/task-9-ai-inventory-expiry-advisor-fail.json
  Commit: Y | feat(engine): expiry urgencyScore

- [~] 10. Notifikasi scheduler (daily 07:00 + threshold per kategori) — deferred: user stop implementasi 2026-08-31, AGENTS.md 4-crew done
  What to do / Must NOT do: `src/engine/notifScheduler.ts` + SW `src/sw/notif.ts` — daily check 07:00 Asia/Jakarta (setInterval + on app open), query batches where days_to_expiry in threshold_h_minus, request Notification permission, show push + badge count; WA hook stub (no send) log only. Resolve C-04: daily 07:00 + on-demand. MUST NOT implement WA send, eskalasi.
  Parallelization: Wave 2 | Blocked by: 5,9 | Blocks: 11
  References: /home/yusuf/dev/2026/UNEJ/CONTEXT.md:20-21, /home/yusuf/dev/2026/UNEJ/docs/adr/0002-langchain-gemini-hybrid-advisor.md:8, /home/yusuf/dev/2026/UNEJ/.omo/drafts/ai-inventory-expiry-advisor.md:44
  Acceptance criteria: `bun test src/engine/notifScheduler.test.ts` — mock today 2026-09-02, batch H-3 in Dairy threshold [7,3,1] triggers, batch H-10 not trigger, expiry null not trigger — pass
  QA scenarios: happy: batch H-3 → scheduler returns 1 notif with sku name — Evidence .omo/evidence/task-10-ai-inventory-expiry-advisor.json; failure: permission denied → fallback badge only no throw — Evidence .omo/evidence/task-10-ai-inventory-expiry-advisor-fail.json
  Commit: Y | feat(notif): scheduler threshold

- [~] 11. Badge & urgent dashboard list (UX UMKM 48px, 3-tap) — deferred: user stop implementasi 2026-08-31, AGENTS.md 4-crew done
  What to do / Must NOT do: `src/features/dashboard/UrgentList.tsx` + badge component `src/components/Badge.tsx` — list urgent batches sorted urgency, filter by kategori, badge count per SKU (sum qty urgent), color by H (red H<=1, orange H<=3, yellow H<=7), button min 48px height, bahasa Indonesia labels; data from Dexie via Repository. MUST enforce design.md tokens.
  Parallelization: Wave 2 | Blocked by: 9,10,5 | Blocks: 17
  References: /home/yusuf/dev/2026/UNEJ/CONTEXT.md:20, /home/yusuf/dev/2026/UNEJ/.omo/drafts/ai-inventory-expiry-advisor.md:46, /home/yusuf/dev/2026/UNEJ/docs/design.md:1-40 (future artifact — created by 22, 48px + bahasa Indonesia)
  Acceptance criteria: `npx playwright test e2e/badge.spec.ts` — seed 3 batches H-1/H-3/H-10 → dashboard shows 2 urgent (H-1 red, H-3 orange), H-10 hidden, badge count matches && `expect(page.locator('button').first()).toHaveCSS('min-height','48px')` — pass
  QA scenarios: happy: playwright urgent list sorted — Evidence .omo/evidence/task-11-ai-inventory-expiry-advisor.png; failure: expiry null batch shows no badge — Evidence .omo/evidence/task-11-ai-inventory-expiry-advisor-fail.png
  Commit: Y | feat(dashboard): urgent list badge

- [~] 12. Pairing rule engine (co-occurrence + kategori fallback) — deferred: user stop implementasi 2026-08-31, AGENTS.md 4-crew done
  What to do / Must NOT do: `src/advisor/pairing.ts` — from `transaksis`, build co-occurrence map (sku A often bought with B), for urgent batch's SKU find top pairing SKU yang laku (avg usage high, not urgent), fallback to kategori pairing manual (Roti→Susu). No LLM here.
  Parallelization: Wave 3 | Blocked by: 7,9 | Blocks: 13
  References: /home/yusuf/dev/2026/UNEJ/docs/adr/0002-langchain-gemini-hybrid-advisor.md:6, /home/yusuf/dev/2026/UNEJ/CONTEXT.md:17
  Acceptance criteria: `bun test src/advisor/pairing.test.ts` — histori Roti+Susu 5x → pairing for Susu returns Roti, no histori → fallback kategori returns configured pasangan — pass
  QA scenarios: happy: pairing found — Evidence .omo/evidence/task-12-ai-inventory-expiry-advisor.json; failure: urgent SKU has no pairing → returns null not error, LLM will handle wording — Evidence .omo/evidence/task-12-ai-inventory-expiry-advisor-fail.json
  Commit: Y | feat(advisor): pairing engine

- [~] 13. LangChain+Gemini hybrid advisor service + cache + guardrail — deferred: user stop implementasi 2026-08-31, AGENTS.md 4-crew done
  What to do / Must NOT do: `src/advisor/AdvisorPort.ts` interface + `src/advisor/LangChainGeminiAdvisor.ts` (LLM only for top-N urgent), prompt includes SKU, batch qty, days_to_expiry, pasangan, HPP/harga_normal (angka dari DB), guardrail floor HPP*0.85 enforced before LLM (LLM dilarang ngarang angka, angka from DB), cache result in `advisorCache` Dexie with TTL 24h; mock for tests; trigger daily 07:05 + on-demand after batch insert urgent. Resolve C-06, M-05, M-09.
  Parallelization: Wave 3 | Blocked by: 2,9,12 | Blocks: 14,15,17
  References: /home/yusuf/dev/2026/UNEJ/docs/adr/0002-langchain-gemini-hybrid-advisor.md:5-9, /home/yusuf/dev/2026/UNEJ/CONTEXT.md:16-17, /home/yusuf/dev/2026/UNEJ/CONTEXT.md:26, /home/yusuf/dev/2026/UNEJ/.omo/drafts/ai-inventory-expiry-advisor.md:45
  Acceptance criteria: `bun test src/advisor/geminiAdvisor.test.ts` — mock urgent batch → advisor returns {aksi, alasan, pasangan, harga_tebus >=HPP*0.85}, cache hit second call no LLM, failure: harga_tebus 0.84*HPP rejects — pass
  QA scenarios: happy: top-N 3 urgent → 3 suggestions cached — Evidence .omo/evidence/task-13-ai-inventory-expiry-advisor.json; failure: offline → returns cached stale, not throw — Evidence .omo/evidence/task-13-ai-inventory-expiry-advisor-fail.json
  Commit: Y | feat(advisor): LangChain Gemini hybrid

- [~] 14. Tebus Murah template manual + AI assist flow (proposed) — deferred: user stop implementasi 2026-08-31, AGENTS.md 4-crew done
  What to do / Must NOT do: `src/features/promo/promoService.ts` + UI `TebusForm.tsx` — create promo proposed: choose urgent batch, pasangan SKU (from pairing or manual), harga_tebus input, validasi floor HPP*0.85, template manual vs AI assist (prefill from advisor), status proposed. MUST NOT auto-activate.
  Parallelization: Wave 3 | Blocked by: 13 | Blocks: 15
  References: /home/yusuf/dev/2026/UNEJ/CONTEXT.md:17-18, /home/yusuf/dev/2026/UNEJ/.omo/drafts/ai-inventory-expiry-advisor.md:45
  Acceptance criteria: `bun test src/features/promo/promoService.test.ts` — create manual promo valid passes, create with harga_tebus 0.84*HPP rejects with error "below HPP*0.85", AI prefill sets harga_tebus — pass
  QA scenarios: happy: AI assist fills form → submit proposed — Evidence .omo/evidence/task-14-ai-inventory-expiry-advisor.json; failure: harga_tebus > harga_normal → warn/reject — Evidence .omo/evidence/task-14-ai-inventory-expiry-advisor-fail.json
  Commit: Y | feat(promo): tebus murah proposed

- [~] 15. 1-tap Approve proposed→active + Promo Aktif lifecycle (UX 1-tap, 3-tap flow) — deferred: user stop implementasi 2026-08-31, AGENTS.md 4-crew done
  What to do / Must NOT do: `src/features/promo/approve.ts` + `PromoAktifList.tsx` — approve button 48px, 1-tap supervisor → status active, tampil di dashboard & badge SKU; lifecycle active→expired (after expiry) or consumed (qty 0) via daily check; ensure flow buka→lihat→approve ≤3 taps; list promo aktif query. MUST NOT add POS auto, MUST bahasa Indonesia.
  Parallelization: Wave 3 | Blocked by: 14 | Blocks: 17
  References: /home/yusuf/dev/2026/UNEJ/CONTEXT.md:18, /home/yusuf/dev/2026/UNEJ/.omo/drafts/ai-inventory-expiry-advisor.md:45, /home/yusuf/dev/2026/UNEJ/docs/design.md:1-40 (future artifact — created by 22, 3-tap + 48px)
  Acceptance criteria: `npx playwright test e2e/promo-approve.spec.ts` — propose → approve (1 tap) → appears in Promo Aktif list with badge, expired auto moves to expired && button height 48px && `e2e/3tap.spec.ts` counts ≤3 navigations — pass
  QA scenarios: happy: approved promo visible — Evidence .omo/evidence/task-15-ai-inventory-expiry-advisor.png; failure: non-supervisor cannot approve (blocked by PIN check) — Evidence .omo/evidence/task-15-ai-inventory-expiry-advisor-fail.png
  Commit: Y | feat(promo): approve lifecycle

- [~] 16. Guardrail & validation tests (HPP, harga, LLM angka) — deferred: user stop implementasi 2026-08-31, AGENTS.md 4-crew done
  What to do / Must NOT do: `src/advisor/guardrail.test.ts` comprehensive + `src/lib/validation.ts` — property tests: harga_tebus >= HPP*0.85 floor, optional ceiling harga_normal*0.5 if enabled (configurable), HPP>0, harga_tebus not NaN, LLM output must not contain angka harga if not from DB (mock check). This todo is pure test hardening for C-03/M-09.
  Parallelization: Wave 3 | Blocked by: 13,14 | Blocks: 17
  References: /home/yusuf/dev/2026/UNEJ/CONTEXT.md:17, /home/yusuf/dev/2026/UNEJ/CONTEXT.md:26, /home/yusuf/dev/2026/UNEJ/docs/adr/0002-langchain-gemini-hybrid-advisor.md:7, /home/yusuf/dev/2026/UNEJ/.omo/drafts/ai-inventory-expiry-advisor.md:29
  Acceptance criteria: `bun test src/advisor/guardrail.test.ts` — all 4 guard cases pass, LLM mock that tries to ngarang harga fails — pass
  QA scenarios: happy: floor pass at 0.85 — Evidence .omo/evidence/task-16-ai-inventory-expiry-advisor.log; failure: floor fail at 0.84 → throws — Evidence .omo/evidence/task-16-ai-inventory-expiry-advisor-fail.log
  Commit: Y | test(guardrail): tebus murah bounds

- [~] 17. Dashboard Promo Aktif + histori saran UI (UX UMKM) — deferred: user stop implementasi 2026-08-31, AGENTS.md 4-crew done
  What to do / Must NOT do: `src/features/dashboard/DashboardPage.tsx` — sections: urgent list (from 11), promo aktif cards (from 15), histori advisorCache with timestamp, badge per SKU; responsive PWA, font 16px+, bahasa Indonesia, button 48px; card layout sesuai design.md wireframe.
  Parallelization: Wave 4 | Blocked by: 11,15 | Blocks: 20
  References: /home/yusuf/dev/2026/UNEJ/CONTEXT.md:18, /home/yusuf/dev/2026/UNEJ/.omo/drafts/ai-inventory-expiry-advisor.md:46, /home/yusuf/dev/2026/UNEJ/docs/design.md:1-40 (future artifact — created by 22, wireframe + 16px + 48px)
  Acceptance criteria: `npx playwright test e2e/dashboard.spec.ts` — dashboard shows 3 sections, promo card contains "Tebus Murah" + harga_tebus, histori last 5, font size >=16px — pass
  QA scenarios: happy: dashboard full — Evidence .omo/evidence/task-17-ai-inventory-expiry-advisor.png; failure: no promo → empty state "Belum ada promo" — Evidence .omo/evidence/task-17-ai-inventory-expiry-advisor-fail.png
  Commit: Y | feat(dashboard): promo histori UI

- [~] 18. Backup/Restore JSON terenkripsi + Drive hook — deferred: user stop implementasi 2026-08-31, AGENTS.md 4-crew done
  What to do / Must NOT do: `src/features/backup/backupService.ts` — export all Dexie tables to JSON, encrypt AES-GCM-256 key=PBKDF2(PIN, salt random 16b, 100k iter), download file; import decrypt & restore; Drive hook stub (window.showPicker if available else manual upload instruction). Resolve M-06.
  Parallelization: Wave 4 | Blocked by: 2,3 | Blocks: 20
  References: /home/yusuf/dev/2026/UNEJ/docs/adr/0001-local-first-dexie-backup-drive.md:5, /home/yusuf/dev/2026/UNEJ/.omo/drafts/ai-inventory-expiry-advisor.md:47
  Acceptance criteria: `bun test src/features/backup/backupService.test.ts` — export → import roundtrip restores SKU/Batch count, wrong PIN decrypt fails, unencrypted flag deferred not used — pass
  QA scenarios: happy: backup→clear→restore → data back — Evidence .omo/evidence/task-18-ai-inventory-expiry-advisor.json; failure: corrupt JSON → error not crash — Evidence .omo/evidence/task-18-ai-inventory-expiry-advisor-fail.json
  Commit: Y | feat(backup): encrypted export restore

- [~] 19. Threshold settings page + HPP/margin config (UX UMKM) — deferred: user stop implementasi 2026-08-31, AGENTS.md 4-crew done
  What to do / Must NOT do: `src/features/settings/SettingsPage.tsx` — edit threshold_h_minus per kategori (validation descending, >0, no dup), display HPP*0.85 floor, view avg manual fallback; form bahasa Indonesia, input 48px, error message jelas non-tech; persist Dexie. Follow design.md.
  Parallelization: Wave 4 | Blocked by: 5,17 | Blocks: 20
  References: /home/yusuf/dev/2026/UNEJ/CONTEXT.md:10-11, /home/yusuf/dev/2026/UNEJ/.omo/drafts/ai-inventory-expiry-advisor.md:48, /home/yusuf/dev/2026/UNEJ/docs/design.md:1-40 (future artifact — created by 22, bahasa Indonesia + 48px)
  Acceptance criteria: `npx playwright test e2e/settings.spec.ts` — edit Dairy to [14,7,3] saves, invalid [3,3,1] shows error bahasa Indonesia, button 48px — pass
  QA scenarios: happy: settings edit — Evidence .omo/evidence/task-19-ai-inventory-expiry-advisor.png; failure: empty threshold → error — Evidence .omo/evidence/task-19-ai-inventory-expiry-advisor-fail.png
  Commit: Y | feat(settings): threshold config

- [~] 20. E2E + build + PWA installability + offline QA polish — deferred: user stop implementasi 2026-08-31, AGENTS.md 4-crew done
  What to do / Must NOT do: `e2e/full-flow.spec.ts` full: seed → create SKU/Batch H-2 → wait advisor mock → propose tebus → approve → dashboard promo → backup export; `bun run build` typecheck, lighthouse PWA audit minimal, offline reload still works. Polish error states.
  Parallelization: Wave 4 | Blocked by: 4,17,18,19 | Blocks: none
  References: /home/yusuf/dev/2026/UNEJ/docs/adr/0001-local-first-dexie-backup-drive.md:5, /home/yusuf/dev/2026/UNEJ/docs/adr/0002-langchain-gemini-hybrid-advisor.md:5-9
  Acceptance criteria: `bun run build && npx playwright test e2e/full-flow.spec.ts` — full flow 6 steps passes, build no TS errors — pass
  QA scenarios: happy: full flow green — Evidence .omo/evidence/task-20-ai-inventory-expiry-advisor.mp4; failure: offline without cache → graceful empty state not crash — Evidence .omo/evidence/task-20-ai-inventory-expiry-advisor-fail.png
  Commit: Y | test(e2e): full flow polish

- [x] 21. FRD hands-off per feature (`docs/frd.md`) — comprehensive
  What to do / Must NOT do: Tulis `docs/frd.md` FRD breakdown per feature (bukan PRD general): F1 PWA Shell offline, F2 Inventaris SKU/Batch/Kategori, F3 Expiry Engine+Notifikasi, F4 Advisor Hybrid+Tebus Murah, F5 Dashboard/Badge/Histori, F6 Backup/Restore — tiap feature punya FRD-xxx: requirements, acceptance Gherkin, trace ke TASK-yy, KPI (waste -50%, promo >30%), glossary CONTEXT.md. Bahasa Indonesia, 1 feature = 1 section traceable ke TASK.md. MUST NOT placeholder, MUST link CONTEXT & ADRs per feature.
  Parallelization: Wave 0 | Blocked by: none | Blocks: 22,23,24,1
  References: /home/yusuf/dev/2026/UNEJ/CONTEXT.md:1-30, /home/yusuf/dev/2026/UNEJ/.omo/drafts/ai-inventory-expiry-advisor.md:42-54, /home/yusuf/dev/2026/UNEJ/docs/adr/0001-local-first-dexie-backup-drive.md:1-15, /home/yusuf/dev/2026/UNEJ/docs/adr/0002-langchain-gemini-hybrid-advisor.md:1-15
  Acceptance criteria: `test -f docs/frd.md && grep -q "FRD-.*Feature" docs/frd.md && grep -q "Acceptance" docs/frd.md && grep -q "Trace.*TASK" docs/frd.md && wc -l docs/frd.md | awk '{exit $1<300}'` — >300 lines, 6 features FRD-01..06, Gherkin + trace present — pass
  QA scenarios: happy: `cat docs/frd.md` contains FRD-01..06 + acceptance + trace — Evidence .omo/evidence/task-21-ai-inventory-expiry-advisor-frd.md; failure: missing trace → grep fails — Evidence .omo/evidence/task-21-ai-inventory-expiry-advisor-fail.log
  Commit: Y | docs(frd): FRD per feature

- [x] 22. Design & UX untuk UMKM non-tech (`docs/design.md`)
  What to do / Must NOT do: Tulis `docs/design.md` hands-off UX: user journey (supervisor 3-tap: buka→lihat urgent→approve tebus), wireframe low-fi ASCII/Mermaid (dashboard, form batch, promo card), design token (font 16px+, kontras AA, bahasa Indonesia, button 48px untuk jempol), flow 1-tap approve, empty states, error handling, aksesibilitas, prototype Figma link (opsional, kosong jika belum ada), trace ke FRD feature. Validasi: max 3 tap untuk tugas utama. MUST NOT skip wireframe or journey.
  Parallelization: Wave 0 | Blocked by: 21 | Blocks: 23,1
  References: /home/yusuf/dev/2026/UNEJ/docs/frd.md:1-80 (from 21), /home/yusuf/dev/2026/UNEJ/CONTEXT.md:18-21, /home/yusuf/dev/2026/UNEJ/.omo/drafts/ai-inventory-expiry-advisor.md:46
  Acceptance criteria: `test -f docs/design.md && grep -q "User Journey" docs/design.md && grep -q "Wireframe" docs/design.md && grep -q "3-tap" docs/design.md && grep -q "Aksesibilitas" docs/design.md` — pass
  QA scenarios: happy: design.md has journey+wireframe+3-tap — Evidence .omo/evidence/task-22-ai-inventory-expiry-advisor-design.md; failure: missing wireframe → fail — Evidence .omo/evidence/task-22-ai-inventory-expiry-advisor-fail.log
  Commit: Y | docs(design): UX UMKM non-tech

- [x] 23. Architecture scalable pragmatis (`docs/architecture.md`)
  What to do / Must NOT do: Tulis `docs/architecture.md` hands-off: C4 diagram (context/container), local-first Dexie + Repository pattern, sync-ready extension (no sync v1), scalability 1→10 toko (sharding by org_id, migration path ke Supabase), tradeoff table (Dexie vs OPFS vs Supabase), security (PIN+PBKDF2+AES-GCM), performance (IndexedDB limit, pagination), failure modes (HP hilang, quota). MUST be pragmatis not gold-plating.
  Parallelization: Wave 0 | Blocked by: 21 | Blocks: 24,1
  References: /home/yusuf/dev/2026/UNEJ/docs/adr/0001-local-first-dexie-backup-drive.md:1-15, /home/yusuf/dev/2026/UNEJ/docs/adr/0002-langchain-gemini-hybrid-advisor.md:1-15, /home/yusuf/dev/2026/UNEJ/CONTEXT.md:1-30
  Acceptance criteria: `test -f docs/architecture.md && grep -q "C4\|Container" docs/architecture.md && grep -q "Repository" docs/architecture.md && grep -q "Scalability" docs/architecture.md && grep -q "Tradeoff" docs/architecture.md` — pass
  QA scenarios: happy: architecture.md has C4+tradeoff+pragmatic scalability — Evidence .omo/evidence/task-23-ai-inventory-expiry-advisor-arch.md; failure: missing tradeoff section → fail — Evidence .omo/evidence/task-23-ai-inventory-expiry-advisor-fail.log
  Commit: Y | docs(architecture): scalable pragmatis

- [x] 24. Decisions log + TASK agentic (`docs/decisions.md` + `TASK.md`)
- [x] 25. Agent rules 4-crew (`AGENTS.md`) — GitHub flow + pembagian Frontend 1 orang + 3 orang lain + opencode discipline
  What to do / Must NOT do: Tulis `AGENTS.md` di root + `AGENT.md` copy: aturan tetap 4 orang pakai opencode — hands-off, local-first, per-feature, 3-tap; mape Crew A Frontend 1 orang (TASK-04,11,15,17,19,20 + Design), Crew B Core (TASK-02,05,06,07,08,09,10), Crew C Advisor (TASK-12,13,14,16), Crew D Platform (TASK-01,03,18 + F1-F4); GitHub flow main protected + feat/<task>-slug + 1 worktree per TASK + PR 1 reviewer + conventional commits + CI bun build/test/playwright; konteks pointer ke docs/frd/frd-0*.md per-feature (bukan global). MUST NOT tulis kode produk, hanya AGENTS.md.
  Parallelization: Wave 0 docs polish | Blocked by: 21,22,23,24 | Blocks: none
  References: /home/yusuf/dev/2026/UNEJ/docs/frd/frd-01-pwa.md:1-145, /home/yusuf/dev/2026/UNEJ/docs/design.md:1-30, /home/yusuf/dev/2026/UNEJ/docs/architecture.md:1-30, /home/yusuf/dev/2026/UNEJ/TASK.md:1-65, /home/yusuf/dev/2026/UNEJ/CONTEXT.md:1-30
  Acceptance criteria (agent-executable): `test -f AGENTS.md && test -f AGENT.md && grep -q "Crew A — Frontend" AGENTS.md && grep -q "GitHub Flow" AGENTS.md && grep -q "per-feature" AGENTS.md && grep -q "TASK-01" AGENTS.md` — pass
  QA scenarios (name the exact tool + invocation): happy: `cat AGENTS.md` contains 4-crew table + GitHub flow + per-feature pointer — Evidence .omo/evidence/task-25-agents.md; failure: missing Crew A → grep fails — Evidence .omo/evidence/task-25-fail.log
  Commit: Y | docs(agents): 4-crew GitHub flow + per-feature
  What to do / Must NOT do: Tulis `docs/decisions.md` (kumpulan ADR-001/002 + log keputusan Q1-Q13 dengan rationale) dan `TASK.md` (agentic breakdown hands-off per FRD feature: 24 tasks dengan mapping FRD-xxx→TASK-yy, dependency, prompt untuk agent, QA per task, evidence path, commit). TASK.md must mirror Todos 1-24 verbatim dengan format `TASK-01 [FRD-02]: ... | Depends | QA | Evidence`. MUST NOT diverge dari plan Todos atau FRD.
  Parallelization: Wave 0 | Blocked by: 21,22,23 | Blocks: 1
  References: /home/yusuf/dev/2026/UNEJ/docs/adr/0001-local-first-dexie-backup-drive.md:1-15, /home/yusuf/dev/2026/UNEJ/docs/adr/0002-langchain-gemini-hybrid-advisor.md:1-15, /home/yusuf/dev/2026/UNEJ/.omo/drafts/ai-inventory-expiry-advisor.md:36-54, /home/yusuf/dev/2026/UNEJ/.omo/plans/ai-inventory-expiry-advisor.md:84-243, /home/yusuf/dev/2026/UNEJ/docs/frd.md:1-100 (from 21)
  Acceptance criteria: `test -f docs/decisions.md && test -f TASK.md && grep -q "ADR-001" docs/decisions.md && grep -q "TASK-01" TASK.md && grep -c "TASK-" TASK.md | awk '{exit $1<24}'` — both exist, 24 tasks — pass
  QA scenarios: happy: decisions+tasks complete 24 — Evidence .omo/evidence/task-24-ai-inventory-expiry-advisor-tasks.md; failure: TASK count <24 → fail — Evidence .omo/evidence/task-24-ai-inventory-expiry-advisor-fail.log
  Commit: Y | docs(decisions-tasks): log + agentic TASK

## Final verification wave
> Runs in parallel after ALL todos. ALL must APPROVE. Surface results and wait for the user's explicit okay before declaring complete.
- [~] F1. Plan compliance audit — verify every Must have/Must NOT have from Scope carried to todos, no missing references, no placeholder, guardrails enforced (C-02/C-03/M-01..M-10 checked), Evidence .omo/evidence/final/f1.json — deferred: user stop implementasi 2026-08-31, docs-only
- [~] F2. Code quality review — `bun run build && bun test` 0 errors, no TODO/FIXME/as any, Repository pattern followed, urgency engine deterministic — Evidence .omo/evidence/final/f2.log — deferred: user stop implementasi 2026-08-31, docs-only
- [~] F3. Real manual QA — Playwright launch PWA offline, create batch H-2, see badge red, approve tebus promo appears, backup restore roundtrip, dashboard histori — Evidence .omo/evidence/final/f3/ screenshots — deferred: user stop implementasi 2026-08-31, docs-only
- [~] F4. Scope fidelity — confirm OUT not built (no backend, no sync, no OCR, no WA send, no QR print, no POS cart) via grep `grep -r supabase|ocr|qrcode` empty and allow `waHook.log` but not `whatsapp.*send` — Evidence .omo/evidence/final/f4.log — deferred: user stop implementasi 2026-08-31, docs-only

## Commit strategy
- Conventional commits per todo, 20 commits + 4 final wave commits if fixes.
- Wave 1 commits can be squashed if trivial, but engine/advisor commits must be atomic.
- No commit with placeholder, no amend after push.

## Success criteria
- Docs hands-off lengkap: `docs/frd.md` >300 lines + 6 FRD per feature + Gherkin + trace TASK, `docs/design.md` journey+wireframe+3-tap, `docs/architecture.md` C4+tradeoff+scalability, `docs/decisions.md`+`TASK.md` 24 tasks trace FRD — all pass F1
- `bun run build` exit 0, `bun test` all pass, `npx playwright test` all pass
- PWA installable offline: manifest + sw.js exist, reload offline renders shell
- Expiry engine: days_to_expiry correct Asia/Jakarta, urgencyScore sorted, expiry null skipped
- Notifikasi: H-threshold per kategori triggers correctly, badge color correct
- Advisor: top-N hybrid returns suggestions with guardrail harga_tebus >= HPP*0.85, cached, offline shows cached
- Tebus Murah: manual + AI assist proposed, 1-tap approve → Promo Aktif, lifecycle correct
- Backup: encrypted export/import roundtrip restores data
- No Must NOT have built (verified F4)
