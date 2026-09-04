/**
 * TASK-29 — Arus 14 hari helper (dipakai ChartArus + SkuDetailPage + future statistik)
 *
 * Agregasi murni dari DB, bukan LLM. Dipindahkan dari SkuDetailPage agar tidak duplikasi.
 *
 * Konvensi Jakarta: semua tanggal string "YYYY-MM-DD" adalah kalender Asia/Jakarta.
 * - build14DaysJakarta(): 14 tanggal Jakarta [today-13 .. today] format YYYY-MM-DD
 * - formatJakarta(date): tanggal Jakarta YYYY-MM-DD dari Date/ISO
 * - aggregateArus14(transaksis, sku, fourteenDays): masukPerDay / keluarPerDay / marginPerDay
 * - bepIndexFromMargin(marginPerDay): titik pertama kumulatif >=0 atau null
 */

import type { Transaksi, SKU } from "../db/types";

const JAKARTA_OFFSET_MS = 7 * 60 * 60 * 1000;

export function formatJakarta(date: Date): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Jakarta",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}

function getTodayJakartaParts(): { y: number; m: number; d: number } {
  const fmt = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Jakarta",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
  const parts = fmt.formatToParts(new Date());
  return {
    y: Number(parts.find((p) => p.type === "year")!.value),
    m: Number(parts.find((p) => p.type === "month")!.value),
    d: Number(parts.find((p) => p.type === "day")!.value),
  };
}

export function build14DaysJakarta(): string[] {
  const { y, m, d } = getTodayJakartaParts();
  const baseUTC = Date.UTC(y, m - 1, d, 0, 0, 0, 0) - JAKARTA_OFFSET_MS;
  const days: string[] = [];
  for (let i = 0; i < 14; i++) {
    const delta = i - 13;
    const utc = baseUTC + delta * 86_400_000;
    const dt = new Date(utc);
    days.push(formatJakarta(dt));
  }
  return days;
}

export function formatDayLabelDDMM(isoDate: string): string {
  // isoDate YYYY-MM-DD → DD-MM
  return isoDate.slice(8, 10) + "-" + isoDate.slice(5, 7);
}

export type Arus14Result = {
  masukPerDay: number[];
  keluarPerDay: number[];
  marginPerDay: number[];
  days: string[];
};

/**
 * Agregasi 14 hari. Margin harian = Σ(harga_jual_snapshot − sku.hpp)×qty keluar.
 * Fallback harga_jual_snapshot → sku.harga_normal bila null/0, hpp → sku.hpp.
 */
export function aggregateArus14(
  transaksis: Transaksi[],
  sku: Pick<SKU, "hpp" | "harga_normal">,
  fourteenDays: string[],
): Arus14Result {
  const masukPerDay: number[] = Array(14).fill(0);
  const keluarPerDay: number[] = Array(14).fill(0);
  const marginPerDay: number[] = Array(14).fill(0);
  const dayIndexMap = new Map(fourteenDays.map((d, i) => [d, i]));

  for (const t of transaksis) {
    let day: string;
    try {
      day = formatJakarta(new Date(t.sold_at));
    } catch {
      continue;
    }
    const idx = dayIndexMap.get(day);
    if (idx === undefined) continue;
    const j = (t.jenis ?? "keluar") as string;
    const qty = typeof t.qty_sold === "number" ? t.qty_sold : 0;
    if (j === "masuk") {
      masukPerDay[idx] += qty;
    } else if (j === "keluar") {
      keluarPerDay[idx] += qty;
      const hargaJual =
        t.harga_jual_snapshot != null && t.harga_jual_snapshot > 0
          ? t.harga_jual_snapshot
          : sku.harga_normal;
      const hppSnap = sku.hpp;
      const margin = (hargaJual - hppSnap) * qty;
      marginPerDay[idx] += margin;
    }
  }

  return { masukPerDay, keluarPerDay, marginPerDay, days: fourteenDays };
}

export function bepIndexFromMargin(marginPerDay: number[]): number | null {
  let cum = 0;
  for (let i = 0; i < marginPerDay.length; i++) {
    cum += marginPerDay[i];
    if (cum >= 0) return i;
  }
  return null;
}

export function kumulatifMargin(marginPerDay: number[]): number[] {
  const out: number[] = [];
  let cum = 0;
  for (const m of marginPerDay) {
    cum += m;
    out.push(cum);
  }
  return out;
}
