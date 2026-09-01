/**
 * TASK-08 [FRD-03] — Avg Daily Usage calculator + histori transaksi model
 *
 * Avg Daily Usage per SKU: auto-hitung dari histori transaksi (sku_id, qty_sold, sold_at)
 * selama 14 hari terakhir, fallback input manual jika data kurang dari 14 hari.
 *
 * - transaksis table sudah ada di src/db/db.ts (sku_id, qty_sold, sold_at, org_id)
 * - avg = total_qty_sold / days_with_history over last 14d (atau 30d jika histori kosong)
 * - jika distinctDays < 14 dan manualFallback diberikan → return manualFallback
 * - jika transaksis empty → return manualFallback ?? 0 (MUST NOT hallucinate, MUST NOT NaN)
 * - distinctDays = jumlah hari unik (YYYY-MM-DD) dari sold_at ISO
 * - Store per SKU tidak perlu DB tulis, cuma calc (pure function)
 * - Gunakan sold_at ISO, hitung distinct days via toISOString().slice(0,10)
 *
 * Trace: TASK-08 [FRD-03] — FRD-02 fallback plus FRD-03 urgency input
 * References: CONTEXT.md:14-15, .omo/drafts/ai-inventory-expiry-advisor.md:27
 */

import type { Transaksi } from "../db/db";
import { db, DEFAULT_ORG_ID } from "../db/db";

/**
 * Hitung avg daily usage dari array Transaksi.
 *
 * @param transaksis - array transaksi (sudah ter-filter per SKU, idealnya last 14d via DB query)
 * @param manualFallback - nilai manual jika histori < daysWindow atau kosong; jika tidak diberikan dan histori kosong, return 0
 * @param daysWindow - window hari, default 14 (atau 30 jika ingin coba longer window)
 * @returns avg qty/hari, tidak pernah NaN/Infinity (fallback ke manualFallback atau 0)
 *
 * Spec: total qty_sold / days_with_history over last 14d
 *   - total = sum qty_sold
 *   - days_with_history = count distinct YYYY-MM-DD dari sold_at
 *   - avg = total / distinctDays
 *   - jika distinctDays < daysWindow dan manualFallback !== undefined → return manualFallback (MUST NOT hallucinate)
 *   - jika transaksis kosong → return manualFallback ?? 0
 */
export function calcAvgDailyUsage(
  transaksis: Transaksi[],
  manualFallback?: number,
  daysWindow: number = 14
): number {
  if (!transaksis || transaksis.length === 0) {
    return manualFallback ?? 0;
  }

  let total = 0;
  const distinct = new Set<string>();

  for (const t of transaksis) {
    const qty = typeof t.qty_sold === "number" ? t.qty_sold : 0;
    total += qty;
    // sold_at ISO datetime → YYYY-MM-DD
    // Gunakan UTC slice karena sold_at disimpan ISO; cukup untuk distinct day count
    // Jika sold_at sudah YYYY-MM-DD, slice tetap valid
    const soldAt = t.sold_at ?? "";
    let day: string;
    try {
      // Normal case: ISO datetime
      day = new Date(soldAt).toISOString().slice(0, 10);
      // Cek invalid date (NaN)
      if (day === "Invalid Date" || day.includes("Invalid")) {
        day = String(soldAt).slice(0, 10);
      }
    } catch {
      day = String(soldAt).slice(0, 10);
    }
    distinct.add(day);
  }

  const distinctDays = distinct.size;

  if (distinctDays === 0) {
    return manualFallback ?? 0;
  }

  // MUST NOT hallucinate: jika histori < daysWindow, pakai manual fallback jika ada
  if (distinctDays < daysWindow && manualFallback !== undefined) {
    return manualFallback;
  }

  const avg = total / Math.max(distinctDays, 1);
  if (!Number.isFinite(avg)) {
    return manualFallback ?? 0;
  }
  return avg;
}

/**
 * Helper alias untuk perhitungan per SKU.
 * Signature sama dengan calcAvgDailyUsage — caller sudah filter transaksis per SKU.
 * Disediakan sesuai permintaan TASK-08: export helper calcAvgForSKU.
 *
 * Jika ingin hitung via DB, gunakan calcAvgDailyUsageForSKU (async).
 */
export function calcAvgForSKU(
  transaksis: Transaksi[],
  manualFallback?: number,
  daysWindow: number = 14
): number {
  return calcAvgDailyUsage(transaksis, manualFallback, daysWindow);
}

/**
 * Async helper: ambil histori dari DB lalu hitung avg.
 * Query transaksis per SKU sejak `since` (default last 14d) via InventoryRepository pattern.
 * Jika histori kosong atau <14 hari, fallback manual.
 *
 * Tidak menulis ke DB (store per SKU tidak perlu DB tulis, cuma calc).
 *
 * @param sku_id - SKU id
 * @param manualFallback - fallback jika <14 hari atau kosong
 * @param daysWindow - window hari, default 14 (gunakan 30 jika ingin coba longer window)
 * @param org_id - org_id forward, default toko-01
 */
export async function calcAvgDailyUsageForSKU(
  sku_id: number,
  manualFallback?: number,
  daysWindow: number = 14,
  org_id: string = DEFAULT_ORG_ID
): Promise<number> {
  const since = new Date(Date.now() - daysWindow * 24 * 60 * 60 * 1000).toISOString();
  // Gunakan db langsung (Dexie) — local-first, single device, org_id toko-01
  // Filter via where + and (sesuai DexieRepository.listTransaksisBySKU)
  const list = await db.transaksis
    .where("sku_id")
    .equals(sku_id)
    .and((x) => x.org_id === org_id && x.sold_at >= since)
    .toArray();

  // Jika kosong dan daysWindow 14, coba 30d sebelum fallback (sesuai spec "or 30d if no data")
  if (list.length === 0 && daysWindow === 14) {
    const since30 = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
    const list30 = await db.transaksis
      .where("sku_id")
      .equals(sku_id)
      .and((x) => x.org_id === org_id && x.sold_at >= since30)
      .toArray();
    if (list30.length > 0) {
      // Hitung dengan window 30
      return calcAvgDailyUsage(list30, manualFallback, 30);
    }
  }

  return calcAvgDailyUsage(list, manualFallback, daysWindow);
}

// Re-export type for consumers
export type { Transaksi };
