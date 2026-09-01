# Draft: frontend-crew-a — Inventaris AI Tebus Murah (Crew A Frontend Only)

- **Slug:** frontend-crew-a
- **Intent:** clear
- **Review required:** false
- **Status:** plan-written (approved 2026-09-01 — 20 Q UX answered, install gas)
- **Scope:** Frontend Crew A only — TASK-04, TASK-11, TASK-15, TASK-17, TASK-19, TASK-20 (Design sudah Accepted, tidak diulang). Tidak ambil TASK-02/05/06/07/08/09/10/12/13/14/16 (Crew B/C) dan TASK-01/03/18 (Crew D). File ownership terbatas AGENTS.md Tabel Crew 4.
- **Gate:** Wave 0 hijau terverifikasi — `test -f docs/frd.md && test -f docs/design.md && test -f docs/architecture.md && test -f docs/decisions.md && test -f TASK.md && grep -q ADR-001 docs/decisions.md` PASS (explore ses_fa2ace359). `src/` masih kosong (docs-only), TASK-01 scaffold diasumsikan sudah dikerjakan Crew D sebelum TASK-04 (dependency).
- **Approach:** Per-feature, hands-off, 3-tap max, token 48px/16px, bahasa Indonesia Formal warung, kontras AA, data via InventoryRepository (mock di UI test), tidak hitung urgency/harga di komponen.
- **Interview 20 Q locked:** Q1 mobile-first 1 kolom, Q2 5 item nav, Q3 empty persis, Q4 Teks+warna+ikon, Q5 Full width, Q6 expiry terdekat + toggle urgencyScore, Q7 multi-select, Q8 Halaman detail, Q9 Tampilkan HPP, Q10 Dialog konfirmasi (2-tap), Q11 4s+dismiss, Q12 Kalimat persis offline, Q13 Input number 48px, Q14 16px, Q15 iconoir, Q16 #0F7A4A, Q17 7 hari, Q18 Top50+pagination, Q19 Inline+border, Q20 Formal warung
- **Skills installed:** `~/.agents/skills/frontend-design` (anthropics 421K) + `~/.agents/skills/web-design-guidelines` (vercel 100K) verified 2026-09-01; offline `prototype` + `color-accessibility-guide` retained; iconoir-react pinned (Q15)

## Decisions
- Workflow manager: local issues file `.omo/issues/frontend-crew-a/*.md` (bukan GitHub Issues). Jika repo sudah pakai tracker lain, migrasi edges jadi text di file ticket lokal.
- Stack pins (librarian 2026-09-01): Vite ^7-8, React 19.1, TS ~5.8.3, vite-plugin-pwa ^1.3.0, Dexie ^4.4.5 (hanya via Repository, tidak import langsung di UI), @langchain/google tidak dipakai di UI (Crew C), UI hanya baca advisorCache via Repository.
- Branch per TASK, 1 worktree per TASK, conventional commits, 1 reviewer, CI `bun test` + `bun run build` + `npx playwright test`, evidence di `.omo/evidence/task-<N>-frontend-crew-a.*`, sync .omo.
- Owner-decision adopted: Bahasa Indonesia 100% label UI, H-1 merah H-3 oranye H-7 kuning konsisten design.md, tombol utama hijau `primary #0F7A4A` pressed `#0B5C38`.

## Approval gate
- Brief sudah dipresentasikan di chat 2026-09-01. Menunggu explicit `ok` / `lanjut tulis plan`. Setelah ok: `node <skill-root>/scripts/scaffold-plan.mjs frontend-crew-a --clear --draft-only` sudah terwakili file ini, lalu tulis `.omo/plans/frontend-crew-a.md` dengan Todos di bawah (APPEND, bukan rewrite header).

## Todos (rencana — akan dipindah ke .omo/plans/frontend-crew-a.md setelah ok)
- 6 implementation todos (TASK-04,11,15,17,19,20) + 2 final verifiers. Semua agent-executed QA, evidence path explicit, must-not-have enforced.

## Evidence ledger (target setelah ok)
- .omo/evidence/task-4-frontend-crew-a.png
- .omo/evidence/task-11-frontend-crew-a.png
- .omo/evidence/task-15-frontend-crew-a.png
- .omo/evidence/task-17-frontend-crew-a.png
- .omo/evidence/task-19-frontend-crew-a.png
- .omo/evidence/task-20-frontend-crew-a.mp4

## Next action after approval
- Tulis plan final `.omo/plans/frontend-crew-a.md` dengan template full-workflow, lalu handoff ke worker (`/start-work`).

## Review receipts 2026-09-01
- Momus (ses_fa292a507ffe0Y0FS72PuOGZcP): CONDITIONAL PASS — 3 fixes required (L54 circular wave, evidence naming mapping, missing frontend-design in Todo5) — FIXED 2026-09-01
- Oracle (ses_fa2917213ffeTAqCfK7xSK3Zjz): P0 Dialog vs 1-tap contradiction + 6 UX risks (multi-select illegal, promo number soup Modal wording, threshold 3-col spinner, toast 4s aria-live, FakeRepository Asia/Jakarta + org_id contract, taste shadow) — FIXED 2026-09-01 (Dialog retained per Q10 user lock, with ADR override note; wording Modal, stacked fallback, shadow-card added)
- Status: REVIEW PASSED — ready for `$start-work frontend-crew-a`
