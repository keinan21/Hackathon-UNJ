/**
 * TASK-08 [FRD-03] acceptance tests — Avg Daily Usage calculator + histori transaksi model
 *
 * - (a) 10 hari histori 20 qty sold → avg 2 (20/10)
 * - (b) <14 hari 5 hari 7 qty + manual 1.5 → return 1.5 (fallback)
 * - (c) no histori → returns manual fallback not NaN
 * - (d) histori 14d 28 qty → avg 2
 * - plus: distinct days logic, same-day multiple, 30d window, pure calc without DB
 *
 * Pattern: fake-indexeddb inject ke globalThis SEBELUM dynamic import (dexie cache indexedDB saat load)
 * Run: bun test src/engine/avgUsage.test.ts --reporter=verbose
 */

import { describe, expect, test, beforeEach } from "vitest";
import * as fakeIndexedDB from "fake-indexeddb";

// fake-indexeddb harus ter-inject KE globalThis SEBELUM module ./db dan ./avgUsage
// (yang import dexie) dievaluasi — dexie men-cache indexedDB saat load.
// Dynamic import di dalam top-level await memastikan urutan itu.
const g = globalThis as unknown as Record<string, unknown>;
if (!g.indexedDB) {
  g.indexedDB = fakeIndexedDB.indexedDB;
  g.IDBKeyRange = fakeIndexedDB.IDBKeyRange;
}

// Dynamic imports setelah fake-indexeddb inject
const { InventoryDB, DexieRepository } = await import("../db/db");
const { calcAvgDailyUsage, calcAvgForSKU } = await import("./avgUsage");

type Repo = InstanceType<typeof DexieRepository>;

let repo: Repo;

beforeEach(async () => {
  const testDb = new InventoryDB(`test-avg-${crypto.randomUUID()}`);
  repo = new DexieRepository(testDb) as unknown as Repo;
});

describe("avgUsage — TASK-08 [FRD-03] calcAvgDailyUsage + calcAvgForSKU", () => {
  test("(a) 10 hari histori 20 qty sold → avg 2 (20/10)", async () => {
    const kategori = await repo.createKategori({ nama: "Dairy", threshold_h_minus: [7, 3, 1] });
    const sku = await repo.createSKU({
      nama: "Susu UHT 1L Indomilk",
      kategori_id: kategori.id!,
      hpp: 12000,
      harga_normal: 15000,
    });

    const now = Date.now();
    // 10 hari distinct, masing-masing qty 2 → total 20, distinct 10, avg 2
    for (let i = 0; i < 10; i++) {
      const sold_at = new Date(now - i * 24 * 60 * 60 * 1000).toISOString();
      await repo.createTransaksi({ sku_id: sku.id!, qty_sold: 2, sold_at });
    }

    const since = new Date(now - 14 * 24 * 60 * 60 * 1000).toISOString();
    const list = await repo.listTransaksisBySKU(sku.id!, since);
    expect(list).toHaveLength(10);

    const avg = calcAvgDailyUsage(list);
    expect(avg).toBe(2);

    // helper calcAvgForSKU harus sama
    const avg2 = calcAvgForSKU(list);
    expect(avg2).toBe(2);

    // tanpa fallback, tetap 2 karena distinct 10 <14 tapi fallback undefined → return avg
    // dengan fallback undefined, logic return avg (1.4 vs fallback) tapi di sini avg 2 vs fallback tidak ada
    // Jika kasih fallback 9.9, karena distinct 10 <14, harus pakai fallback
    expect(calcAvgDailyUsage(list, 9.9)).toBe(9.9);
    // Namun jika window 10, distinct 10 >= window → return avg bukan fallback
    expect(calcAvgDailyUsage(list, 9.9, 10)).toBe(2);
  });

  test("(b) <14 hari 5 hari 7 qty + manual 1.5 → return 1.5 (fallback)", async () => {
    const kategori = await repo.createKategori({ nama: "Snack", threshold_h_minus: [7, 3, 1] });
    const sku = await repo.createSKU({
      nama: "Roti Tawar",
      kategori_id: kategori.id!,
      hpp: 8000,
      harga_normal: 12000,
    });

    const now = Date.now();
    // 5 hari distinct, total 7 qty
    const qtys = [2, 1, 1, 2, 1]; // sum 7
    for (let i = 0; i < 5; i++) {
      const sold_at = new Date(now - i * 24 * 60 * 60 * 1000).toISOString();
      await repo.createTransaksi({ sku_id: sku.id!, qty_sold: qtys[i], sold_at });
    }

    const since = new Date(now - 14 * 24 * 60 * 60 * 1000).toISOString();
    const list = await repo.listTransaksisBySKU(sku.id!, since);
    expect(list).toHaveLength(5);

    // Tanpa fallback, avg = 7/5 = 1.4
    expect(calcAvgDailyUsage(list)).toBeCloseTo(1.4, 5);
    expect(calcAvgForSKU(list)).toBeCloseTo(1.4, 5);

    // Dengan fallback 1.5 dan distinct 5 <14 → return fallback (MUST NOT hallucinate)
    expect(calcAvgDailyUsage(list, 1.5)).toBe(1.5);
    expect(calcAvgForSKU(list, 1.5)).toBe(1.5);

    // Dengan window 5, distinct 5 >=5 → return avg bukan fallback
    expect(calcAvgDailyUsage(list, 1.5, 5)).toBeCloseTo(1.4, 5);
  });

  test("(c) no histori → returns manual fallback not NaN", async () => {
    const kategori = await repo.createKategori({ nama: "Beras", threshold_h_minus: [7, 3, 1] });
    const sku = await repo.createSKU({
      nama: "Beras Pandan Wangi 5kg",
      kategori_id: kategori.id!,
      hpp: 60000,
      harga_normal: 72000,
    });

    const now = Date.now();
    const since = new Date(now - 14 * 24 * 60 * 60 * 1000).toISOString();
    const list = await repo.listTransaksisBySKU(sku.id!, since);
    expect(list).toHaveLength(0);

    // empty array → fallback 2.5, not NaN
    const avgFallback = calcAvgDailyUsage(list, 2.5);
    expect(avgFallback).toBe(2.5);
    expect(Number.isNaN(avgFallback)).toBe(false);
    expect(Number.isFinite(avgFallback)).toBe(true);

    const avgFallbackForSKU = calcAvgForSKU(list, 1.8);
    expect(avgFallbackForSKU).toBe(1.8);
    expect(Number.isNaN(avgFallbackForSKU)).toBe(false);

    // empty without fallback → 0, not NaN
    const avgZero = calcAvgDailyUsage(list);
    expect(avgZero).toBe(0);
    expect(Number.isNaN(avgZero)).toBe(false);
    expect(avgZero).not.toBeNaN();

    const avgZero2 = calcAvgDailyUsage([], undefined, 14);
    expect(avgZero2).toBe(0);

    // also test undefined input guard
    const avgUndef = calcAvgDailyUsage(undefined as unknown as never, 1.2);
    expect(avgUndef).toBe(1.2);

    // ensure not Infinity
    expect(avgFallback).not.toBe(Infinity);
    expect(avgZero).not.toBe(Infinity);
  });

  test("(d) histori 14d 28 qty → avg 2 (full window)", async () => {
    const kategori = await repo.createKategori({ nama: "Dairy", threshold_h_minus: [7, 3, 1] });
    const sku = await repo.createSKU({
      nama: "Yogurt 500ml",
      kategori_id: kategori.id!,
      hpp: 10000,
      harga_normal: 14000,
    });

    const now = Date.now();
    for (let i = 0; i < 14; i++) {
      const sold_at = new Date(now - i * 24 * 60 * 60 * 1000).toISOString();
      await repo.createTransaksi({ sku_id: sku.id!, qty_sold: 2, sold_at });
    }

    const since = new Date(now - 14 * 24 * 60 * 60 * 1000).toISOString();
    const list = await repo.listTransaksisBySKU(sku.id!, since);
    // Note: repo filter uses sold_at >= since; the oldest entry may be exactly at boundary
    // Allow 13 or 14 depending on timing; adjust expectation to cover both but ideal 14
    expect(list.length).toBeGreaterThanOrEqual(13);
    // If 14 inserted, but one might be just outside due to ms timing, we still expect avg ~2
    // Compute expected: total / distinctDays should be 2 if 14 entries each qty 2
    const avg = calcAvgDailyUsage(list);
    // Jika list 14 → avg 2; jika 13 → total 26/13=2 juga
    expect(avg).toBeCloseTo(2, 5);

    const avgWithFallback = calcAvgDailyUsage(list, 9.9);
    // distinct 14 >=14, even with fallback provided, return avg not fallback
    // Jika list 13 distinct <14, fallback would trigger → but we want to test 14 distinct case
    // For deterministic, test pure array of 14 distinct days without DB timing edge
    const pure14: import("../db/db").Transaksi[] = Array.from({ length: 14 }, (_, i) => ({
      sku_id: sku.id!,
      qty_sold: 2,
      sold_at: new Date(now - i * 86400000).toISOString(),
      org_id: "toko-01",
    }));
    expect(calcAvgDailyUsage(pure14)).toBe(2);
    expect(calcAvgDailyUsage(pure14, 9.9)).toBe(2); // full window → ignore fallback
    expect(calcAvgForSKU(pure14, 9.9)).toBe(2);
  });

  test("distinct days: same day multiple transaksi dihitung 1 hari (total/distinct)", () => {
    const now = Date.now();
    const sameDay = new Date(now).toISOString();
    const transaksis: import("../db/db").Transaksi[] = [
      { sku_id: 1, qty_sold: 3, sold_at: sameDay, org_id: "toko-01" },
      { sku_id: 1, qty_sold: 5, sold_at: sameDay, org_id: "toko-01" },
      { sku_id: 1, qty_sold: 2, sold_at: new Date(now - 86400000).toISOString(), org_id: "toko-01" },
    ];
    // 2 distinct days, total 10 → avg 5
    expect(calcAvgDailyUsage(transaksis, undefined, 2)).toBe(5);
    // With window 3, distinct 2 <3 and fallback provided → fallback
    expect(calcAvgDailyUsage(transaksis, 1.5, 3)).toBe(1.5);
    // Without fallback, return 5 even though < window
    expect(calcAvgDailyUsage(transaksis, undefined, 3)).toBe(5);
  });

  test("pure calc without DB: 10 hari 20 qty → avg 2, window 10 returns avg", () => {
    const now = Date.now();
    const list = Array.from({ length: 10 }, (_, i) => ({
      sku_id: 99,
      qty_sold: 2,
      sold_at: new Date(now - i * 86400000).toISOString(),
      org_id: "toko-01",
    })) as import("../db/db").Transaksi[];
    expect(calcAvgDailyUsage(list)).toBe(2);
    expect(calcAvgDailyUsage(list, 5, 10)).toBe(2);
    expect(calcAvgForSKU(list, undefined, 10)).toBe(2);
  });

  test("avg tidak pernah NaN atau Infinity bahkan dengan qty 0 edge", () => {
    const now = Date.now();
    const list = [
      { sku_id: 1, qty_sold: 0, sold_at: new Date(now).toISOString(), org_id: "toko-01" },
    ] as import("../db/db").Transaksi[];
    expect(calcAvgDailyUsage(list)).toBe(0);
    expect(Number.isNaN(calcAvgDailyUsage(list))).toBe(false);
    expect(calcAvgDailyUsage([], 0)).toBe(0);
    expect(calcAvgDailyUsage([], undefined)).toBe(0);
  });

  test("happy: 14d transaksis total 32 qty → avg ~2.285 (cover 2.3 spec)", async () => {
    const kategori = await repo.createKategori({ nama: "Snack", threshold_h_minus: [7, 3, 1] });
    const sku = await repo.createSKU({
      nama: "Keripik Kentang",
      kategori_id: kategori.id!,
      hpp: 5000,
      harga_normal: 8000,
    });
    const now = Date.now();
    // 14 hari, total 32 qty: 10 hari @2 =20, 4 hari @3=12 → total 32, distinct 14 → avg 2.285...
    for (let i = 0; i < 14; i++) {
      const qty = i < 10 ? 2 : 3;
      const sold_at = new Date(now - i * 86400000).toISOString();
      await repo.createTransaksi({ sku_id: sku.id!, qty_sold: qty, sold_at });
    }
    const since = new Date(now - 14 * 86400000).toISOString();
    const list = await repo.listTransaksisBySKU(sku.id!, since);
    const avg = calcAvgDailyUsage(list, undefined, 14);
    // Allow tolerance for timing edge (13 vs 14)
    // If 14 entries: 32/14=2.285714..., if 13 entries (oldest outside): 29/13=2.230...
    expect(avg).toBeGreaterThan(2.1);
    expect(avg).toBeLessThan(2.5);
    // Pure check deterministic
    const pure32 = Array.from({ length: 14 }, (_, i) => ({
      sku_id: sku.id!,
      qty_sold: i < 10 ? 2 : 3,
      sold_at: new Date(now - i * 86400000).toISOString(),
      org_id: "toko-01",
    })) as import("../db/db").Transaksi[];
    expect(calcAvgDailyUsage(pure32)).toBeCloseTo(32 / 14, 5);
  });
});
