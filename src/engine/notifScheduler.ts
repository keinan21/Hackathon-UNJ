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

  // Load kategoris → map id → kategori (untuk threshold per kategori)
  const kategoris = await repo.listKategoris();
  const kategoriMap = new Map<number, Kategori>();
  for (const k of kategoris) {
    if (k.id !== undefined) kategoriMap.set(k.id, k);
  }

  // Batches dengan expiry != null (non-perishable ter-skip otomatis via index)
  const batches = await repo.listBatchesExpiring();

  const result: DueNotification[] = [];

  for (const batch of batches) {
    // Guard: skip expiry null (walaupun listBatchesExpiring sudah filter, tetap jaga)
    if (batch.expiry_date === null || batch.expiry_date === undefined) continue;
    // Dexie where notEqual("") masih bisa kembalikan string kosong edge, skip juga
    if (typeof batch.expiry_date === "string" && batch.expiry_date.trim() === "") continue;

    const sku = await repo.getSKU(batch.sku_id);
    if (!sku) continue;

    const kategori = kategoriMap.get(sku.kategori_id);
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
      const transaksis = await repo.listTransaksisBySKU(sku.id!, since);
      if (transaksis.length > 0) {
        // calcAvgDailyUsage dengan fallback 1 — jika distinct <14 akan return 1
        // Jika tanpa fallback, distinct 10 akan return avg 2 (untuk test pure), tapi untuk scheduler kita pakai fallback 1 agar tidak NaN
        avg = calcAvgDailyUsage(transaksis, 1);
        // calcAvgDailyUsage bisa return 0 jika histori qty 0, tapi urgencyScore pakai max(...,1) jadi aman
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

/**
 * Mulai scheduler harian 07:00 Asia/Jakarta.
 * - Langsung panggil checkAndNotify sekali (on app open)
 * - Lalu setTimeout sampai 07:00 berikutnya, kemudian setInterval 24 jam
 * - Return stop function untuk cleanup
 * - Daily 07:00 + on-demand — cukup function, tidak perlu setInterval real di test
 */
export function startDailyScheduler(
  repo: InventoryRepository,
  opts: { onNotify?: (r: CheckNotifyResult) => void } = {}
): () => void {
  // On app open — on-demand
  void checkAndNotify(repo).then((r) => opts.onNotify?.(r)).catch(() => {});

  const delay = getDelayUntilNext07Jakarta(new Date());
  let timeoutId: ReturnType<typeof setTimeout> | undefined;
  let intervalId: ReturnType<typeof setInterval> | undefined;

  timeoutId = setTimeout(() => {
    void checkAndNotify(repo).then((r) => opts.onNotify?.(r)).catch(() => {});
    intervalId = setInterval(() => {
      void checkAndNotify(repo).then((r) => opts.onNotify?.(r)).catch(() => {});
    }, 24 * 60 * 60 * 1000);
  }, delay);

  return () => {
    if (timeoutId) clearTimeout(timeoutId);
    if (intervalId) clearInterval(intervalId);
  };
}
