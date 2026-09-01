# Learnings — frontend-crew-a

Conventions, patterns, and successful approaches discovered during work on this plan.

_Auto-scaffolded by /start-work. Append new entries below - never overwrite._

---

## 2026-09-01 — TASK-04 PWA shell + Tailwind+DaisyUI fix
- Manifest theme: `#0F7A4A` primary 7.1:1 AAA, daisyUI light theme primary `#0F7A4A` via `tailwind.config.js` daisyui.themes.light.primary
- Manifest spec verbatim: `VitePWA({ registerType:'autoUpdate', manifest:{ name:'Inventaris AI Tebus Murah', short_name:'TebusMurah', theme_color:'#0F7A4A', background_color:'#FFFFFF', display:'standalone', scope:'/', start_url:'/', icons:[192,512,maskable] }, workbox:{ globPatterns:['**/*.{js,css,html,ico,png,svg,woff2}'], clientsClaim:true, skipWaiting:true } })` — workbox clientsClaim/skipWaiting verified in dist/sw.js
- Icons: `public/icons/pwa-192x192.png` (15,122,74 solid), `pwa-512x512.png`, `pwa-512x512-maskable.png` distinct darker #0B5C38 for maskable entry — png 413/1496/1497 bytes via python zlib
- Hook API: `src/hooks/usePWAInstall.ts` — listens `beforeinstallprompt`, respects `localStorage pwa-prompt-dismissed-at` 7 days (DISMISS_DAYS=7, 7*24*60*60*1000), exposes `{canInstall,promptInstall,dismiss,isDismissed}`, handles appinstalled + standalone check
- Fallback: `src/components/OfflineFallback.tsx` uses DaisyUI `btn btn-primary min-h-[48px] h-12 w-full max-w-[360px]` + iconoir-react WifiOff/RefreshDouble, message "Kamu offline, data tersimpan lokal akan tampil saat ada", 48px full-width verified via playwright boundingBox>200 and haveCSS min-height 48px
- InstallPrompt: `src/components/InstallPrompt.tsx` daisyUI `btn btn-primary flex-1 min-h-[48px]` for Pasang, btn ghost for Nanti, Download iconoir-react
- Tailwind+DaisyUI wiring: `tailwind.config.js` content `["./index.html","./src/**/*.{js,ts,jsx,tsx}"]` + plugin `require("daisyui")` + theme light primary #0F7A4A; `postcss.config.js` tailwindcss+autoprefixer; `src/index.css` replaced with `@tailwind base/components/utilities` + @layer base body `bg-[#F5F5F0]` + btn-primary override
- Build fix: pretty-manifest plugin in `vite.config.ts` writes `dist/manifest.webmanifest` as `JSON.stringify(j,null,2)` so `grep '"theme_color": "#0F7A4A"'` passes (vite-plugin-pwa emits minified without space)
- Verification: `bun install && bun run build` exit 0, `test -f dist/manifest.webmanifest && test -f dist/sw.js && grep '"theme_color": "#0F7A4A"'`, `npx playwright test e2e/pwa.spec.ts` 6/6 passed, `grep daisyui tailwind.config.js && grep @tailwind src/index.css && grep tailwindcss package.json` all PASS, `grep -r "from.*dexie" src/components` 0
