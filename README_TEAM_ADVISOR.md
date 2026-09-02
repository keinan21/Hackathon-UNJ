# Handover Advisor — Crew C (rbn) — Tebus Murah

**Scope kamu hanya 4 TASK, jangan sentuh file crew lain `AGENTS.md:124`**

| TASK | File owns | QA | Status |
|---|---|---|---|
| **TASK-12** Pairing `frd-04:44` `CONTEXT.md:17` | `src/advisor/pairing.ts:1-78` | `npm test src/advisor/pairing.test.ts` 6 tests `Roti+Susu 5x → Roti` `fallback kategori Roti→Susu` | PASS 29 total |
| **TASK-13** Hybrid `ADR-002:5-9` | `src/advisor/AdvisorPort.ts:1-12` + `LangChainGeminiAdvisor.ts:1-132` `MockLLM` | `npm test src/advisor/geminiAdvisor.test.ts` 9 tests `harga_tebus >=HPP*0.85` `cache hit no LLM` `0.84*HPP reject` `offline stale` `TTL 24j` | PASS |
| **TASK-14** Tebus `proposed` `frd-04:49` | `src/features/promo/promoService.ts:1-58` + `TebusForm.tsx:1-11` | `npm test src/features/promo/promoService.test.ts` 8 tests `9000` pass `8400` `HPP x 0.85` reject `MUST NOT auto-activate` | PASS |
| **TASK-16** Guardrail `TASK.md:294-303` | `src/lib/validation.ts:1-45` + `src/advisor/guardrail.test.ts:1-45` `floor HPP*0.85` `HPP>0` `not NaN` | `npm test src/advisor/guardrail.test.ts` 6 tests `8500` pass `8400` fail | PASS |

**Cara jalan:**
```bash
cd "D:\rakyan\projekt\Hackathon-UNJ-main"
npm install
npm test                 # 4 files 29 passed
npx tsc --noEmit         # 0 error
```

**Stub untuk unblock (kamu pakai, `rka` nanti ganti real):**
- `src/db/types.ts:1-45` `org_id toko-01 sync-ready sharding`
- `src/db/repository.ts:1-35` `InventoryRepository` seam `AGENTS.md:289`
- `src/db/fakeRepository.ts:1-88` in-memory `fake-indexeddb` untuk `advisorCache` `TASK-13:265`
- `src/engine/expiry.ts:1-32` `daysToExpiry ceil Asia/Jakarta` `urgencyScore qty*days/max(avg,1)` `CONTEXT.md:15` — nanti `rka:TASK-09` ganti real tanpa ubah `AdvisorPort`

**Handoff ke teammates:**
- `mys` Crew A `TASK-15` approve `proposed→active` `48px` `frd-04:50` via `promoService.getProposed()` — kamu stop di `proposed`
- `rka` Crew B `TASK-02 DexieRepository` + `09 expiry real` — ganti `FakeRepository` → `DexieRepository` via `AdvisorPort` tanpa ubah logic guardrail
- `rbr` Crew D `TASK-01 scaffold vite-plugin-pwa` + `03 crypto PBKDF2 100k AES-GCM` — real Gemini key `localStorage` encrypted nanti, sekarang `MockLLM` `forceHargaTebus` `shouldFail` udah cukup

**Guardrail wajib `AGENTS.md:289-297`:**
- `Must` `org_id toko-01` indexed, `Must` angka dari DB LLM hanya wording pairing, `Must` `harga_tebus >= HPP*0.85` before save `src/advisor/LangChainGeminiAdvisor.ts:85-95` `src/features/promo/promoService.ts:15-25`
- `Must NOT` `supabase|firebase|ocr|qrcode` `grep` 0 leak `AGENTS.md:337-342` — sudah `PASS`

**Evidence:**
- `.omo/evidence/task-12-ai-inventory-expiry-advisor.json` 6 tests
- `.omo/evidence/task-13-ai-inventory-expiry-advisor.json` 9 tests cache TTL
- `.omo/evidence/task-14-ai-inventory-expiry-advisor.json` 8 tests
- `.omo/evidence/task-16-ai-inventory-expiry-advisor.log` 6 tests

**Next PR:** `git worktree add ../wt-TASK-12 -b feat/TASK-12-pairing` → `feat/TASK-13-advisor` → `feat/TASK-14-promo` → `feat/TASK-16-guardrail` masing-masing 1 reviewer `AGENTS.md:200-212` `conventional commits` `TASK.md` baris Commit.
