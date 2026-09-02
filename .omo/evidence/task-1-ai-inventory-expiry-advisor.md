# TASK-01 Evidence — Init Vite+React+TS scaffold + PWA tooling

- **Tanggal:** 2026-09-01 (WIB)
- **Executor:** Crew D (scaffold) + Crew B assist (deps completion)
- **Verifikator:** agent (hands-off)

## Acceptance criteria (TASK.md:127)

Perintah: `bun install && bun run build` exit 0 && `test -f dist/manifest.webmanifest && test -f dist/sw.js && grep -q "dexie" package.json && grep -q "vite-plugin-pwa" vite.config.ts`

> Catatan: `bun` tidak tersedia di mesin verifikasi; diganti `pnpm install && pnpm run build` (setara, disetujui user 2026-09-01).

## Hasil

| Kriteria | Status |
|---|---|
| `pnpm install` exit 0 | PASS |
| `pnpm run build` exit 0 (tsc -b && vite build, 0 error TS) | PASS |
| `test -f dist/manifest.webmanifest` | PASS |
| `test -f dist/sw.js` | PASS |
| `grep -q "dexie" package.json` | PASS (`dexie ^4.4.5`) |
| `grep -q "vite-plugin-pwa" vite.config.ts` | PASS |

## Deps terpasang (package.json)

- `dexie ^4.4.5` — dependencies
- `fake-indexeddb ^6.2.5` — devDependencies
- `langchain ^1.5.10` — dependencies
- `@google/generative-ai ^0.24.1` — dependencies
- `tailwindcss ^3` + `daisyui ^4` — devDependencies (ditambahkan Crew A/teman, commit 717f95a)
- `vite-plugin-pwa ^0.21.1` — devDependencies

## Struktur folder dibuat

- `src/db/` (.gitkeep) — untuk TASK-02 Crew B
- `src/engine/` (.gitkeep) — untuk TASK-09 Crew B
- `src/advisor/` (.gitkeep) — untuk TASK-13 Crew C
- `src/features/` (.gitkeep) — untuk TASK-03/04 Crew A/D
- `src/lib/` (.gitkeep) — untuk TASK-03 crypto
- `public/icons/` — sudah ada (pwa-192x192.png, pwa-512x512.png, pwa-512x512-maskable.png)

## Verifikasi runtime (MCP Playwright, preview :4173)

- Service Worker aktif: `swActive: true`
- Manifest valid: name "Inventaris AI Tebus Murah", short_name "TebusMurah", theme_color `#0F7A4A`, display standalone, 3 ikon
- Shell render: heading + Stok Mepet + Promo Aktif + bottom nav
- Offline fallback: "Kamu offline, data tersimpan lokal akan tampil saat ada" + tombol "Muat Ulang" (min-height 48px)
- Console: 0 errors

## Wave 0 Gate

`test -f docs/frd.md && test -f docs/design.md && test -f docs/architecture.md && test -f docs/decisions.md && test -f TASK.md && grep -q "ADR-001" docs/decisions.md && grep -q "TASK-01" TASK.md && grep -c "TASK-" TASK.md | awk '{exit $1<24}' && test -f docs/frd/frd-01-pwa.md && test -f docs/frd/frd-06-backup.md && wc -l docs/frd/frd-*.md | awk '{if($1<100) exit 1}' && test -f AGENTS.md && test -f AGENT.md && grep -q "Crew A — Frontend" AGENTS.md && grep -q "GitHub Flow" AGENTS.md`

Hasil: **PASS** (dive rifikasi sebelum pull scaffold commit 34a9c4d)

## Kesimpulan

TASK-01 acceptance **ALL PASS**. Wave 1 dependency terpenuhi, TASK-02 (Crew B) dapat dimulai.
