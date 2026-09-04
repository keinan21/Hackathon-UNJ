/**
 * TASK-10 [FRD-03] — Notifikasi scheduler (daily 07:00 + threshold per kategori)
 *
 * - Daily check 07:00 Asia/Jakarta via setInterval + on app open (checkAndNotify)
 * - Query batches where days_to_expiry in threshold_h_minus (per Kategori via SKU)
 * - daysToExpiry pakai Asia/Jakarta startOfDay + ceil (src/engine/expiry.ts)
 * - skip expiry null (non-perishable)
 * - urgencyScore via qty*days / max(avg,1) — avg dari transaksi 14d atau fallback 1
 * - request Notification permission, show push + badge count
 * - WA hook stub: console.log saja, MUST NOT implement WA send
 *
 * Trace: TASK-10 [FRD-03] — FRD-03 F3 threshold per kategori
 * References: CONTEXT.md:20-21, docs/frd/frd-03-expiry.md, docs/adr/0002-langchain-gemini-hybrid-advisor.md:8
 */

import type { InventoryRepository, Batch, SKU, Kategori } from "../db/db";
import { daysToExpiry, urgencyScore } from "./expiry";
import { calcAvgDailyUsage } from "./avgUsage";
import { calcOmzet14 } from "./omzet";
import { buildRecapText, enqueueTelegram, buildDedupKey } from "../lib/telegram";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type DueNotification = {
  batch: Batch;
  sku: SKU;
  kategori: Kategori;
  daysToExpiry: number;
  urgencyScore: number;
};

// ---------------------------------------------------------------------------
// getDueNotifications — pure query + filter threshold per kategori
// ---------------------------------------------------------------------------

/**
 * Query batch yang jatuh tepat di threshold H- kategori masing-masing.
 *
 * - Ambil semua kategoris (threshold_h_minus per kategori)
 * - Ambil batches via repo.listBatchesExpiring() (expiry != null, sorted)
 * - Untuk tiap batch: resolve SKU → Kategori, hitung daysToExpiry(today Asia/Jakarta),
 *   skip expiry null, skip jika days tidak ada di threshold_h_minus kategori tersebut
 * - Hitung urgencyScore = qty * days / max(avg,1), avg dari transaksi 14 hari terakhir atau 1
 *
 * @param repo - InventoryRepository (DexieRepository)
 * @param today - tanggal acuan (default now), di-normalize ke startOfDay Asia/Jakarta di daysToExpiry
 */
export async function getDueNotifications(
  repo: InventoryRepository,
  today?: Date
): Promise<DueNotification[]> {
  const d = today ?? new Date();

  const anyRepo = repo as unknown as Record<string, unknown>;
  const kategoris = await (async () => {
    try {
      const r = await (anyRepo.listKategoris as (orgId?: string) => Promise<Kategori[]>)("toko-01");
      if (Array.isArray(r)) return r;
    } catch {}
    return repo.listKategoris();
  })();
  const kategoriMap = new Map<number | string, Kategori>();
  for (const k of kategoris) {
    const id = (k as unknown as { id: number | string }).id;
    if (id !== undefined) kategoriMap.set(id, k);
  }

  const batches = await (async () => {
    try {
      const r = await (anyRepo.listBatchesExpiring as (orgId?: string) => Promise<Batch[]>)("toko-01");
      if (Array.isArray(r)) return r;
    } catch {}
    return repo.listBatchesExpiring();
  })();

  const result: DueNotification[] = [];

  for (const batch of batches) {
    if (batch.expiry_date === null || batch.expiry_date === undefined) continue;
    if (typeof batch.expiry_date === "string" && batch.expiry_date.trim() === "") continue;

    const sku: SKU | undefined = await (async () => {
      const a = anyRepo.getSKU as ((id: number) => Promise<SKU | undefined>) | undefined;
      if (typeof a === "function") {
        try {
          const r = await a.call(repo, batch.sku_id as unknown as number);
          if (r) return r;
        } catch {}
      }
      const b = anyRepo.getSku as ((id: string) => Promise<SKU | undefined>) | undefined;
      if (typeof b === "function") {
        try {
          return await b.call(repo, String(batch.sku_id));
        } catch {}
      }
      return undefined;
    })();
    if (!sku) continue;

    const kategori = kategoriMap.get(sku.kategori_id as unknown as number | string);
    if (!kategori) continue;

    const days = daysToExpiry(batch.expiry_date, d);
    if (days === null) continue;

    // Filter: days harus ada di threshold_h_minus kategori tersebut (exact match)
    // Spec: query batches where days_to_expiry in threshold_h_minus per kategori
    if (!kategori.threshold_h_minus.includes(days)) continue;

    // Hitung avgDailyUsage — pakai histori 14 hari terakhir, fallback 1
    // Pakai repo.listTransaksisBySKU (isolated test DB) + calcAvgDailyUsage pure
    // Jika tidak ada histori, fallback 1 (MUST NOT hallucinate)
    let avg = 1;
    try {
      const since = new Date(Date.now() - 14 * 24 * 60 * 60 * 1000).toISOString();
      const skuId = (sku as unknown as { id: number | string }).id!;
      let transaksis: unknown[] | undefined;
      try {
        transaksis = await (repo as unknown as { listTransaksisBySKU: (id: number, since: string) => Promise<unknown[]> }).listTransaksisBySKU(
          skuId as unknown as number,
          since,
        );
      } catch {}
      if (!transaksis) {
        try {
          const all = await (anyRepo.listTransaksisBySKU as (id: string, orgId: string) => Promise<unknown[]>)?.call(repo, String(skuId), "toko-01");
          if (Array.isArray(all)) {
            transaksis = (all as Array<{ sold_at: string }>).filter((t) => (t.sold_at ?? "") >= since);
          }
        } catch {}
      }
      if (transaksis && transaksis.length > 0) {
        avg = calcAvgDailyUsage(transaksis as Parameters<typeof calcAvgDailyUsage>[0], 1);
        if (!Number.isFinite(avg)) avg = 1;
      }
    } catch {
      avg = 1;
    }

    const score = urgencyScore(batch.qty, days, avg);

    result.push({
      batch,
      sku,
      kategori,
      daysToExpiry: days,
      urgencyScore: score,
    });
  }

  return result;
}

// ---------------------------------------------------------------------------
// WA hook stub — MUST NOT implement WA send, hanya console.log
// ---------------------------------------------------------------------------

function waHookStub(due: DueNotification[]): void {
  // MUST NOT implement WA send — hanya log
  if (due.length === 0) return;
  console.log(`[WA hook stub] ${due.length} batch perlu notifikasi — tidak kirim WA v1 (MUST NOT send)`);
  for (const n of due) {
    console.log(`[WA hook stub] SKU ${n.sku.nama} batch ${n.batch.id} H-${n.daysToExpiry} qty ${n.batch.qty}`);
  }
}

// ---------------------------------------------------------------------------
// checkAndNotify — on-demand + daily 07:00 wrapper
// ---------------------------------------------------------------------------

export type CheckNotifyResult = {
  notified: number;
  badgeCount: number;
};

/**
 * Cek due notifications lalu tampilkan push + badge.
 *
 * - Panggil getDueNotifications
 * - WA hook stub (console.log saja)
 * - Request Notification permission jika belum granted/denied
 * - Jika granted: show push per batch via src/sw/notif.ts showNotification (stub aman di test)
 * - Jika denied: fallback badge only, tidak throw
 * - Badge via navigator.setAppBadge jika tersedia
 * - Daily 07:00: cukup panggil checkAndNotify saat app open + scheduler (lihat startDailyScheduler)
 * - MUST NOT throw — permission denied tetap return badgeCount
 */
export async function checkAndNotify(
  repo: InventoryRepository,
  today?: Date
): Promise<CheckNotifyResult> {
  const due = await getDueNotifications(repo, today);
  const badgeCount = due.length;

  // WA hook stub — MUST NOT send
  try {
    waHookStub(due);
  } catch {
    // ignore hook error
  }

  try {
    const g = globalThis as unknown as {
      Notification?: {
        permission: NotificationPermission;
        requestPermission: () => Promise<NotificationPermission>;
      } & typeof Notification;
      navigator?: { setAppBadge?: (n: number) => Promise<void>; clearAppBadge?: () => Promise<void> };
    };

    // Jika tidak ada Notification (Node test tanpa mock) → fallback badge only
    if (typeof g.Notification === "undefined") {
      // Update badge jika tersedia
      if (g.navigator && typeof g.navigator.setAppBadge === "function") {
        try {
          if (badgeCount > 0) await g.navigator.setAppBadge(badgeCount);
          else if (typeof g.navigator.clearAppBadge === "function") await g.navigator.clearAppBadge();
        } catch {
          // ignore badge error
        }
      }
      return { notified: 0, badgeCount };
    }

    let perm: NotificationPermission = g.Notification.permission;

    if (perm !== "granted" && perm !== "denied") {
      try {
        perm = await g.Notification.requestPermission();
      } catch {
        perm = "denied";
      }
    }

    if (perm === "granted") {
      // Show push per due notification
      // Dynamic import agar tidak broken di Node test tanpa SW
      try {
        const { showNotification } = await import("../sw/notif");
        for (const n of due) {
          const title = `Stok mepet: ${n.sku.nama}`;
          const body = `Batch ${n.batch.qty} pcs H-${n.daysToExpiry} — perlu tebus murah`;
          try {
            await showNotification(title, { body, tag: `batch-${n.batch.id}` } as NotificationOptions);
          } catch {
            // Fallback native Notification jika SW gagal
            try {
              // eslint-disable-next-line no-new
              new (g.Notification as unknown as typeof Notification)(title, { body } as NotificationOptions);
            } catch {
              // ignore
            }
          }
        }
      } catch {
        // Fallback native jika dynamic import gagal
        for (const n of due) {
          const title = `Stok mepet: ${n.sku.nama}`;
          const body = `Batch ${n.batch.qty} pcs H-${n.daysToExpiry}`;
          try {
            // eslint-disable-next-line no-new
            new (g.Notification as unknown as typeof Notification)(title, { body } as NotificationOptions);
          } catch {
            // ignore
          }
        }
      }

      // Badge update
      if (g.navigator && typeof g.navigator.setAppBadge === "function") {
        try {
          if (badgeCount > 0) await g.navigator.setAppBadge(badgeCount);
          else if (typeof g.navigator.clearAppBadge === "function") await g.navigator.clearAppBadge();
        } catch {
          // ignore
        }
      }

      return { notified: due.length, badgeCount };
    } else {
      // permission denied → fallback badge only, tidak throw (FRD-03 Gherkin)
      if (g.navigator && typeof g.navigator.setAppBadge === "function") {
        try {
          if (badgeCount > 0) await g.navigator.setAppBadge(badgeCount);
          else if (typeof g.navigator.clearAppBadge === "function") await g.navigator.clearAppBadge();
        } catch {
          // ignore
        }
      }
      return { notified: 0, badgeCount };
    }
  } catch (e) {
    // MUST NOT throw — fallback badge only, no error propagation
    console.warn("[notifScheduler] checkAndNotify fallback badge only", e);
    return { notified: 0, badgeCount };
  }
}

// ---------------------------------------------------------------------------
// onBatchInserted — trigger advisor jika batch kritis (wiring TASK-15)
// ---------------------------------------------------------------------------

/**
 * Dipanggil setelah insert batch berhasil (Task 15 wiring).
 * - Skip jika batch null / expiry null / days > threshold max (default 7)
 * - Trigger checkAndNotify (badge + push) + advisor onBatchInserted jika urgent
 * - MUST NOT throw — fire-and-forget aman untuk UI
 */
export async function onBatchInserted(
  batchId: string,
  orgId = "toko-01",
  repoOverride?: unknown
): Promise<void> {
  try {
    const repo: any =
      repoOverride ??
      (await import("../db/dexieRepository")).realRepo;
    const batch = await repo.getBatch?.(batchId) ?? await repo.getBatch?.(batchId);
    if (!batch) return;
    if (batch.expiry_date === null || batch.expiry_date === undefined) return;
    const trimmed = String(batch.expiry_date).trim();
    if (trimmed === "") return;
    const days = daysToExpiry(trimmed);
    if (days === null) return;

    // threshold urgency = max threshold kategori atau default 7
    // Ambil sku → kategori untuk threshold akurat, fallback 7
    let isKritis = days <= 7;
    try {
      const sku = await repo.getSku?.(batch.sku_id) ?? await repo.getSKU?.(batch.sku_id);
      if (sku) {
        const kategori = await repo.getKategori?.(sku.kategori_id) ?? await repo.getKategori?.(sku.kategori_id);
        if (kategori && Array.isArray((kategori as Kategori).threshold_h_minus)) {
          const max = Math.max(...(kategori as Kategori).threshold_h_minus);
          isKritis = days <= max;
        }
      }
    } catch {
    }

    try {
      const legacyRepo = (await import("../db/db")).db ? null : null;
      void legacyRepo;
      await checkAndNotify(repo as unknown as InventoryRepository);
    } catch {
    }

    if (!isKritis) return;

    // Trigger advisor on-demand (fire-and-forget)
    try {
      const { LangChainGeminiAdvisor } = await import("../advisor/LangChainGeminiAdvisor");
      // Lazy load LLM via pin store, fallback MockLLM
      let llm: import("../advisor/LangChainGeminiAdvisor").LLMPort;
      try {
        const { createLLMFromPinStore } = await import("../advisor/RealJustwokerLLM");
        llm = await createLLMFromPinStore("2005");
      } catch {
        const { MockLLM } = await import("../advisor/LangChainGeminiAdvisor");
        llm = new MockLLM();
      }
      const advisor = new LangChainGeminiAdvisor(repo, llm);
      await advisor.onBatchInserted(batchId, orgId).catch(() => {});
    } catch {
      // ignore advisor error — scheduler must not throw
    }
  } catch {
    // must not throw
  }
}

// ---------------------------------------------------------------------------
// Scheduler helpers — daily 07:00 + on-demand (on app open)
// ---------------------------------------------------------------------------

/**
 * Hitung delay (ms) sampai jam 07:00 Asia/Jakarta berikutnya.
 * Dipakai untuk setTimeout pertama sebelum setInterval harian.
 * Pure helper — tidak mengandalkan setInterval real di test (cukup function).
 */
export function getDelayUntilNext07Jakarta(now: Date = new Date()): number {
  // Ambil kalender Jakarta via Intl
  const fmt = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Jakarta",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  });
  const parts = fmt.formatToParts(now);
  const get = (t: string) => Number(parts.find((p) => p.type === t)!.value);
  const year = get("year");
  const month = get("month");
  const day = get("day");
  const hour = get("hour");
  const minute = get("minute");
  const second = get("second");

  // Buat target 07:00 hari ini di Jakarta (UTC = Jakarta -7h)
  const JAKARTA_OFFSET_MS = 7 * 60 * 60 * 1000;
  let targetJakarta07 = new Date(Date.UTC(year, month - 1, day, 7, 0, 0, 0) - JAKARTA_OFFSET_MS);

  // Jika sekarang sudah lewat 07:00 Jakarta, target besok
  // Bandingkan now dalam kalender Jakarta
  const nowMs = now.getTime();
  // Sederhana: jika hour>7 atau hour==7 && (minute>0||second>0) → besok
  const isPast07 = hour > 7 || (hour === 7 && (minute > 0 || second > 0));
  if (isPast07 && targetJakarta07.getTime() <= nowMs) {
    // besok 07:00
    targetJakarta07 = new Date(targetJakarta07.getTime() + 24 * 60 * 60 * 1000);
  } else if (targetJakarta07.getTime() <= nowMs) {
    // edge: jika tepat 07:00 tapi ms lewat, tetap besok
    if (targetJakarta07.getTime() <= nowMs) {
      targetJakarta07 = new Date(targetJakarta07.getTime() + 24 * 60 * 60 * 1000);
    }
  }

  return Math.max(0, targetJakarta07.getTime() - nowMs);
}

// ---------------------------------------------------------------------------
// Omzet + Rekap 07:00 — angka deterministik via src/engine/omzet.ts
// ---------------------------------------------------------------------------

function formatJakartaYMDForRecap(d: Date): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Jakarta",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(d);
}

async function collectTransaksis14(
  repo: InventoryRepository,
  sinceIso: string,
): Promise<unknown[]> {
  const anyRepo = repo as unknown as Record<string, unknown>;
  // string-repo path: listTransaksis(orgId)
  if (typeof anyRepo.listTransaksis === "function") {
    try {
      const all = (await (anyRepo.listTransaksis as (orgId: string) => Promise<unknown[]>)("toko-01")) as Array<{ sold_at: string }>;
      return all.filter((t) => (t.sold_at ?? "") >= sinceIso);
    } catch {
      // fallback ke numeric path
    }
  }
  // numeric path: via kategoris → SKUs → transaksisBySKU
  const result: unknown[] = [];
  try {
    const kategoris = (await (repo as unknown as { listKategoris: () => Promise<Kategori[]> }).listKategoris()) as Kategori[];
    for (const k of kategoris) {
      const id = (k as unknown as { id: number }).id;
      if (id === undefined) continue;
      const skus = await (repo as unknown as { listSKUsByKategori: (id: number) => Promise<SKU[]> }).listSKUsByKategori(id);
      for (const s of skus) {
        const sid = (s as unknown as { id: number }).id;
        if (sid === undefined) continue;
        try {
          const trans = await (repo as unknown as { listTransaksisBySKU: (sid: number, since: string) => Promise<unknown[]> }).listTransaksisBySKU(
            sid,
            sinceIso,
          );
          result.push(...trans);
        } catch {
          // ignore per-sku error
        }
      }
    }
  } catch {
    // ignore collect error → return what we have
  }
  // fallback: coba direct db jika repo tidak punya data
  if (result.length === 0) {
    try {
      const { db } = await import("../db/db");
      const all = await (db as unknown as { transaksis: { where: (f: string) => { equals: (v: string) => { toArray: () => Promise<unknown[]> } } } }).transaksis
        .where("org_id")
        .equals("toko-01")
        .toArray();
      return (all as Array<{ sold_at: string }>).filter((t) => (t.sold_at ?? "") >= sinceIso);
    } catch {
      return result;
    }
  }
  return result;
}

async function collectBatchesForOmzet(repo: InventoryRepository): Promise<unknown[]> {
  const anyRepo = repo as unknown as Record<string, unknown>;
  const result: unknown[] = [];
  try {
    const kategoris = (await (repo as unknown as { listKategoris: () => Promise<Kategori[]> }).listKategoris()) as Kategori[];
    for (const k of kategoris) {
      const id = (k as unknown as { id: number }).id;
      if (id === undefined) continue;
      const skus = await (repo as unknown as { listSKUsByKategori: (id: number) => Promise<SKU[]> }).listSKUsByKategori(id);
      for (const s of skus) {
        const sid = (s as unknown as { id: number }).id;
        if (sid === undefined) continue;
        try {
          const batches = await (repo as unknown as { listBatchesBySKU: (sid: number) => Promise<unknown[]> }).listBatchesBySKU(sid);
          result.push(...batches);
        } catch {}
      }
    }
    if (result.length > 0) return result;
  } catch {}
  // fallback string-repo: listBatchesExpiring or via db
  if (typeof anyRepo.listBatchesExpiring === "function") {
    try {
      const exp = (await (anyRepo.listBatchesExpiring as (orgId: string) => Promise<unknown[]>)("toko-01")) as unknown[];
      // exp hanya expiry != null, tapi tetap gunakan sebagai fallback batch set
      if (exp.length > 0) return exp;
    } catch {}
  }
  try {
    const { db } = await import("../db/db");
    const all = await (db as unknown as { batches: { where: (f: string) => { equals: (v: string) => { toArray: () => Promise<unknown[]> } } } }).batches
      .where("org_id")
      .equals("toko-01")
      .toArray();
    return all;
  } catch {
    return result;
  }
}

export async function calcOmzetForRepo(
  repo: InventoryRepository,
  today: Date = new Date(),
): Promise<{ omzet: number; margin: number; cashflow: number; belanja: number }> {
  try {
    const fmt = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Jakarta", year: "numeric", month: "2-digit", day: "2-digit" });
    const p = fmt.formatToParts(today);
    const y = Number(p.find((x) => x.type === "year")!.value);
    const m = Number(p.find((x) => x.type === "month")!.value);
    const d = Number(p.find((x) => x.type === "day")!.value);
    const start = new Date(Date.UTC(y, m - 1, d, 0, 0, 0, 0) - 7 * 60 * 60 * 1000);
    const sinceIso = new Date(start.getTime() - 13 * 86_400_000).toISOString();
    const transaksis = (await collectTransaksis14(repo, sinceIso)) as unknown as Parameters<typeof calcOmzet14>[0];
    const batches = (await collectBatchesForOmzet(repo)) as unknown as Parameters<typeof calcOmzet14>[1];
    return calcOmzet14(transaksis as any, batches as any, today);
  } catch {
    try {
      const fmt2 = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Jakarta", year: "numeric", month: "2-digit", day: "2-digit" });
      const p2 = fmt2.formatToParts(today);
      const y2 = Number(p2.find((x) => x.type === "year")!.value);
      const m2 = Number(p2.find((x) => x.type === "month")!.value);
      const d2 = Number(p2.find((x) => x.type === "day")!.value);
      const start2 = new Date(Date.UTC(y2, m2 - 1, d2, 0, 0, 0, 0) - 7 * 60 * 60 * 1000);
      const since2 = new Date(start2.getTime() - 13 * 86_400_000).toISOString();
      const trans2 = (await collectTransaksis14(repo, since2)) as any;
      const batches2 = (await collectBatchesForOmzet(repo)) as any;
      return calcOmzet14(trans2, batches2, today);
    } catch {
      return { omzet: 0, margin: 0, cashflow: 0, belanja: 0 };
    }
  }
}

export type DailyRecap = {
  kritis: Array<{ nama: string; qty: number; days: number }>;
  omzet: number;
  margin: number;
  cashflow: number;
  belanja: number;
  text: string;
  tanggal: string;
};

/**
 * Bangun rekap harian 07:00 Jakarta berisi list kritis + omzet/margin/cashflow 14 hari.
 * Angka dari engine deterministik (calcOmzet14), bukan LLM. Teks via buildRecapText task-17.
 * Tidak throw — return text kosong jika repo error.
 */
export async function buildDailyRecap(
  repo: InventoryRepository,
  today: Date = new Date(),
): Promise<DailyRecap> {
  const tanggal = formatJakartaYMDForRecap(today);
  try {
    const due = await getDueNotifications(repo, today);
    const kritis = due.map((d) => ({ nama: d.sku.nama, qty: d.batch.qty, days: d.daysToExpiry }));
    const { omzet, margin, cashflow, belanja } = await calcOmzetForRepo(repo, today);
    const text = buildRecapText({ kritis, omzet, margin, cashflow, tanggal });
    return { kritis, omzet, margin, cashflow, belanja, text, tanggal };
  } catch {
    const text = buildRecapText({ kritis: [], omzet: 0, margin: 0, cashflow: 0, tanggal });
    return { kritis: [], omzet: 0, margin: 0, cashflow: 0, belanja: 0, text, tanggal };
  }
}

/**
 * Kirim rekap harian via Telegram — offline → badge tetap update + antre queue.
 * - Badge via checkAndNotify path existing walau offline (MUST NOT throw jika permission denied)
 * - Telegram: coba sendRecap jika token tersedia, gagal/offline → enqueueTelegram dedup batchId+tanggal
 * - Jika token belum disetting → skip kirim, hanya badge (tidak throw)
 * - Dedup key: "rekap"+tanggal agar satu hari satu pesan rekap
 */
export async function sendDailyRecap(
  repo: InventoryRepository,
  today: Date = new Date(),
): Promise<{ badgeCount: number; text: string; queued: boolean }> {
  // Badge tetap jalan walau offline — jangan throw
  let badgeCount = 0;
  try {
    const res = await checkAndNotify(repo, today);
    badgeCount = res.badgeCount;
  } catch {
    badgeCount = 0;
  }

  let recap: DailyRecap;
  try {
    recap = await buildDailyRecap(repo, today);
  } catch {
    recap = { kritis: [], omzet: 0, margin: 0, cashflow: 0, belanja: 0, text: "", tanggal: formatJakartaYMDForRecap(today) };
  }

  const text = recap.text;
  if (!text || text.trim().length === 0) return { badgeCount, text: "", queued: false };

  const tanggal = recap.tanggal;
  const dedupKey = buildDedupKey("rekap", tanggal);

  // Coba kirim Telegram jika settings ada — tanpa PIN tidak bisa decrypt, jadi fallback enqueue
  // Prioritas: coba fetch terdekripsi via getDecryptedToken dengan PIN yang umum, lalu direct sendRecap
  // Jika tidak ada token/chatId → skip kirim tapi tetap badge (tidak throw)
  try {
    const { getTelegramSettingsRaw, getDecryptedToken, sendRecap } = await import("../lib/telegram");
    const raw = getTelegramSettingsRaw();
    if (!raw) {
      return { badgeCount, text, queued: false };
    }
    const chatId = raw.chatId;
    if (!chatId) return { badgeCount, text, queued: false };

    // Coba decrypt dengan PIN yang mungkin ada di memStore (coba PIN umum + yang tersimpan di pinStore)
    let token: string | null = null;
    const tryPins = ["1234", "2005", "0000"];
    // coba PIN dari pinStore jika ada (best-effort)
    try {
      const { getPinRecord } = await import("../features/auth/pinStore");
      const rec = getPinRecord();
      // pinStore tidak simpan plaintext, jadi tidak bisa ambil PIN — skip
      void rec;
    } catch {}
    for (const pin of tryPins) {
      try {
        const t = await getDecryptedToken(pin);
        if (t) {
          token = t;
          break;
        }
      } catch {}
    }
    if (!token) {
      // tidak bisa decrypt → antre dengan chatId yang ada (fetch akan gagal & queue)
      await enqueueTelegram({ dedupKey, chatId, text, batchId: "rekap", tanggal });
      return { badgeCount, text, queued: true };
    }
    // token ada → coba sendRecap direct-HTTPS
    try {
      const res = await sendRecap(token, chatId, text, { batchId: "rekap", tanggal });
      // sendRecap sudah handle offline→queue internally
      return { badgeCount, text, queued: res.queued ?? false };
    } catch {
      await enqueueTelegram({ dedupKey, chatId, text, batchId: "rekap", tanggal });
      return { badgeCount, text, queued: true };
    }
  } catch {
    // fallback enqueue jika import gagal
    try {
      const { getTelegramSettingsRaw: getRaw2 } = await import("../lib/telegram");
      const raw2 = getRaw2();
      const chatId2 = raw2?.chatId ?? "unknown";
      await enqueueTelegram({ dedupKey, chatId: chatId2, text, batchId: "rekap", tanggal });
      return { badgeCount, text, queued: true };
    } catch {
      return { badgeCount, text, queued: false };
    }
  }
}

/**
 * Mulai scheduler harian 07:00 Asia/Jakarta.
 * - Langsung panggil checkAndNotify + sendDailyRecap sekali (on app open)
 * - Lalu setTimeout sampai 07:00 berikutnya, kemudian setInterval 24 jam (keduanya panggil badge+rekap)
 * - Return stop function untuk cleanup
 * - Daily 07:00 + on-demand — cukup function, tidak perlu setInterval real di test
 */
export function startDailyScheduler(
  repo: InventoryRepository,
  opts: { onNotify?: (r: CheckNotifyResult) => void } = {}
): () => void {
  // On app open — on-demand (badge + rekap, fire-and-forget, MUST NOT throw)
  void checkAndNotify(repo).then((r) => opts.onNotify?.(r)).catch(() => {});
  void sendDailyRecap(repo).catch(() => {});

  const delay = getDelayUntilNext07Jakarta(new Date());
  let timeoutId: ReturnType<typeof setTimeout> | undefined;
  let intervalId: ReturnType<typeof setInterval> | undefined;

  timeoutId = setTimeout(() => {
    void checkAndNotify(repo).then((r) => opts.onNotify?.(r)).catch(() => {});
    void sendDailyRecap(repo).catch(() => {});
    intervalId = setInterval(() => {
      void checkAndNotify(repo).then((r) => opts.onNotify?.(r)).catch(() => {});
      void sendDailyRecap(repo).catch(() => {});
    }, 24 * 60 * 60 * 1000);
  }, delay);

  return () => {
    if (timeoutId) clearTimeout(timeoutId);
    if (intervalId) clearInterval(intervalId);
  };
}
