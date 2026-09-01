/**
 * TASK-09 [FRD-03] — Expiry engine: days_to_expiry + urgencyScore deterministik
 *
 * Rule deterministik, bukan LLM (CONTEXT.md + FRD-03).
 * - daysToExpiry: ceil((expiry_date - startOfDay(Asia/Jakarta)) / 86400000)
 *   Batch dengan expiry_date null → return null (skip engine, non-perishable)
 * - urgencyScore: qty * days_to_expiry / max(avg_daily_usage, 1)
 *   lower / more negative = more urgent, jika avg 0 pakai 1 agar tidak Infinity
 * - sortByUrgency: sort ascending urgencyScore, skip expiry null
 *
 * TZ handling: TIDAK pakai date-fns-tz (tidak ada di deps), pakai Intl.DateTimeFormat
 * dengan timeZone Asia/Jakarta untuk startOfDay. Jakarta UTC+7 fixed (tanpa DST).
 *
 * Trace: TASK-09 [FRD-03] — FRD-03 F3 Expiry Engine dan Notifikasi
 * References: CONTEXT.md:12-15, docs/frd/frd-03-expiry.md, docs/adr/0002-langchain-gemini-hybrid-advisor.md:7
 */

/**
 * Jakarta offset fixed UTC+7 (tanpa DST). Dipakai untuk ubah kalender Jakarta ke UTC timestamp.
 * Midnight Jakarta = UTC hari itu 00:00 minus 7 jam = previous day 17:00 UTC.
 */
const JAKARTA_OFFSET_MS = 7 * 60 * 60 * 1000;

/**
 * Ambil startOfDay untuk tanggal `d` dalam kalender Asia/Jakarta.
 * - Ekstrak year/month/day via Intl.DateTimeFormat timeZone Asia/Jakarta
 * - Kembalikan Date UTC yang merepresentasikan 00:00 Jakarta hari tersebut
 *
 * Contoh: d = 2026-09-02T10:00:00+07:00 (WIB) → return 2026-09-02T00:00:00+07:00 (yakni 2026-09-01T17:00:00Z)
 */
export function toJakartaStartOfDay(d: Date): Date {
  const fmt = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Jakarta",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
  const parts = fmt.formatToParts(d);
  const year = Number(parts.find((p) => p.type === "year")!.value);
  const month = Number(parts.find((p) => p.type === "month")!.value);
  const day = Number(parts.find((p) => p.type === "day")!.value);
  // Date.UTC(y,m-1,d) adalah midnight UTC, minus 7h = midnight Jakarta
  return new Date(Date.UTC(year, month - 1, day, 0, 0, 0, 0) - JAKARTA_OFFSET_MS);
}

/**
 * Parse expiry_date string "YYYY-MM-DD" (atau ISO "YYYY-MM-DDTHH:mm:ss") ke Jakarta midnight UTC.
 * Support juga kalau expiry_date sudah "YYYY-MM-DD" saja.
 */
function expiryDateToJakartaMidnight(expiry_date: string): Date {
  // Ambil YYYY-MM-DD prefix (10 char pertama), validasi
  const s = expiry_date.slice(0, 10);
  const y = Number(s.slice(0, 4));
  const m = Number(s.slice(5, 7));
  const d = Number(s.slice(8, 10));
  if (!Number.isFinite(y) || !Number.isFinite(m) || !Number.isFinite(d)) {
    // Fallback: coba parse sebagai Date lalu ambil Jakarta startOfDay-nya
    // Ini jaga-jaga kalau format tak terduga, tapi tetap basis Jakarta
    const parsed = new Date(expiry_date);
    if (!Number.isNaN(parsed.getTime())) {
      return toJakartaStartOfDay(parsed);
    }
    // Jika tetap invalid, return Invalid Date (caller akan hasil NaN, tapi expiry_date valid per DB)
    return new Date(NaN);
  }
  return new Date(Date.UTC(y, m - 1, d, 0, 0, 0, 0) - JAKARTA_OFFSET_MS);
}

/**
 * Hitung daysToExpiry.
 *
 * - Jika expiry_date null → return null (non-perishable, skip engine)
 * - Jika expiry_date string kosong/invalid → return null
 * - today opsional (default now), di-normalize ke startOfDay Asia/Jakarta via toJakartaStartOfDay
 * - expiry_date di-normalize ke midnight Jakarta via expiryDateToJakartaMidnight
 * - Rumus: Math.ceil((expiryMidnight - todayMidnight) / 86400000)
 *
 * @param expiry_date - string "YYYY-MM-DD" atau null
 * @param today - Date acuan (default new Date()). Boleh pukul berapa saja, akan di-round ke 00:00 Jakarta
 * @returns number | null
 */
export function daysToExpiry(expiry_date: string | null, today?: Date): number | null {
  if (expiry_date === null || expiry_date === undefined) return null;
  const trimmed = String(expiry_date).trim();
  if (trimmed === "" || trimmed.toLowerCase() === "null") return null;

  const todayMidnight = toJakartaStartOfDay(today ?? new Date());
  const expiryMidnight = expiryDateToJakartaMidnight(trimmed);

  if (Number.isNaN(expiryMidnight.getTime()) || Number.isNaN(todayMidnight.getTime())) {
    return null;
  }

  const diffMs = expiryMidnight.getTime() - todayMidnight.getTime();
  return Math.ceil(diffMs / 86400000);
}

/**
 * Hitung urgencyScore deterministik.
 * Formula FRD-03 + CONTEXT.md: qty * days_to_expiry / max(avg_daily_usage, 1)
 * - Semakin kecil (atau negatif) semakin urgent
 * - Jika avgDailyUsage 0 atau negatif, pakai 1 agar tidak Infinity / NaN
 *
 * @param qty - stok Batch
 * @param days - daysToExpiry (bisa negatif untuk kadaluarsa)
 * @param avgDailyUsage - avg harian SKU (fallback minimal 1)
 */
export function urgencyScore(qty: number, days: number, avgDailyUsage: number): number {
  const denom = Math.max(avgDailyUsage, 1);
  return (qty * days) / denom;
}

// ---------------------------------------------------------------------------
// Sort helper — deterministic, skip expiry null
// ---------------------------------------------------------------------------

export type UrgencyItem = {
  qty: number;
  days: number | null;
  // Support both naming: avg (TASK-09 prompt) dan avgDailyUsage (CONTEXT)
  avg: number;
  avgDailyUsage?: number;
};

/**
 * Helper: ambil nilai avg yang benar dari item (support avg atau avgDailyUsage)
 */
function resolveAvg(item: Record<string, unknown>): number {
  if (typeof item.avgDailyUsage === "number" && Number.isFinite(item.avgDailyUsage as number)) {
    return item.avgDailyUsage as number;
  }
  if (typeof item.avg === "number" && Number.isFinite(item.avg as number)) {
    return item.avg as number;
  }
  // Fallback kalau field bernama lain (misal avg_daily_usage)
  if (typeof (item as Record<string, unknown>).avg_daily_usage === "number") {
    return (item as Record<string, unknown>).avg_daily_usage as number;
  }
  return 1;
}

/**
 * Sort helper deterministik.
 * - Filter item dengan days === null (expiry null → skip engine)
 * - Hitung urgencyScore per item
 * - Sort ascending: paling urgent (score terkecil / paling negatif) di atas
 * - Return array baru (tidak mutasi input), stabil sort (pertahankan urutan asal jika score sama)
 */
export function sortByUrgency<T extends Record<string, any>>(items: T[]): T[] {
  // Filter skip expiry null sebelum sort
  const filtered = items.filter((it) => {
    const d = (it as { days?: number | null }).days;
    return d !== null && d !== undefined;
  });

  // Buat copy + simpan index asal untuk stabil sort
  const indexed = filtered.map((item, idx) => {
    const qty = (item as unknown as { qty: number }).qty;
    const days = (item as unknown as { days: number }).days;
    const avg = resolveAvg(item as Record<string, unknown>);
    const score = urgencyScore(qty, days, avg);
    return { item, score, idx };
  });

  indexed.sort((a, b) => {
    if (a.score !== b.score) return a.score - b.score;
    return a.idx - b.idx; // stabil
  });

  return indexed.map((x) => x.item);
}
