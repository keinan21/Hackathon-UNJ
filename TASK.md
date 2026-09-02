# TASK — Agentic Breakdown Hands-Off per FRD Feature

> 24 tasks hands-off yang mirror Todos 1-24 di [.omo/plans/ai-inventory-expiry-advisor.md](./.omo/plans/ai-inventory-expiry-advisor.md) verbatim. Tiap TASK traceable ke FRD, punya dependency, prompt untuk agent, QA per task, evidence path, dan commit. Eksekutor tidak perlu interview, cukup buka satu TASK dan jalan.

- **Versi:** 1.0
- **Tanggal:** 2026-08-31
- **Status:** Accepted
- **Zona waktu:** Asia/Jakarta
- **Sumber kebenaran:** [FRD 6 feature](./docs/frd.md), [CONTEXT glossary](./CONTEXT.md), [ADR-001](./docs/adr/0001-local-first-dexie-backup-drive.md), [ADR-002](./docs/adr/0002-langchain-gemini-hybrid-advisor.md), [Design UMKM 3-tap](./docs/design.md), [Architecture scalable pragmatis](./docs/architecture.md), [Plan 24 todos](./.omo/plans/ai-inventory-expiry-advisor.md), [Draft](../.omo/drafts/ai-inventory-expiry-advisor.md)
- **Verifikasi gate:** `test -f docs/decisions.md && test -f TASK.md && grep -q "ADR-001" docs/decisions.md && grep -q "TASK-01" TASK.md && grep -c "TASK-" TASK.md | awk '{exit $1<24}'`

---

## Cara Baca

- Format judul: `TASK-01 [FRD-0x]: Judul` — FRD trace di judul untuk grep cepat.
- Tiap TASK punya: Wave, Depends, Blocks, Can parallelize with, References, What to do Must NOT do, Acceptance, QA scenarios dengan tool exact, Evidence path, Commit message.
- Prompt untuk agent ada di tiap TASK: copy paste ke agent, agent punya NO interview context jadi references exhaustive.
- FRD trace cross-check di [FRD Matriks Traceability](./docs/frd.md#matriks-traceability-frd-ke-task) dan [Decisions Matriks Trace](./docs/decisions.md#matriks-trace-keputusan-ke-frd-dan-task).

---

## Matriks Trace FRD ke TASK

| FRD | Feature | Trace TASK | Judul TASK terkait | File |
|-----|---------|------------|---------------------|------|
| FRD-01 | F1 PWA Shell Offline | TASK-01, TASK-04 | 01 Init scaffold PWA, 04 PWA shell manifest SW | [frd-01-pwa.md](./docs/frd/frd-01-pwa.md) |
| FRD-02 | F2 Inventaris SKU Batch Kategori | TASK-02, TASK-05, TASK-06, TASK-07, TASK-08 | 02 Dexie schema Repository, 05 Seed threshold, 06 SKU Kategori CRUD, 07 Batch CRUD, 08 Avg Usage | [frd-02-inventaris.md](./docs/frd/frd-02-inventaris.md) |
| FRD-03 | F3 Expiry Engine Notifikasi | TASK-08, TASK-09, TASK-10, TASK-11 | 08 Avg Usage, 09 Expiry engine, 10 Notifikasi scheduler, 11 Badge urgent list | [frd-03-expiry.md](./docs/frd/frd-03-expiry.md) |
| FRD-04 | F4 Advisor Hybrid Tebus Murah | TASK-12, TASK-13, TASK-14, TASK-15, TASK-16 | 12 Pairing rule, 13 Hybrid Gemini cache guardrail, 14 Tebus manual AI assist, 15 Approve lifecycle, 16 Guardrail tests | [frd-04-tebus-murah.md](./docs/frd/frd-04-tebus-murah.md) |
| FRD-05 | F5 Dashboard Badge Histori | TASK-11, TASK-17, TASK-19 | 11 Badge urgent list, 17 Dashboard promo histori UI, 19 Threshold settings | [frd-05-dashboard.md](./docs/frd/frd-05-dashboard.md) |
| FRD-06 | F6 Backup Restore | TASK-03, TASK-18 | 03 PIN auth crypto, 18 Backup Restore Drive hook | [frd-06-backup.md](./docs/frd/frd-06-backup.md) |
| Docs | Hands-off Docs | TASK-21, TASK-22, TASK-23, TASK-24 | 21 FRD per feature, 22 Design UX, 23 Architecture, 24 Decisions plus TASK | [frd.md](./docs/frd.md) index |
| Polish | E2E Build QA | TASK-20 | 20 E2E plus build plus PWA offline QA polish | — |

> Detail per feature ada di `docs/frd/frd-0x-*.md`. Index `docs/frd.md` ringkas 80 baris untuk navigasi cepat.

---

## Dependency Matrix

| Todo TASK | Depends on | Blocks | Can parallelize with |
| --- | --- | --- | --- |
| TASK-01 | 21,22,23,24 | 2,3,4,5 | — |
| TASK-02 | 1 | 6,7,8,9,10,13,18 | 3,4 |
| TASK-03 | 1 | 18 | 2,4 |
| TASK-04 | 1 | 11,17,20 | 2,3 |
| TASK-05 | 2 | 10,11 | 3,4 |
| TASK-06 | 2 | 7,12,17 | 5 |
| TASK-07 | 6 | 8,9,10,11,12 | — |
| TASK-08 | 7 | 9 | 6 |
| TASK-09 | 7,8 | 10,11,12 | — |
| TASK-10 | 5,9 | 11 | 12,13 |
| TASK-11 | 9,10,5 | 17 | 12,13 |
| TASK-12 | 7,9 | 13 | 10,11 |
| TASK-13 | 2,9,12 | 14,15,17 | 10,11 |
| TASK-14 | 13 | 15 | 10,11,12 |
| TASK-15 | 14 | 17 | 16 |
| TASK-16 | 13,14 | 17 | 15 |
| TASK-17 | 11,15 | 20 | 18,19 |
| TASK-18 | 2,3 | 20 | 17,19 |
| TASK-19 | 5,17 | 20 | 17,18 |
| TASK-20 | 4,17,18,19 | — | — |
| TASK-21 | none | 22,23,24,1 | — |
| TASK-22 | 21 | 23,1 | 23,24 |
| TASK-23 | 21 | 24,1 | 22,24 |
| TASK-24 | 21,22,23 | 1 | — |

---

## Wave 0 — Hands-Off Docs

### TASK-21 [FRD-DOCS]: FRD hands-off per feature (`docs/frd.md`) — comprehensive

- **Wave:** 0 | **Depends:** none | **Blocks:** 22,23,24,1 | **Can parallelize:** —
- **Prompt untuk agent:** `Tulis docs/frd.md FRD breakdown per feature bukan PRD general. 6 FRD: F1 PWA Shell offline, F2 Inventaris SKU Batch Kategori, F3 Expiry Engine plus Notifikasi, F4 Advisor Hybrid plus Tebus Murah, F5 Dashboard Badge Histori, F6 Backup Restore. Tiap feature punya FRD-xxx requirements, acceptance Gherkin, trace ke TASK-yy, KPI waste -50 persen promo >30 persen, glossary CONTEXT.md. Bahasa Indonesia, 1 feature = 1 section traceable ke TASK.md. Link CONTEXT dan ADRs per feature. MUST NOT placeholder, MUST link CONTEXT dan ADRs per feature.`
- **What to do / Must NOT do:** Tulis `docs/frd.md` FRD breakdown per feature (bukan PRD general): F1 PWA Shell offline, F2 Inventaris SKU/Batch/Kategori, F3 Expiry Engine+Notifikasi, F4 Advisor Hybrid+Tebus Murah, F5 Dashboard/Badge/Histori, F6 Backup/Restore — tiap feature punya FRD-xxx: requirements, acceptance Gherkin, trace ke TASK-yy, KPI (waste -50%, promo >30%), glossary CONTEXT.md. Bahasa Indonesia, 1 feature = 1 section traceable ke TASK.md. MUST NOT placeholder, MUST link CONTEXT & ADRs per feature.
- **References:** `CONTEXT.md:1-30`, `.omo/drafts/ai-inventory-expiry-advisor.md:42-54`, `docs/adr/0001-local-first-dexie-backup-drive.md:1-15`, `docs/adr/0002-langchain-gemini-hybrid-advisor.md:1-15`
- **Acceptance:** `test -f docs/frd.md && grep -q "FRD-.*Feature" docs/frd.md && grep -q "Acceptance" docs/frd.md && grep -q "Trace.*TASK" docs/frd.md && wc -l docs/frd.md | awk '{exit $1<300}'` — >300 lines, 6 features FRD-01..06, Gherkin + trace present — pass
- **QA scenarios:** happy: `cat docs/frd.md` contains FRD-01..06 + acceptance + trace — Evidence `.omo/evidence/task-21-ai-inventory-expiry-advisor-frd.md`; failure: missing trace → grep fails — Evidence `.omo/evidence/task-21-ai-inventory-expiry-advisor-fail.log`
- **Evidence:** `.omo/evidence/task-21-ai-inventory-expiry-advisor-frd.md`
- **Commit:** `docs(frd): FRD per feature` | **FRD trace:** FRD-01..06 all features

### TASK-22 [FRD-05]: Design dan UX untuk UMKM non-tech (`docs/design.md`)

- **Wave:** 0 | **Depends:** 21 | **Blocks:** 23,1 | **Can parallelize with:** 23,24
- **Prompt untuk agent:** `Tulis docs/design.md hands-off UX untuk supervisor UMKM non-tech 35-55 tahun satu tangan sinyal lemah. Harus ada User Journey 3-tap, wireframe low-fi ASCII plus Mermaid, design token 48px dan 16px, trace ke FRD, Figma link opsional kosong. Bahasa Indonesia non-tech, kontras AA, 1-tap approve flow. Validasi max 3 tap untuk tugas utama. MUST NOT skip wireframe atau journey.`
- **What to do / Must NOT do:** Tulis `docs/design.md` hands-off UX: user journey (supervisor 3-tap: buka→lihat urgent→approve tebus), wireframe low-fi ASCII/Mermaid (dashboard, form batch, promo card), design token (font 16px+, kontras AA, bahasa Indonesia, button 48px untuk jempol), flow 1-tap approve, empty states, error handling, aksesibilitas, prototype Figma link (opsional, kosong jika belum ada), trace ke FRD feature. Validasi: max 3 tap untuk tugas utama. MUST NOT skip wireframe or journey.
- **References:** `docs/frd.md:1-80` (from 21), `CONTEXT.md:18-21`, `.omo/drafts/ai-inventory-expiry-advisor.md:46`
- **Acceptance:** `test -f docs/design.md && grep -q "User Journey" docs/design.md && grep -q "Wireframe" docs/design.md && grep -q "3-tap" docs/design.md && grep -q "Aksesibilitas" docs/design.md` — pass
- **QA scenarios:** happy: design.md has journey+wireframe+3-tap — Evidence `.omo/evidence/task-22-ai-inventory-expiry-advisor-design.md`; failure: missing wireframe → fail — Evidence `.omo/evidence/task-22-ai-inventory-expiry-advisor-fail.log`
- **Evidence:** `.omo/evidence/task-22-ai-inventory-expiry-advisor-design.md`
- **Commit:** `docs(design): UX UMKM non-tech` | **FRD trace:** FRD-05 Dashboard plus FRD-01 48px plus FRD-04 1-tap

### TASK-23 [FRD-DOCS]: Architecture scalable pragmatis (`docs/architecture.md`)

- **Wave:** 0 | **Depends:** 21 | **Blocks:** 24,1 | **Can parallelize with:** 22,24
- **Prompt untuk agent:** `Tulis docs/architecture.md hands-off C4 context plus container Mermaid, local-first Dexie plus Repository pattern, sync-ready extension no sync v1, scalability 1 ke 10 toko sharding by org_id, migration path ke Supabase 5 langkah, tradeoff table Dexie vs OPFS vs Supabase, security PIN plus PBKDF2 plus AES-GCM, performance IndexedDB limit pagination, failure modes HP hilang quota. MUST be pragmatis not gold-plating.`
- **What to do / Must NOT do:** Tulis `docs/architecture.md` hands-off: C4 diagram (context/container), local-first Dexie + Repository pattern, sync-ready extension (no sync v1), scalability 1→10 toko (sharding by org_id, migration path ke Supabase), tradeoff table (Dexie vs OPFS vs Supabase), security (PIN+PBKDF2+AES-GCM), performance (IndexedDB limit, pagination), failure modes (HP hilang, quota). MUST be pragmatis not gold-plating.
- **References:** `docs/adr/0001-local-first-dexie-backup-drive.md:1-15`, `docs/adr/0002-langchain-gemini-hybrid-advisor.md:1-15`, `CONTEXT.md:1-30`
- **Acceptance:** `test -f docs/architecture.md && grep -q "C4\|Container" docs/architecture.md && grep -q "Repository" docs/architecture.md && grep -q "Scalability" docs/architecture.md && grep -q "Tradeoff" docs/architecture.md` — pass
- **QA scenarios:** happy: architecture.md has C4+tradeoff+pragmatic scalability — Evidence `.omo/evidence/task-23-ai-inventory-expiry-advisor-arch.md`; failure: missing tradeoff section → fail — Evidence `.omo/evidence/task-23-ai-inventory-expiry-advisor-fail.log`
- **Evidence:** `.omo/evidence/task-23-ai-inventory-expiry-advisor-arch.md`
- **Commit:** `docs(architecture): scalable pragmatis` | **FRD trace:** FRD-01..06 architecture cross-cutting

### TASK-24 [FRD-DOCS]: Decisions log + TASK agentic (`docs/decisions.md` + `TASK.md`)

- **Wave:** 0 | **Depends:** 21,22,23 | **Blocks:** 1 | **Can parallelize with:** —
- **Prompt untuk agent:** `Tulis docs/decisions.md kumpulan ADR-001 002 plus log keputusan Q1-Q13 dengan rationale dan TASK.md agentic breakdown hands-off per FRD feature 24 tasks dengan mapping FRD-xxx ke TASK-yy dependency prompt untuk agent QA per task evidence path commit. TASK.md must mirror Todos 1-24 verbatim dengan format TASK-01 [FRD-02]: ... | Depends | QA | Evidence. MUST NOT diverge dari plan Todos atau FRD. Collect Q1-Q13 dari draft dengan rationale Q1 perishable Q2 single toko dll. Reference frd.md:1-100 untuk trace.`
- **What to do / Must NOT do:** Tulis `docs/decisions.md` (kumpulan ADR-001/002 + log keputusan Q1-Q13 dengan rationale) dan `TASK.md` (agentic breakdown hands-off per FRD feature: 24 tasks dengan mapping FRD-xxx→TASK-yy, dependency, prompt untuk agent, QA per task, evidence path, commit). TASK.md must mirror Todos 1-24 verbatim dengan format `TASK-01 [FRD-02]: ... | Depends | QA | Evidence`. MUST NOT diverge dari plan Todos atau FRD.
- **References:** `docs/adr/0001-local-first-dexie-backup-drive.md:1-15`, `docs/adr/0002-langchain-gemini-hybrid-advisor.md:1-15`, `.omo/drafts/ai-inventory-expiry-advisor.md:36-54`, `.omo/plans/ai-inventory-expiry-advisor.md:84-243`, `docs/frd.md:1-100` (from 21)
- **Acceptance:** `test -f docs/decisions.md && test -f TASK.md && grep -q "ADR-001" docs/decisions.md && grep -q "TASK-01" TASK.md && grep -c "TASK-" TASK.md | awk '{exit $1<24}'` — both exist, 24 tasks — pass
- **QA scenarios:** happy: decisions+tasks complete 24 — Evidence `.omo/evidence/task-24-ai-inventory-expiry-advisor-tasks.md`; failure: TASK count <24 → fail — Evidence `.omo/evidence/task-24-ai-inventory-expiry-advisor-fail.log`
- **Evidence:** `.omo/evidence/task-24-ai-inventory-expiry-advisor-tasks.md`
- **Commit:** `docs(decisions-tasks): log + agentic TASK` | **FRD trace:** FRD-DOCS all plus ADR-001, ADR-002

---

## Wave 1 — Foundation

### TASK-01 [FRD-01]: Init Vite+React+TS scaffold + PWA tooling + project structure (GATE: Wave 0 docs must exist)

- **Wave:** 1 | **Depends:** 21,22,23,24 | **Blocks:** 2,3,4,5 | **Can parallelize with:** —
- **Prompt untuk agent:** `Init Vite React TS scaffold. GATE check test -f docs/frd.md dan design.md dan architecture.md dan decisions.md dan TASK.md must pass before npm create vite. Then add dexie, vite-plugin-pwa, fake-indexeddb, vitest, playwright, langchain, @google/generative-ai. Create src/db src/engine src/advisor src/features public/icons. Config vite.config.ts PWA minimal. MUST NOT create backend server Supabase OCR deps.`
- **What to do / Must NOT do:** GATE check `test -f docs/frd.md && test -f docs/design.md && test -f docs/architecture.md && test -f docs/decisions.md && test -f TASK.md` must pass before `npm create vite@latest`; then add `dexie`, `vite-plugin-pwa`, `fake-indexeddb`, `vitest`, `playwright`, `langchain`, `@google/generative-ai`; create `src/db/`, `src/engine/`, `src/advisor/`, `src/features/`, `src/lib/`, `public/icons/`; config `vite.config.ts` PWA minimal; HUSKY/lint optional. MUST NOT create backend/server, Supabase, OCR deps.
- **References:** `docs/adr/0001-local-first-dexie-backup-drive.md:5-14`, `docs/adr/0002-langchain-gemini-hybrid-advisor.md:5-9`, `.omo/drafts/ai-inventory-expiry-advisor.md:32`, `CONTEXT.md:1-10`, `docs/frd.md:1-20` (future artifact — created by 21), `docs/design.md:1-20` (future artifact — created by 22)
- **Acceptance:** `bun install && bun run build` exit 0 && `test -f dist/manifest.webmanifest && test -f dist/sw.js && grep -q "dexie" package.json && grep -q "vite-plugin-pwa" vite.config.ts`
- **QA scenarios:** happy: `bun test` Vitest empty suite passes + `bun run build` produces manifest/sw — Evidence `.omo/evidence/task-1-ai-inventory-expiry-advisor.log`; failure: missing PWA plugin → build still passes but sw.js absent → test fails on file check — Evidence `.omo/evidence/task-1-ai-inventory-expiry-advisor-fail.log`
- **Evidence:** `.omo/evidence/task-1-ai-inventory-expiry-advisor.log`
- **Commit:** `chore(scaffold): init Vite React Dexie PWA structure` | **FRD trace:** FRD-01 F1 PWA Shell Offline

### TASK-02 [FRD-02]: Dexie DB schema + InventoryRepository interface + migrations (sync-ready org_id)

- **Wave:** 1 | **Depends:** 1 | **Blocks:** 6,7,8,9,10,13,18 | **Can parallelize with:** 3,4
- **Prompt untuk agent:** `Create src/db/db.ts Dexie dengan tables skus kategoris batches transaksis promos advisorCache. Add org_id column default toko-01 indexed on skus batches reserved untuk 1 ke 10 sharding comment sync-ready sharding. Define InventoryRepository interface methods CRUD per entity. Dexie impl DexieRepository. Handle expiry null non-perishable skip index expiry_date sku_id kategori_id org_id. MUST NOT add cloud sync logic v1 keep org_id default single value.`
- **What to do / Must NOT do:** Create `src/db/db.ts` Dexie with tables `skus`, `kategoris`, `batches`, `transaksis`, `promos`, `advisorCache`; add `org_id` column default `toko-01` indexed on skus/batches (reserved for 1→10 sharding, comment `// sync-ready sharding`), define `InventoryRepository` interface (methods CRUD per entity); Dexie impl `DexieRepository`; handle expiry null (non-perishable skip), index `expiry_date`, `sku_id`, `kategori_id`, `org_id`. MUST NOT add cloud sync logic v1, keep org_id default single value.
- **References:** `docs/adr/0001-local-first-dexie-backup-drive.md:5-14`, `CONTEXT.md:8-15`, `.omo/drafts/ai-inventory-expiry-advisor.md:42-44`
- **Acceptance:** `bun test src/db/db.test.ts` — create SKU+Batch with expiry, query by sku_id returns N, batch expiry null not indexed for engine, repository interface has methods for each entity — all pass
- **QA scenarios:** happy: `bun test src/db/db.test.ts --reporter=verbose` insert 3 batches diff expiry → query sorted → Evidence `.omo/evidence/task-2-ai-inventory-expiry-advisor.json`; failure: try insert Batch without sku_id → Dexie bulkError → test asserts reject — Evidence `.omo/evidence/task-2-ai-inventory-expiry-advisor-fail.json`
- **Evidence:** `.omo/evidence/task-2-ai-inventory-expiry-advisor.json`
- **Commit:** `feat(db): Dexie schema + InventoryRepository` | **FRD trace:** FRD-02 F2 Inventaris SKU Batch Kategori

### TASK-03 [FRD-06]: Supervisor PIN auth + encrypted API key storage (single device)

- **Wave:** 1 | **Depends:** 1 | **Blocks:** 18 | **Can parallelize with:** 2,4
- **Prompt untuk agent:** `Create src/features/auth/pinStore.ts plus src/lib/crypto.ts PBKDF2 derive AES-GCM optional untuk key. PIN hash via bcrypt atau subtle stored di Dexie settings. API key Gemini encrypted via PIN-derived key di localStorage. Single supervisor no roles. MUST NOT implement multi-role lockout escalation beyond simple fail count.`
- **What to do / Must NOT do:** Create `src/features/auth/pinStore.ts` + `src/lib/crypto.ts` (PBKDF2 derive, AES-GCM optional for key); PIN hash via bcrypt/subtle, stored in Dexie `settings`; API key (Gemini) encrypted via PIN-derived key in localStorage; single supervisor, no roles. MUST NOT implement multi-role, lockout escalation beyond simple fail count.
- **References:** `CONTEXT.md:19`, `docs/adr/0001-local-first-dexie-backup-drive.md:9-14`, `docs/adr/0002-langchain-gemini-hybrid-advisor.md:9`, `.omo/drafts/ai-inventory-expiry-advisor.md:39`
- **Acceptance:** `bun test src/features/auth/pinStore.test.ts` — set PIN "1234" → verify true, wrong "0000" false, API key roundtrip encrypt/decrypt succeeds, no plaintext key in Dexie — pass
- **QA scenarios:** happy: set→verify→store key→retrieve decrypt — Evidence `.omo/evidence/task-3-ai-inventory-expiry-advisor.json`; failure: wrong PIN decrypt fails → assert null/error — Evidence `.omo/evidence/task-3-ai-inventory-expiry-advisor-fail.json`
- **Evidence:** `.omo/evidence/task-3-ai-inventory-expiry-advisor.json`
- **Commit:** `feat(auth): supervisor PIN + encrypted API key` | **FRD trace:** FRD-06 F6 Backup Restore plus FRD-01 single device

### TASK-04 [FRD-01]: PWA shell + manifest + Service Worker offline cache

- **Wave:** 1 | **Depends:** 1 | **Blocks:** 11,17,20 | **Can parallelize with:** 2,3
- **Prompt untuk agent:** `Config vite-plugin-pwa dengan manifest name icons display standalone themeColor Workbox runtime cache untuk app shell dan Dexie tidak needed. Offline fallback page. Install prompt hook. MUST NOT add server cloud. Ikuti design.md PWA install UX.`
- **What to do / Must NOT do:** Config `vite-plugin-pwa` with manifest (name, icons, display standalone, themeColor), Workbox runtime cache for app shell & Dexie not needed; offline fallback page; install prompt hook. MUST NOT add server, cloud.
- **References:** `docs/adr/0001-local-first-dexie-backup-drive.md:5-14`, `CONTEXT.md:20-21`, `.omo/drafts/ai-inventory-expiry-advisor.md:46`, `docs/design.md:1-30` (future artifact — created by 22, for PWA install UX)
- **Acceptance:** `bun run build && npx playwright test e2e/pwa.spec.ts` — manifest contains name/icons, sw.js exists, page loads offline via `page.route` fallback — pass
- **QA scenarios:** happy: playwright offline emulation → reload still renders shell — Evidence `.omo/evidence/task-4-ai-inventory-expiry-advisor.png`; failure: missing icon → manifest validation fails — Evidence `.omo/evidence/task-4-ai-inventory-expiry-advisor-fail.log`
- **Evidence:** `.omo/evidence/task-4-ai-inventory-expiry-advisor.png`
- **Commit:** `feat(pwa): manifest + SW offline shell` | **FRD trace:** FRD-01 F1 PWA Shell Offline

### TASK-05 [FRD-02]: Seed kategori + threshold config (generic [7,3,1] editable)

- **Wave:** 1 | **Depends:** 2 | **Blocks:** 10,11 | **Can parallelize with:** 3,4
- **Prompt untuk agent:** `Create src/db/seed.ts seed 3 kategori Dairy Snack Beras dengan threshold_h_minus [7,3,1] default editable allow supervisor edit via updateKategoriThreshold validate non-empty descending lebih dari 0 no dup. Resolve C-02 generik [7,3,1] is truth seed example values adalah overrides editable. MUST NOT hardcode non-editable.`
- **What to do / Must NOT do:** Create `src/db/seed.ts` seed 3 kategori (Dairy, Snack, Beras) with threshold_h_minus [7,3,1] default (editable), allow supervisor edit via `updateKategoriThreshold`; validate non-empty, descending, >0, no dup. Resolve C-02: generik [7,3,1] is truth, seed example values are overrides editable. MUST NOT hardcode non-editable.
- **References:** `CONTEXT.md:10-11`, `CONTEXT.md:20`, `.omo/drafts/ai-inventory-expiry-advisor.md:25`, `docs/adr/0001-local-first-dexie-backup-drive.md:5`
- **Acceptance:** `bun test src/db/seed.test.ts` — seed creates 3 kategori, each threshold [7,3,1], edit to [14,7,3] succeeds, edit to [3,3,1] rejects duplicate, edit to [] rejects — pass
- **QA scenarios:** happy: seed→query kategori→threshold [7,3,1] — Evidence `.omo/evidence/task-5-ai-inventory-expiry-advisor.json`; failure: threshold [1,7,3] not descending → validation error — Evidence `.omo/evidence/task-5-ai-inventory-expiry-advisor-fail.json`
- **Evidence:** `.omo/evidence/task-5-ai-inventory-expiry-advisor.json`
- **Commit:** `feat(kategori): seed threshold editable` | **FRD trace:** FRD-02 F2 plus FRD-03 threshold per kategori

---

## Wave 2 — Core Inventaris + Engine

### TASK-06 [FRD-02]: SKU dan Kategori CRUD + validation (HPP/harga)

- **Wave:** 2 | **Depends:** 2 | **Blocks:** 7,12,17 | **Can parallelize with:** 5
- **Prompt untuk agent:** `Create src/features/sku/skuService.ts plus Kategori CRUD UI. SKU fields nama kategori_id hpp harga_normal barcode opsional. Validate hpp lebih dari 0 harga_normal lebih sama dengan hpp warn jika tidak nama non-empty. MUST NOT store expiry di SKU.`
- **What to do / Must NOT do:** `src/features/sku/skuService.ts` + Kategori CRUD UI; SKU fields nama, kategori_id, hpp, harga_normal, barcode optional; validate hpp>0, harga_normal>=hpp (warn if not), nama non-empty. MUST NOT store expiry in SKU.
- **References:** `CONTEXT.md:8`, `CONTEXT.md:24-26`, `.omo/drafts/ai-inventory-expiry-advisor.md:43`
- **Acceptance:** `bun test src/features/sku/skuService.test.ts` — create SKU Dairy valid passes, create SKU with hpp<=0 rejects, create SKU with expiry field rejects (schema), kategori required — pass
- **QA scenarios:** happy: create SKU → list → edit harga — Evidence `.omo/evidence/task-6-ai-inventory-expiry-advisor.json`; failure: hpp>harga_normal → warn but allow or reject per guard — Evidence `.omo/evidence/task-6-ai-inventory-expiry-advisor-fail.json`
- **Evidence:** `.omo/evidence/task-6-ai-inventory-expiry-advisor.json`
- **Commit:** `feat(sku): SKU Kategori CRUD` | **FRD trace:** FRD-02 F2 Inventaris SKU Batch Kategori

### TASK-07 [FRD-02]: Batch/Lot CRUD (qty, expiry_date, HPP snapshot)

- **Wave:** 2 | **Depends:** 6 | **Blocks:** 8,9,10,11,12 | **Can parallelize with:** —
- **Prompt untuk agent:** `Create src/features/batch/batchService.ts CRUD batch per SKU qty lebih dari 0 expiry_date nullable null sama dengan non-perishable skip engine received_at auto now hpp_snapshot copy dari SKU saat receive time. List batches per SKU sorted expiry asc. MUST NOT store expiry di SKU MUST handle null correctly.`
- **What to do / Must NOT do:** `src/features/batch/batchService.ts` CRUD batch per SKU: qty>0, expiry_date nullable (null=non-perishable skip engine), received_at auto now, hpp_snapshot copy from SKU at receive time; list batches per SKU sorted expiry asc. MUST NOT store expiry in SKU, MUST handle null correctly.
- **References:** `CONTEXT.md:9`, `CONTEXT.md:12`, `CONTEXT.md:24`, `.omo/drafts/ai-inventory-expiry-advisor.md:43`
- **Acceptance:** `bun test src/features/batch/batchService.test.ts` — create batch qty 10 expiry 2026-09-05 passes, create batch expiry null passes but not returned by engine query, qty 0 rejects — pass
- **QA scenarios:** happy: create SKU → 3 batches diff expiry → list sorted — Evidence `.omo/evidence/task-7-ai-inventory-expiry-advisor.json`; failure: expiry in past allowed warn but not reject — Evidence `.omo/evidence/task-7-ai-inventory-expiry-advisor-fail.json`
- **Evidence:** `.omo/evidence/task-7-ai-inventory-expiry-advisor.json`
- **Commit:** `feat(batch): Batch Lot CRUD` | **FRD trace:** FRD-02 F2 plus FRD-03 engine input

### TASK-08 [FRD-03]: Avg Daily Usage calculator + histori transaksi model

- **Wave:** 2 | **Depends:** 7 | **Blocks:** 9 | **Can parallelize with:** 6
- **Prompt untuk agent:** `Create src/engine/avgUsage.ts plus transaksis table sku_id qty_sold sold_at. Avg sama dengan total qty_sold per days_with_history over last 14d atau 30d jika no data fallback manual input jika kurang dari 14 hari data store per SKU. MUST NOT hallucinate usage.`
- **What to do / Must NOT do:** `src/engine/avgUsage.ts` + `transaksis` table (sku_id, qty_sold, sold_at); avg = total_qty_sold / days_with_history over last 14d (or 30d if no data), fallback manual input if <14 hari data; store per SKU. MUST NOT hallucinate usage.
- **References:** `CONTEXT.md:14-15`, `.omo/drafts/ai-inventory-expiry-advisor.md:27`
- **Acceptance:** `bun test src/engine/avgUsage.test.ts` — 10 hari histori 20 qty sold → avg 2, <14 hari fallback manual 1.5 used, ceil days logic Asia/Jakarta — pass
- **QA scenarios:** happy: insert 14d transaksis → calc avg 2.3 — Evidence `.omo/evidence/task-8-ai-inventory-expiry-advisor.json`; failure: no histori → returns manual fallback, not NaN — Evidence `.omo/evidence/task-8-ai-inventory-expiry-advisor-fail.json`
- **Evidence:** `.omo/evidence/task-8-ai-inventory-expiry-advisor.json`
- **Commit:** `feat(engine): avg daily usage` | **FRD trace:** FRD-02 fallback plus FRD-03 urgency input

### TASK-09 [FRD-03]: Expiry engine: days_to_expiry + urgencyScore deterministik

- **Wave:** 2 | **Depends:** 7,8 | **Blocks:** 10,11,12 | **Can parallelize with:** —
- **Prompt untuk agent:** `Create src/engine/expiry.ts functions daysToExpiry expiry_date string today Asia Jakarta startOfDay menggunakan date-fns-tz atau Intl DateTimeFormat dengan timeZone Asia Jakarta plus ceil urgencyScore qty days avg sama dengan qty kali days per max avg 1 lower lebih negative sama dengan more urgent sorting helper skip expiry null. MUST NOT let LLM compute MUST use local TZ Asia Jakarta not UTC.`
- **What to do / Must NOT do:** `src/engine/expiry.ts` functions `daysToExpiry(expiry_date: string, today=Asia/Jakarta startOfDay)` using `date-fns-tz` or `Intl.DateTimeFormat` with `timeZone: 'Asia/Jakarta'` + ceil, `urgencyScore(qty, days, avg)` = qty*days / max(avg,1) → lower/more negative = more urgent, sorting helper, skip expiry null. MUST NOT let LLM compute, MUST use local TZ Asia/Jakarta (not UTC).
- **References:** `CONTEXT.md:12-15`, `CONTEXT.md:26`, `docs/adr/0002-langchain-gemini-hybrid-advisor.md:7`
- **Acceptance:** `bun test src/engine/expiry.test.ts` — daysToExpiry 2026-09-05 from 2026-09-02 =3, expiry null returns null, urgencyScore 10*3/2=15, negative days -2 → -10, sort urgent first — pass
- **QA scenarios:** happy: 5 batches sorted by urgency — Evidence `.omo/evidence/task-9-ai-inventory-expiry-advisor.json`; failure: avg 0 → divisor 1 not Infinity — Evidence `.omo/evidence/task-9-ai-inventory-expiry-advisor-fail.json`
- **Evidence:** `.omo/evidence/task-9-ai-inventory-expiry-advisor.json`
- **Commit:** `feat(engine): expiry urgencyScore` | **FRD trace:** FRD-03 F3 Expiry Engine dan Notifikasi

### TASK-10 [FRD-03]: Notifikasi scheduler (daily 07:00 + threshold per kategori)

- **Wave:** 2 | **Depends:** 5,9 | **Blocks:** 11 | **Can parallelize with:** 12,13
- **Prompt untuk agent:** `Create src/engine/notifScheduler.ts plus SW src/sw/notif.ts daily check 07:00 Asia Jakarta setInterval plus on app open query batches where days_to_expiry in threshold_h_minus request Notification permission show push plus badge count WA hook stub no send log only. Resolve C-04 daily 07:00 plus on-demand. MUST NOT implement WA send eskalasi.`
- **What to do / Must NOT do:** `src/engine/notifScheduler.ts` + SW `src/sw/notif.ts` — daily check 07:00 Asia/Jakarta (setInterval + on app open), query batches where days_to_expiry in threshold_h_minus, request Notification permission, show push + badge count; WA hook stub (no send) log only. Resolve C-04: daily 07:00 + on-demand. MUST NOT implement WA send, eskalasi.
- **References:** `CONTEXT.md:20-21`, `docs/adr/0002-langchain-gemini-hybrid-advisor.md:8`, `.omo/drafts/ai-inventory-expiry-advisor.md:44`
- **Acceptance:** `bun test src/engine/notifScheduler.test.ts` — mock today 2026-09-02, batch H-3 in Dairy threshold [7,3,1] triggers, batch H-10 not trigger, expiry null not trigger — pass
- **QA scenarios:** happy: batch H-3 → scheduler returns 1 notif with sku name — Evidence `.omo/evidence/task-10-ai-inventory-expiry-advisor.json`; failure: permission denied → fallback badge only no throw — Evidence `.omo/evidence/task-10-ai-inventory-expiry-advisor-fail.json`
- **Evidence:** `.omo/evidence/task-10-ai-inventory-expiry-advisor.json`
- **Commit:** `feat(notif): scheduler threshold` | **FRD trace:** FRD-03 F3 threshold per kategori

### TASK-11 [FRD-05]: Badge dan urgent dashboard list (UX UMKM 48px, 3-tap)

- **Wave:** 2 | **Depends:** 9,10,5 | **Blocks:** 17 | **Can parallelize with:** 12,13
- **Prompt untuk agent:** `Create src/features/dashboard/UrgentList.tsx plus badge component src/components/Badge.tsx list urgent batches sorted urgency filter by kategori badge count per SKU sum qty urgent color by H red H kurang sama 1 orange H kurang sama 3 yellow H kurang sama 7 button min 48px height bahasa Indonesia labels data dari Dexie via Repository. MUST enforce design.md tokens.`
- **What to do / Must NOT do:** `src/features/dashboard/UrgentList.tsx` + badge component `src/components/Badge.tsx` — list urgent batches sorted urgency, filter by kategori, badge count per SKU (sum qty urgent), color by H (red H<=1, orange H<=3, yellow H<=7), button min 48px height, bahasa Indonesia labels; data from Dexie via Repository. MUST enforce design.md tokens.
- **References:** `CONTEXT.md:20`, `.omo/drafts/ai-inventory-expiry-advisor.md:46`, `docs/design.md:1-40` (future artifact — created by 22, 48px + bahasa Indonesia)
- **Acceptance:** `npx playwright test e2e/badge.spec.ts` — seed 3 batches H-1/H-3/H-10 → dashboard shows 2 urgent (H-1 red, H-3 orange), H-10 hidden, badge count matches && `expect(page.locator('button').first()).toHaveCSS('min-height','48px')` — pass
- **QA scenarios:** happy: playwright urgent list sorted — Evidence `.omo/evidence/task-11-ai-inventory-expiry-advisor.png`; failure: expiry null batch shows no badge — Evidence `.omo/evidence/task-11-ai-inventory-expiry-advisor-fail.png`
- **Evidence:** `.omo/evidence/task-11-ai-inventory-expiry-advisor.png`
- **Commit:** `feat(dashboard): urgent list badge` | **FRD trace:** FRD-03 badge plus FRD-05 F5 Dashboard Badge Histori

---

## Wave 3 — Advisor Tebus Murah

### TASK-12 [FRD-04]: Pairing rule engine (co-occurrence + kategori fallback)

- **Wave:** 3 | **Depends:** 7,9 | **Blocks:** 13 | **Can parallelize with:** 10,11
- **Prompt untuk agent:** `Create src/advisor/pairing.ts dari transaksis build co-occurrence map sku A often bought dengan B untuk urgent batch SKU find top pairing SKU yang laku avg usage high not urgent fallback ke kategori pairing manual Roti ke Susu. No LLM di sini.`
- **What to do / Must NOT do:** `src/advisor/pairing.ts` — from `transaksis`, build co-occurrence map (sku A often bought with B), for urgent batch's SKU find top pairing SKU yang laku (avg usage high, not urgent), fallback to kategori pairing manual (Roti→Susu). No LLM here.
- **References:** `docs/adr/0002-langchain-gemini-hybrid-advisor.md:6`, `CONTEXT.md:17`
- **Acceptance:** `bun test src/advisor/pairing.test.ts` — histori Roti+Susu 5x → pairing for Susu returns Roti, no histori → fallback kategori returns configured pasangan — pass
- **QA scenarios:** happy: pairing found — Evidence `.omo/evidence/task-12-ai-inventory-expiry-advisor.json`; failure: urgent SKU has no pairing → returns null not error, LLM will handle wording — Evidence `.omo/evidence/task-12-ai-inventory-expiry-advisor-fail.json`
- **Evidence:** `.omo/evidence/task-12-ai-inventory-expiry-advisor.json`
- **Commit:** `feat(advisor): pairing engine` | **FRD trace:** FRD-04 F4 Advisor Hybrid dan Tebus Murah

### TASK-13 [FRD-04]: LangChain+Gemini hybrid advisor service + cache + guardrail

- **Wave:** 3 | **Depends:** 2,9,12 | **Blocks:** 14,15,17 | **Can parallelize with:** 10,11
- **Prompt untuk agent:** `Create src/advisor/AdvisorPort.ts interface plus src/advisor/LangChainGeminiAdvisor.ts LLM only untuk top-N urgent prompt includes SKU batch qty days_to_expiry pasangan HPP harga_normal angka dari DB guardrail floor HPP kali 0.85 enforced before LLM LLM dilarang ngarang angka angka from DB cache result di advisorCache Dexie dengan TTL 24h mock untuk tests trigger daily 07:05 plus on-demand after batch insert urgent. Resolve C-06 M-05 M-09.`
- **What to do / Must NOT do:** `src/advisor/AdvisorPort.ts` interface + `src/advisor/LangChainGeminiAdvisor.ts` (LLM only for top-N urgent), prompt includes SKU, batch qty, days_to_expiry, pasangan, HPP/harga_normal (angka dari DB), guardrail floor HPP*0.85 enforced before LLM (LLM dilarang ngarang angka, angka from DB), cache result in `advisorCache` Dexie with TTL 24h; mock for tests; trigger daily 07:05 + on-demand after batch insert urgent. Resolve C-06, M-05, M-09.
- **References:** `docs/adr/0002-langchain-gemini-hybrid-advisor.md:5-9`, `CONTEXT.md:16-17`, `CONTEXT.md:26`, `.omo/drafts/ai-inventory-expiry-advisor.md:45`
- **Acceptance:** `bun test src/advisor/geminiAdvisor.test.ts` — mock urgent batch → advisor returns {aksi, alasan, pasangan, harga_tebus >=HPP*0.85}, cache hit second call no LLM, failure: harga_tebus 0.84*HPP rejects — pass
- **QA scenarios:** happy: top-N 3 urgent → 3 suggestions cached — Evidence `.omo/evidence/task-13-ai-inventory-expiry-advisor.json`; failure: offline → returns cached stale, not throw — Evidence `.omo/evidence/task-13-ai-inventory-expiry-advisor-fail.json`
- **Evidence:** `.omo/evidence/task-13-ai-inventory-expiry-advisor.json`
- **Commit:** `feat(advisor): LangChain Gemini hybrid` | **FRD trace:** FRD-04 F4 hybrid plus FRD-03 urgency input

### TASK-14 [FRD-04]: Tebus Murah template manual + AI assist flow (proposed)

- **Wave:** 3 | **Depends:** 13 | **Blocks:** 15 | **Can parallelize with:** 10,11,12
- **Prompt untuk agent:** `Create src/features/promo/promoService.ts plus UI TebusForm.tsx create promo proposed choose urgent batch pasangan SKU dari pairing atau manual harga_tebus input validasi floor HPP kali 0.85 template manual vs AI assist prefill dari advisor status proposed. MUST NOT auto-activate.`
- **What to do / Must NOT do:** `src/features/promo/promoService.ts` + UI `TebusForm.tsx` — create promo proposed: choose urgent batch, pasangan SKU (from pairing or manual), harga_tebus input, validasi floor HPP*0.85, template manual vs AI assist (prefill from advisor), status proposed. MUST NOT auto-activate.
- **References:** `CONTEXT.md:17-18`, `.omo/drafts/ai-inventory-expiry-advisor.md:45`
- **Acceptance:** `bun test src/features/promo/promoService.test.ts` — create manual promo valid passes, create with harga_tebus 0.84*HPP rejects with error "below HPP*0.85", AI prefill sets harga_tebus — pass
- **QA scenarios:** happy: AI assist fills form → submit proposed — Evidence `.omo/evidence/task-14-ai-inventory-expiry-advisor.json`; failure: harga_tebus > harga_normal → warn/reject — Evidence `.omo/evidence/task-14-ai-inventory-expiry-advisor-fail.json`
- **Evidence:** `.omo/evidence/task-14-ai-inventory-expiry-advisor.json`
- **Commit:** `feat(promo): tebus murah proposed` | **FRD trace:** FRD-04 F4 Tebus Murah proposed

### TASK-15 [FRD-04]: 1-tap Approve proposed→active + Promo Aktif lifecycle (UX 1-tap, 3-tap flow)

- **Wave:** 3 | **Depends:** 14 | **Blocks:** 17 | **Can parallelize with:** 16
- **Prompt untuk agent:** `Create src/features/promo/approve.ts plus PromoAktifList.tsx approve button 48px 1-tap supervisor ke status active tampil di dashboard dan badge SKU lifecycle active ke expired after expiry atau consumed qty 0 via daily check ensure flow buka lihat approve kurang sama dengan 3 taps list promo aktif query. MUST NOT add POS auto MUST bahasa Indonesia.`
- **What to do / Must NOT do:** `src/features/promo/approve.ts` + `PromoAktifList.tsx` — approve button 48px, 1-tap supervisor → status active, tampil di dashboard & badge SKU; lifecycle active→expired (after expiry) or consumed (qty 0) via daily check; ensure flow buka→lihat→approve ≤3 taps; list promo aktif query. MUST NOT add POS auto, MUST bahasa Indonesia.
- **References:** `CONTEXT.md:18`, `.omo/drafts/ai-inventory-expiry-advisor.md:45`, `docs/design.md:1-40` (future artifact — created by 22, 3-tap + 48px)
- **Acceptance:** `npx playwright test e2e/promo-approve.spec.ts` — propose → approve (1 tap) → appears in Promo Aktif list with badge, expired auto moves to expired && button height 48px && `e2e/3tap.spec.ts` counts ≤3 navigations — pass
- **QA scenarios:** happy: approved promo visible — Evidence `.omo/evidence/task-15-ai-inventory-expiry-advisor.png`; failure: non-supervisor cannot approve (blocked by PIN check) — Evidence `.omo/evidence/task-15-ai-inventory-expiry-advisor-fail.png`
- **Evidence:** `.omo/evidence/task-15-ai-inventory-expiry-advisor.png`
- **Commit:** `feat(promo): approve lifecycle` | **FRD trace:** FRD-04 F4 approve plus FRD-05 dashboard promo

### TASK-16 [FRD-04]: Guardrail dan validation tests (HPP, harga, LLM angka)

- **Wave:** 3 | **Depends:** 13,14 | **Blocks:** 17 | **Can parallelize with:** 15
- **Prompt untuk agent:** `Create src/advisor/guardrail.test.ts comprehensive plus src/lib/validation.ts property tests harga_tebus lebih sama dengan HPP kali 0.85 floor optional ceiling harga_normal kali 0.5 jika enabled configurable HPP lebih dari 0 harga_tebus not NaN LLM output must not contain angka harga jika not dari DB mock check. This todo is pure test hardening untuk C-03 M-09.`
- **What to do / Must NOT do:** `src/advisor/guardrail.test.ts` comprehensive + `src/lib/validation.ts` — property tests: harga_tebus >= HPP*0.85 floor, optional ceiling harga_normal*0.5 if enabled (configurable), HPP>0, harga_tebus not NaN, LLM output must not contain angka harga if not from DB (mock check). This todo is pure test hardening for C-03/M-09.
- **References:** `CONTEXT.md:17`, `CONTEXT.md:26`, `docs/adr/0002-langchain-gemini-hybrid-advisor.md:7`, `.omo/drafts/ai-inventory-expiry-advisor.md:29`
- **Acceptance:** `bun test src/advisor/guardrail.test.ts` — all 4 guard cases pass, LLM mock that tries to ngarang harga fails — pass
- **QA scenarios:** happy: floor pass at 0.85 — Evidence `.omo/evidence/task-16-ai-inventory-expiry-advisor.log`; failure: floor fail at 0.84 → throws — Evidence `.omo/evidence/task-16-ai-inventory-expiry-advisor-fail.log`
- **Evidence:** `.omo/evidence/task-16-ai-inventory-expiry-advisor.log`
- **Commit:** `test(guardrail): tebus murah bounds` | **FRD trace:** FRD-04 F4 guardrail plus FRD-06 HPP bounds

---

## Wave 4 — Dashboard/Backup/Polish

### TASK-17 [FRD-05]: Dashboard Promo Aktif + histori saran UI (UX UMKM)

- **Wave:** 4 | **Depends:** 11,15 | **Blocks:** 20 | **Can parallelize with:** 18,19
- **Prompt untuk agent:** `Create src/features/dashboard/DashboardPage.tsx sections urgent list dari 11 promo aktif cards dari 15 histori advisorCache dengan timestamp badge per SKU responsive PWA font 16px plus bahasa Indonesia button 48px card layout sesuai design.md wireframe.`
- **What to do / Must NOT do:** `src/features/dashboard/DashboardPage.tsx` — sections: urgent list (from 11), promo aktif cards (from 15), histori advisorCache with timestamp, badge per SKU; responsive PWA, font 16px+, bahasa Indonesia, button 48px; card layout sesuai design.md wireframe.
- **References:** `CONTEXT.md:18`, `.omo/drafts/ai-inventory-expiry-advisor.md:46`, `docs/design.md:1-40` (future artifact — created by 22, wireframe + 16px + 48px)
- **Acceptance:** `npx playwright test e2e/dashboard.spec.ts` — dashboard shows 3 sections, promo card contains "Tebus Murah" + harga_tebus, histori last 5, font size >=16px — pass
- **QA scenarios:** happy: dashboard full — Evidence `.omo/evidence/task-17-ai-inventory-expiry-advisor.png`; failure: no promo → empty state "Belum ada promo" — Evidence `.omo/evidence/task-17-ai-inventory-expiry-advisor-fail.png`
- **Evidence:** `.omo/evidence/task-17-ai-inventory-expiry-advisor.png`
- **Commit:** `feat(dashboard): promo histori UI` | **FRD trace:** FRD-05 F5 Dashboard Badge Histori

### TASK-18 [FRD-06]: Backup/Restore JSON terenkripsi + Drive hook

- **Wave:** 4 | **Depends:** 2,3 | **Blocks:** 20 | **Can parallelize with:** 17,19
- **Prompt untuk agent:** `Create src/features/backup/backupService.ts export all Dexie tables ke JSON encrypt AES-GCM-256 key sama dengan PBKDF2 PIN salt random 16b 100k iter download file import decrypt restore Drive hook stub window.showPicker jika available else manual upload instruction. Resolve M-06.`
- **What to do / Must NOT do:** `src/features/backup/backupService.ts` — export all Dexie tables to JSON, encrypt AES-GCM-256 key=PBKDF2(PIN, salt random 16b, 100k iter), download file; import decrypt & restore; Drive hook stub (window.showPicker if available else manual upload instruction). Resolve M-06.
- **References:** `docs/adr/0001-local-first-dexie-backup-drive.md:5`, `.omo/drafts/ai-inventory-expiry-advisor.md:47`
- **Acceptance:** `bun test src/features/backup/backupService.test.ts` — export → import roundtrip restores SKU/Batch count, wrong PIN decrypt fails, unencrypted flag deferred not used — pass
- **QA scenarios:** happy: backup→clear→restore → data back — Evidence `.omo/evidence/task-18-ai-inventory-expiry-advisor.json`; failure: corrupt JSON → error not crash — Evidence `.omo/evidence/task-18-ai-inventory-expiry-advisor-fail.json`
- **Evidence:** `.omo/evidence/task-18-ai-inventory-expiry-advisor.json`
- **Commit:** `feat(backup): encrypted export restore` | **FRD trace:** FRD-06 F6 Backup dan Restore

### TASK-19 [FRD-05]: Threshold settings page + HPP/margin config (UX UMKM)

- **Wave:** 4 | **Depends:** 5,17 | **Blocks:** 20 | **Can parallelize with:** 17,18
- **Prompt untuk agent:** `Create src/features/settings/SettingsPage.tsx edit threshold_h_minus per kategori validation descending lebih dari 0 no dup display HPP kali 0.85 floor view avg manual fallback form bahasa Indonesia input 48px error message jelas non-tech persist Dexie. Follow design.md.`
- **What to do / Must NOT do:** `src/features/settings/SettingsPage.tsx` — edit threshold_h_minus per kategori (validation descending, >0, no dup), display HPP*0.85 floor, view avg manual fallback; form bahasa Indonesia, input 48px, error message jelas non-tech; persist Dexie. Follow design.md.
- **References:** `CONTEXT.md:10-11`, `.omo/drafts/ai-inventory-expiry-advisor.md:48`, `docs/design.md:1-40` (future artifact — created by 22, bahasa Indonesia + 48px)
- **Acceptance:** `npx playwright test e2e/settings.spec.ts` — edit Dairy to [14,7,3] saves, invalid [3,3,1] shows error bahasa Indonesia, button 48px — pass
- **QA scenarios:** happy: settings edit — Evidence `.omo/evidence/task-19-ai-inventory-expiry-advisor.png`; failure: empty threshold → error — Evidence `.omo/evidence/task-19-ai-inventory-expiry-advisor-fail.png`
- **Evidence:** `.omo/evidence/task-19-ai-inventory-expiry-advisor.png`
- **Commit:** `feat(settings): threshold config` | **FRD trace:** FRD-05 F5 plus FRD-02 threshold editable

### TASK-20 [FRD-01]: E2E + build + PWA installability + offline QA polish

- **Wave:** 4 | **Depends:** 4,17,18,19 | **Blocks:** none | **Can parallelize with:** —
- **Prompt untuk agent:** `Create e2e/full-flow.spec.ts full seed ke create SKU Batch H-2 ke wait advisor mock ke propose tebus ke approve ke dashboard promo ke backup export. bun run build typecheck lighthouse PWA audit minimal offline reload still works. Polish error states.`
- **What to do / Must NOT do:** `e2e/full-flow.spec.ts` full: seed → create SKU/Batch H-2 → wait advisor mock → propose tebus → approve → dashboard promo → backup export; `bun run build` typecheck, lighthouse PWA audit minimal, offline reload still works. Polish error states.
- **References:** `docs/adr/0001-local-first-dexie-backup-drive.md:5`, `docs/adr/0002-langchain-gemini-hybrid-advisor.md:5-9`
- **Acceptance:** `bun run build && npx playwright test e2e/full-flow.spec.ts` — full flow 6 steps passes, build no TS errors — pass
- **QA scenarios:** happy: full flow green — Evidence `.omo/evidence/task-20-ai-inventory-expiry-advisor.mp4`; failure: offline without cache → graceful empty state not crash — Evidence `.omo/evidence/task-20-ai-inventory-expiry-advisor-fail.png`
- **Evidence:** `.omo/evidence/task-20-ai-inventory-expiry-advisor.mp4`
- **Commit:** `test(e2e): full flow polish` | **FRD trace:** FRD-01..06 cross-feature E2E

---

## Verifikasi Hands-Off

- `test -f docs/frd.md && test -f docs/design.md && test -f docs/architecture.md && test -f docs/decisions.md && test -f TASK.md` must pass before TASK-01 scaffold.
- Tiap TASK lolos jika Acceptance plus QA scenarios pass dan Evidence path ada file.
- Guardrails: no backend cloud, no multi-role v1, no POS cart, no OCR foto nota, no WA send, no QR label. Cek `grep -r supabase|ocr|qrcode` empty di final F4.
- Anti-pattern CONTEXT: jangan simpan expiry di SKU, jangan biarkan LLM hitung harga HPP urgency. Validasi di TASK-06 TASK-09 TASK-16.

---

## Referensi

- [CONTEXT.md](./CONTEXT.md) — Glosarium verbatim SKU Batch Kategori urgency guardrail.
- [FRD 6 feature](./docs/frd.md) — Requirements Gherkin KPI trace TASK.
- [Design UMKM 3-tap](./docs/design.md) — Journey wireframe token 48px 16px.
- [Architecture scalable pragmatis](./docs/architecture.md) — C4 Repository org_id sharding tradeoff.
- [Decisions log](./docs/decisions.md) — ADR-001 ADR-002 plus Q1-Q13.
- [Plan 24 todos](./.omo/plans/ai-inventory-expiry-advisor.md) — Source verbatim untuk 24 TASK di atas.

---

*Akhir TASK. 24 tasks mirror Todos 1-24 verbatim, traceable FRD ke TASK tanpa gap. Eksekutor bisa jalan Wave 0 ke Wave 4 tanpa tanya ulang.*
