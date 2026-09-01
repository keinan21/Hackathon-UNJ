/**
 * TASK-09 [FRD-03] acceptance tests — Expiry engine: days_to_expiry + urgencyScore
 *
 * Acceptance dari TASK.md:213-222
 * - daysToExpiry 2026-09-05 from 2026-09-02 =3
 * - expiry null → null
 * - urgencyScore 10*3/2=15
 * - negative days -2 → -10
 * - avg 0 → divisor 1 not Infinity
 * - 5 batches sorted by urgency
 *
 * Plus edge: toJakartaStartOfDay, ceil, Jakarta TZ not UTC
 *
 * Pure function test — tidak butuh fake-indexeddb inject karena expiry.ts tidak import Dexie.
 * Tapi tetap sediakan inject guard jika suatu saat import Dexie (konsisten dengan avgUsage.test.ts pattern).
 * Run: bun test src/engine/expiry.test.ts --reporter=verbose
 */

import { describe, expect, test } from "vitest";
import { daysToExpiry, urgencyScore, sortByUrgency, toJakartaStartOfDay } from "./expiry";

describe("expiry — TASK-09 [FRD-03] daysToExpiry + urgencyScore deterministik", () => {
  // Helper bikin today di Jakarta midnight
  function jakartaDate(isoDate: string, time = "00:00:00"): Date {
    // isoDate "YYYY-MM-DD" → buat Date di timezone Jakarta
    // Kita buat via +07:00 offset agar jelas Jakarta
    return new Date(`${isoDate}T${time}+07:00`);
  }

  test("daysToExpiry 2026-09-05 from 2026-09-02 =3 (Gherkin FRD-03)", () => {
    const today = jakartaDate("2026-09-02");
    // Also test via Date UTC "2026-09-02" plain (masih harus 3 karena Jakarta startOfDay)
    expect(daysToExpiry("2026-09-05", today)).toBe(3);

    // Versi tanpa wiring Jakarta offset, tetap 3
    const todayUTC = new Date("2026-09-02T00:00:00Z"); // 07:00 Jakarta same day
    expect(daysToExpiry("2026-09-05", todayUTC)).toBe(3);

    // Versi jam 10 pagi Jakarta, tetap 3 (karena startOfDay)
    const today10 = jakartaDate("2026-09-02", "10:00:00");
    expect(daysToExpiry("2026-09-05", today10)).toBe(3);

    // Versi jam 23:59 Jakarta, tetap 3
    const todayLate = jakartaDate("2026-09-02", "23:59:59");
    expect(daysToExpiry("2026-09-05", todayLate)).toBe(3);
  });

  test("expiry null → null (skip engine, non-perishable)", () => {
    const today = jakartaDate("2026-09-02");
    expect(daysToExpiry(null, today)).toBeNull();
    // string empty also null
    expect(daysToExpiry("", today)).toBeNull();
    // string "null" also
    expect(daysToExpiry("null" as any, today)).toBeNull();

    // Without today param (default now), expiry null still null
    expect(daysToExpiry(null)).toBeNull();
  });

  test("urgencyScore 10*3/2=15 (FRD-03)", () => {
    expect(urgencyScore(10, 3, 2)).toBe(15);
    // juga via qty 5 days 4 avg 0 → 20
    expect(urgencyScore(5, 4, 0)).toBe(20);
    // qty 10 days 3 avg 2 → 15 via formula
    const score = 10 * 3 / Math.max(2, 1);
    expect(urgencyScore(10, 3, 2)).toBe(score);
  });

  test("negative days -2 → -10 (lebih urgent dari positif)", () => {
    // Batch A: qty 10 days -2 avg 2 → -10
    // Batch B: qty 10 days 5 avg 2 → 25
    expect(urgencyScore(10, -2, 2)).toBe(-10);
    expect(urgencyScore(10, 5, 2)).toBe(25);
    expect(urgencyScore(10, -2, 2)).toBeLessThan(urgencyScore(10, 5, 2));

    // daysToExpiry negative case: expiry kemarin
    const today = jakartaDate("2026-09-02");
    expect(daysToExpiry("2026-08-31", today)).toBe(-2);
    expect(daysToExpiry("2026-09-01", today)).toBe(-1);
    expect(daysToExpiry("2026-09-02", today)).toBe(0);
    expect(daysToExpiry("2026-09-03", today)).toBe(1);
  });

  test("avg 0 → divisor 1 not Infinity (guard FRD-03)", () => {
    // avg 0 harus pakai 1, jadi 5*4/1=20 bukan Infinity
    expect(urgencyScore(5, 4, 0)).toBe(20);
    expect(Number.isFinite(urgencyScore(5, 4, 0))).toBe(true);
    expect(urgencyScore(5, 4, 0)).not.toBe(Infinity);

    // avg negatif juga pakai 1
    expect(urgencyScore(5, 4, -3)).toBe(20);

    // via sort, avg 0 tetap terhitung
    const items = [
      { qty: 5, days: 4, avg: 0 }, // score 20
      { qty: 10, days: 3, avg: 2 }, // score 15 → lebih urgent
    ];
    const sorted = sortByUrgency(items);
    expect(sorted[0].qty).toBe(10); // 15 < 20
    expect(sorted[1].qty).toBe(5);
  });

  test("5 batches sorted by urgency (paling urgent di atas, ascending)", () => {
    // Buat 5 batch variasi: qty, days, avg → score
    // A: 10*1/2=5 (paling urgent)
    // B: 20*1/2=10
    // C: 10*3/2=15
    // D: 5*4/1=20 (avg 0 → 1)
    // E: 10*5/2=25 (paling tidak urgent)
    const batches = [
      { id: "C", qty: 10, days: 3, avg: 2, sku: "Susu C" }, // 15
      { id: "E", qty: 10, days: 5, avg: 2, sku: "Susu E" }, // 25
      { id: "A", qty: 10, days: 1, avg: 2, sku: "Susu A" }, // 5
      { id: "D", qty: 5, days: 4, avg: 0, sku: "Susu D" }, // 20
      { id: "B", qty: 20, days: 1, avg: 2, sku: "Susu B" }, // 10
    ];
    const sorted = sortByUrgency(batches);
    expect(sorted.map((b) => b.id)).toEqual(["A", "B", "C", "D", "E"]);
    // Pastikan tidak mutasi original (order original tetap C,E,A,D,B)
    expect(batches[0].id).toBe("C");

    // Versi dengan Batch expiry null harus di-skip
    const withNull = [
      { id: "X", qty: 100, days: null as any, avg: 2 },
      { id: "A", qty: 10, days: 1, avg: 2 },
      { id: "B", qty: 20, days: 1, avg: 2 },
    ];
    const sorted2 = sortByUrgency(withNull as any);
    expect(sorted2.map((b: any) => b.id)).toEqual(["A", "B"]);
    expect(sorted2).not.toContainEqual(expect.objectContaining({ id: "X" }));
  });

  test("toJakartaStartOfDay: ceil & Jakarta TZ not UTC", () => {
    // Kunci: hari yang sama di Jakarta walaupun beda UTC
    // 2026-09-02 01:00 UTC = 2026-09-02 08:00 Jakarta → startOfDay tetap 2026-09-02 Jakarta
    const utc0100 = new Date("2026-09-02T01:00:00Z");
    const jakartaStart = toJakartaStartOfDay(utc0100);
    // jakartaStart harus 2026-09-01T17:00:00Z (midnight 2026-09-02 Jakarta)
    expect(jakartaStart.toISOString()).toBe("2026-09-01T17:00:00.000Z");

    // Masa transisi hari: 2026-09-01 23:00 UTC = 2026-09-02 06:00 Jakarta → masih 02 Sept
    const lateUTC = new Date("2026-09-01T18:00:00Z"); // 01:00 Jakarta next day? actually 01:00 +07
    // 2026-09-01T18:00Z = 2026-09-02T01:00+07:00 → startOfDay 02 Sept
    expect(toJakartaStartOfDay(lateUTC).toISOString()).toBe("2026-09-01T17:00:00.000Z");

    // Beda zona: cek expiry vs today diff pakai Jakarta, bukan UTC
    // Kalau pakai UTC, 2026-09-02 UTC vs expiry 2026-09-05 UTC diff 3 → sama kebetulan
    // Tapi test untuk memastikan fungsi pakai Jakarta:
    // 2026-09-02T16:00Z = 2026-09-02 23:00 Jakarta, expiry 2026-09-03 Jakarta harus 1 hari
    const todayLate = new Date("2026-09-02T16:00:00Z"); // 23:00 Jakarta 02 Sept
    expect(daysToExpiry("2026-09-03", todayLate)).toBe(1);
    // Kalau pakai UTC startOfDay, todayLate UTC date 02 Sept midnight UTC → expiry 03 Sept midnight UTC diff 1 juga → sama
    // Test lebih ketat: today 2026-09-02T17:00Z = 2026-09-03 00:00 Jakarta → expiry 03 Sept harus 0 (hari yang sama Jakarta)
    const todayNextDayJakarta = new Date("2026-09-02T17:00:00Z"); // midnight 03 Sept Jakarta
    expect(daysToExpiry("2026-09-03", todayNextDayJakarta)).toBe(0);
    // Kalau salah pakai UTC, todayNextDayJakarta UTC masih 02 Sept → diff 1 (salah)
    expect(daysToExpiry("2026-09-03", new Date("2026-09-02T17:00:00Z"))).toBe(0);
  });

  test("sortByUrgency support avgDailyUsage naming + stabil + tidak mutasi", () => {
    // Test dengan avgDailyUsage bukan avg
    const items = [
      { qty: 10, days: 2, avgDailyUsage: 2, id: "B" }, // 10
      { qty: 10, days: 1, avgDailyUsage: 2, id: "A" }, // 5
    ];
    const sorted = sortByUrgency(items as any);
    expect(sorted[0].id).toBe("A");
    expect(sorted[1].id).toBe("B");

    // Stabil: score sama urutan asal dipertahankan
    const tie = [
      { qty: 10, days: 2, avg: 2, id: "first" }, // 10
      { qty: 20, days: 1, avg: 2, id: "second" }, // 10
      { qty: 5, days: 4, avg: 2, id: "third" }, // 10
    ];
    const sortedTie = sortByUrgency(tie);
    expect(sortedTie.map((x) => x.id)).toEqual(["first", "second", "third"]);
  });

  test("daysToExpiry edge: expiry sama dengan today → 0, besok → 1, kemarin → -1", () => {
    const today = jakartaDate("2026-09-02");
    expect(daysToExpiry("2026-09-02", today)).toBe(0);
    expect(daysToExpiry("2026-09-03", today)).toBe(1);
    expect(daysToExpiry("2026-09-01", today)).toBe(-1);
    expect(daysToExpiry("2026-08-30", today)).toBe(-3);
  });

  test("urgencyScore deterministik & pure (no LLM, no side effect)", () => {
    // Panggil 2x hasil sama
    expect(urgencyScore(10, 3, 2)).toBe(urgencyScore(10, 3, 2));
    // Formula exact
    expect(urgencyScore(7, 5, 3)).toBeCloseTo((7 * 5) / 3, 10);
    expect(urgencyScore(7, 5, 0)).toBe(35); // 7*5/1
  });
});
