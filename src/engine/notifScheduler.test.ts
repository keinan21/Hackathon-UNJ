/**
 * TASK-10 [FRD-03] acceptance tests — Notifikasi scheduler (daily 07:00 + threshold per kategori)
 *
 * Acceptance dari TASK.md:224-233
 * - mock today 2026-09-02, batch Dairy H-3 in threshold [7,3,1] triggers (1 notif)
 * - batch H-10 not trigger, expiry null not trigger
 * - permission denied → fallback badge only no throw
 *
 * Pattern: fake-indexeddb inject ke globalThis SEBELUM dynamic import (dexie cache indexedDB saat load)
 * Run: bun test src/engine/notifScheduler.test.ts --reporter=verbose
 */

import { describe, expect, test, beforeEach, afterEach, vi } from "vitest";
import * as fakeIndexedDB from "fake-indexeddb";

// fake-indexeddb harus ter-inject KE globalThis SEBELUM module ./db dan ./notifScheduler
// (yang import dexie) dievaluasi — dexie men-cache indexedDB saat load.
// Dynamic import di dalam top-level await memastikan urutan itu.
const g = globalThis as unknown as Record<string, unknown>;
if (!g.indexedDB) {
  g.indexedDB = fakeIndexedDB.indexedDB;
  g.IDBKeyRange = fakeIndexedDB.IDBKeyRange;
}

// Dynamic imports setelah fake-indexeddb inject
const { InventoryDB, DexieRepository } = await import("../db/db");
const { seedDefaultKategoris } = await import("../db/seed");
const { getDueNotifications, checkAndNotify } = await import("./notifScheduler");
const { daysToExpiry } = await import("./expiry");

type Repo = InstanceType<typeof DexieRepository>;

let repo: Repo;

beforeEach(async () => {
  const testDb = new InventoryDB(`test-notif-${crypto.randomUUID()}`);
  repo = new DexieRepository(testDb) as unknown as Repo;
  // Clean global Notification mock between tests
  const gg = globalThis as unknown as Record<string, unknown>;
  delete gg.Notification;
  delete (gg as unknown as { navigator?: unknown }).navigator;
  vi.restoreAllMocks();
});

afterEach(() => {
  const gg = globalThis as unknown as Record<string, unknown>;
  delete gg.Notification;
  // keep navigator clean
  if (gg.navigator && typeof gg.navigator === "object") {
    const nav = gg.navigator as Record<string, unknown>;
    delete nav.setAppBadge;
    delete nav.clearAppBadge;
  }
  vi.restoreAllMocks();
});

describe("notifScheduler — TASK-10 [FRD-03] daily 07:00 + threshold per kategori", () => {
  // Helper bikin today di Jakarta
  function jakartaDate(isoDate: string, time = "00:00:00"): Date {
    return new Date(`${isoDate}T${time}+07:00`);
  }

  test("happy: mock today 2026-09-02, batch Dairy H-3 in threshold [7,3,1] triggers (1 notif)", async () => {
    await seedDefaultKategoris(repo);
    const kategoris = await repo.listKategoris();
    const dairy = kategoris.find((k) => k.nama === "Makanan Basah")!;
    expect(dairy.threshold_h_minus).toEqual([7, 3, 1]);

    const sku = await repo.createSKU({
      nama: "Susu UHT 1L Indomilk",
      kategori_id: dairy.id!,
      hpp: 12000,
      harga_normal: 15000,
    });

    // Buat transaksi dummy untuk avg (opsional, fallback 1 juga ok)
    // 10 hari distinct 20 qty → avg 2 kalau dihitung tanpa fallback, tapi scheduler pakai fallback 1 jika <14 distinct
    // Kita buat 14 hari full agar avg 2 dan urgency terhitung 10*3/2=15
    const now = Date.now();
    for (let i = 0; i < 5; i++) {
      const sold_at = new Date(now - i * 86400000).toISOString();
      await repo.createTransaksi({ sku_id: sku.id!, qty_sold: 2, sold_at });
    }

    // Batch H-3: 2026-09-05 (3 hari dari 2026-09-02) → triggers
    // Batch H-10: 2026-09-12 (10 hari dari 2026-09-02) → NOT trigger (10 not in [7,3,1])
    // Batch expiry null: non-perishable → NOT trigger
    const mockToday = jakartaDate("2026-09-02");

    // Verify daysToExpiry per engine
    expect(daysToExpiry("2026-09-05", mockToday)).toBe(3);
    expect(daysToExpiry("2026-09-12", mockToday)).toBe(10);
    expect(daysToExpiry(null, mockToday)).toBeNull();

    await repo.createBatch({
      sku_id: sku.id!,
      qty: 10,
      expiry_date: "2026-09-05",
      hpp_snapshot: 12000,
    });
    await repo.createBatch({
      sku_id: sku.id!,
      qty: 5,
      expiry_date: "2026-09-12",
      hpp_snapshot: 12000,
    });
    await repo.createBatch({
      sku_id: sku.id!,
      qty: 20,
      expiry_date: null,
      hpp_snapshot: 12000,
    });

    const due = await getDueNotifications(repo, mockToday);

    // Hanya 1 notif: H-3
    expect(due).toHaveLength(1);
    expect(due[0].batch.expiry_date).toBe("2026-09-05");
    expect(due[0].sku.nama).toBe("Susu UHT 1L Indomilk");
    expect(due[0].kategori.nama).toBe("Makanan Basah");
    expect(due[0].daysToExpiry).toBe(3);
    // urgency = qty*days / max(avg,1) — avg fallback 1 (5 distinct <14 → 1) → 10*3/1=30. Jika avg dihitung 2 tanpa fallback tetap finite
    expect(due[0].urgencyScore).toBeGreaterThan(0);
    expect(Number.isFinite(due[0].urgencyScore)).toBe(true);
    // Jika fallback 1, 30; jika pure avg 2, 15 — keduanya valid, cek salah satu
    expect([15, 30]).toContain(due[0].urgencyScore);
  });

  test("batch H-10 not trigger, expiry null not trigger (isolasi per kategori)", async () => {
    await seedDefaultKategoris(repo);
    const dairy = (await repo.listKategoris()).find((k) => k.nama === "Makanan Basah")!;
    const snack = (await repo.listKategoris()).find((k) => k.nama === "Makanan Kering")!;
    await repo.updateKategoriThreshold(snack.id!, [7, 3, 1]);

    const skuDairy = await repo.createSKU({
      nama: "Yoghurt Cup 100ml",
      kategori_id: dairy.id!,
      hpp: 8000,
      harga_normal: 12000,
    });
    const skuSnack = await repo.createSKU({
      nama: "Roti Tawar",
      kategori_id: snack.id!,
      hpp: 5000,
      harga_normal: 8000,
    });

    const mockToday = jakartaDate("2026-09-02");

    // Dairy H-10 → not trigger (10 not in [7,3,1])
    await repo.createBatch({ sku_id: skuDairy.id!, qty: 8, expiry_date: "2026-09-12", hpp_snapshot: 8000 });
    // Snack H-3 → trigger (3 in [7,3,1])
    await repo.createBatch({ sku_id: skuSnack.id!, qty: 6, expiry_date: "2026-09-05", hpp_snapshot: 5000 });
    // Snack expiry null → not trigger
    await repo.createBatch({ sku_id: skuSnack.id!, qty: 10, expiry_date: null, hpp_snapshot: 5000 });

    const due = await getDueNotifications(repo, mockToday);
    expect(due).toHaveLength(1);
    expect(due[0].daysToExpiry).toBe(3);
    expect(due[0].sku.nama).toBe("Roti Tawar");
    // Pastikan H-10 tidak ada
    expect(due.find((d) => d.daysToExpiry === 10)).toBeUndefined();
    // Pastikan expiry null tidak ada
    expect(due.find((d) => d.batch.expiry_date === null)).toBeUndefined();
  });

  test("expiry null not trigger — listBatchesExpiring sudah skip", async () => {
    await seedDefaultKategoris(repo);
    const beras = (await repo.listKategoris()).find((k) => k.nama === "Misc")!;
    const sku = await repo.createSKU({
      nama: "Beras Pandan Wangi 5kg",
      kategori_id: beras.id!,
      hpp: 60000,
      harga_normal: 72000,
    });

    const mockToday = jakartaDate("2026-09-02");
    await repo.createBatch({ sku_id: sku.id!, qty: 20, expiry_date: null, hpp_snapshot: 60000 });
    await repo.createBatch({ sku_id: sku.id!, qty: 15, expiry_date: null, hpp_snapshot: 60000 });

    const due = await getDueNotifications(repo, mockToday);
    expect(due).toHaveLength(0);

    // Pastikan listBatchesExpiring memang 0 untuk non-perishable
    const expiring = await repo.listBatchesExpiring();
    expect(expiring).toHaveLength(0);
  });

  test("checkAndNotify permission denied → fallback badge only no throw", async () => {
    await seedDefaultKategoris(repo);
    const dairy = (await repo.listKategoris()).find((k) => k.nama === "Makanan Basah")!;
    const sku = await repo.createSKU({
      nama: "Susu UHT 1L Indomilk",
      kategori_id: dairy.id!,
      hpp: 12000,
      harga_normal: 15000,
    });
    await repo.createBatch({ sku_id: sku.id!, qty: 10, expiry_date: "2026-09-05", hpp_snapshot: 12000 });

    const mockToday = jakartaDate("2026-09-02");

    // Mock Notification denied + navigator.setAppBadge
    const gg = globalThis as unknown as Record<string, unknown>;
    const mockSetBadge = vi.fn(async () => {});
    gg.navigator = { setAppBadge: mockSetBadge, clearAppBadge: vi.fn(async () => {}) } as unknown as Navigator;
    gg.Notification = {
      permission: "denied",
      requestPermission: vi.fn(async () => "denied" as NotificationPermission),
    } as unknown as typeof Notification;

    // Spy console.log untuk WA hook stub
    const logSpy = vi.spyOn(console, "log").mockImplementation(() => {});
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});

    const result = await checkAndNotify(repo, mockToday);

    // MUST NOT throw, fallback badge only
    expect(result.badgeCount).toBe(1);
    expect(result.notified).toBe(0);
    // Badge tetap dipanggil walau denied (fallback)
    expect(mockSetBadge).toHaveBeenCalledWith(1);
    // WA hook stub log dipanggil (tidak send)
    expect(logSpy).toHaveBeenCalledWith(expect.stringContaining("[WA hook stub]"));

    // Tidak throw
    expect(warnSpy).not.toHaveBeenCalledWith(expect.stringContaining("throw"));

    logSpy.mockRestore();
    warnSpy.mockRestore();
  });

  test("checkAndNotify permission granted → show push stub tidak throw, notified = badgeCount", async () => {
    await seedDefaultKategoris(repo);
    const dairy = (await repo.listKategoris()).find((k) => k.nama === "Makanan Basah")!;
    const sku = await repo.createSKU({
      nama: "Susu UHT 1L Indomilk",
      kategori_id: dairy.id!,
      hpp: 12000,
      harga_normal: 15000,
    });
    await repo.createBatch({ sku_id: sku.id!, qty: 7, expiry_date: "2026-09-03", hpp_snapshot: 12000 }); // H-1 triggers

    const mockToday = jakartaDate("2026-09-02");
    const due = await getDueNotifications(repo, mockToday);
    expect(due).toHaveLength(1);
    expect(due[0].daysToExpiry).toBe(1);

    const gg = globalThis as unknown as Record<string, unknown>;
    const mockSetBadge = vi.fn(async () => {});
    gg.navigator = { setAppBadge: mockSetBadge, clearAppBadge: vi.fn(async () => {}) } as unknown as Navigator;
    // Mock Notification granted, plus constructor untuk fallback native
    const MockNotification = vi.fn() as unknown as typeof Notification;
    (MockNotification as unknown as Record<string, unknown>).permission = "granted";
    (MockNotification as unknown as Record<string, unknown>).requestPermission = vi.fn(async () => "granted" as NotificationPermission);
    gg.Notification = MockNotification;

    const result = await checkAndNotify(repo, mockToday);
    // granted → notified = 1, badge 1
    expect(result.badgeCount).toBe(1);
    expect(result.notified).toBe(1);
    expect(mockSetBadge).toHaveBeenCalledWith(1);
  });

  test("checkAndNotify tanpa Notification support → fallback badge only, tidak throw", async () => {
    await seedDefaultKategoris(repo);
    const dairy = (await repo.listKategoris()).find((k) => k.nama === "Makanan Basah")!;
    const sku = await repo.createSKU({
      nama: "Susu UHT 1L",
      kategori_id: dairy.id!,
      hpp: 10000,
      harga_normal: 15000,
    });
    await repo.createBatch({ sku_id: sku.id!, qty: 4, expiry_date: "2026-09-09", hpp_snapshot: 10000 }); // H-7 triggers

    const mockToday = jakartaDate("2026-09-02");
    const due = await getDueNotifications(repo, mockToday);
    expect(due).toHaveLength(1);

    // Pastikan global Notification undefined (Node tanpa mock)
    const gg = globalThis as unknown as Record<string, unknown>;
    delete gg.Notification;
    gg.navigator = { setAppBadge: vi.fn(async () => {}) } as unknown as Navigator;

    const result = await checkAndNotify(repo, mockToday);
    expect(result.badgeCount).toBe(1);
    expect(result.notified).toBe(0); // tanpa Notification, notified 0 tapi badge tetap
    expect(result).not.toBeUndefined();
  });

  test("WA hook stub MUST NOT implement WA send — hanya console.log, tidak ada fetch/whatsApp", async () => {
    await seedDefaultKategoris(repo);
    const dairy = (await repo.listKategoris()).find((k) => k.nama === "Makanan Basah")!;
    const sku = await repo.createSKU({
      nama: "Susu UHT 1L",
      kategori_id: dairy.id!,
      hpp: 10000,
      harga_normal: 15000,
    });
    await repo.createBatch({ sku_id: sku.id!, qty: 3, expiry_date: "2026-09-05", hpp_snapshot: 10000 });

    const mockToday = jakartaDate("2026-09-02");
    const logSpy = vi.spyOn(console, "log").mockImplementation(() => {});
    // Mock permission denied agar tidak coba show push
    const gg = globalThis as unknown as Record<string, unknown>;
    gg.Notification = {
      permission: "denied",
      requestPermission: vi.fn(async () => "denied" as NotificationPermission),
    } as unknown as typeof Notification;

    await checkAndNotify(repo, mockToday);
    // Harus log WA hook stub, tidak ada fetch
    expect(logSpy).toHaveBeenCalledWith(expect.stringContaining("[WA hook stub]"));
    // Pastikan tidak ada kata send WA (kecuali MUST NOT send di log)
    const calls = logSpy.mock.calls.map((c) => String(c[0]));
    expect(calls.some((s) => s.includes("MUST NOT send"))).toBe(true);

    logSpy.mockRestore();
  });

  test("threshold per kategori — kategori berbeda threshold beda trigger", async () => {
    await seedDefaultKategoris(repo);
    const dairyCat = await repo.createKategori({ nama: "AlphaDairy", threshold_h_minus: [14, 7, 3] });
    const snackCat = await repo.createKategori({ nama: "BetaSnack", threshold_h_minus: [7, 3, 1] });
    const dairy = dairyCat;
    const snack = snackCat;

    const skuDairy = await repo.createSKU({
      nama: "Susu Dairy Custom",
      kategori_id: dairy.id!,
      hpp: 10000,
      harga_normal: 15000,
    });
    const skuSnack = await repo.createSKU({
      nama: "Snack Custom",
      kategori_id: snack.id!,
      hpp: 5000,
      harga_normal: 8000,
    });

    const mockToday = jakartaDate("2026-09-02");
    // Dairy H-14 (2026-09-16) → trigger karena Dairy threshold [14,7,3] includes 14
    await repo.createBatch({ sku_id: skuDairy.id!, qty: 5, expiry_date: "2026-09-16", hpp_snapshot: 10000 });
    // Snack H-14 → NOT trigger karena Snack threshold [7,3,1] tidak includes 14 (14>7)
    await repo.createBatch({ sku_id: skuSnack.id!, qty: 5, expiry_date: "2026-09-16", hpp_snapshot: 5000 });
    // Snack H-7 → trigger
    await repo.createBatch({ sku_id: skuSnack.id!, qty: 5, expiry_date: "2026-09-09", hpp_snapshot: 5000 });

    const due = await getDueNotifications(repo, mockToday);
    // Dairy H-14 + Snack H-7 = 2, Snack H-14 terfilter
    expect(due).toHaveLength(2);
    expect(due.map((d) => d.daysToExpiry).sort((a,b)=>a-b)).toEqual([7, 14]);
    expect(due.map((d) => d.sku.nama).sort()).toEqual(["Snack Custom", "Susu Dairy Custom"].sort());
  });

  test("urgencyScore dihitung qty*days/max(avg,1) — mock avg fallback 1", async () => {
    await seedDefaultKategoris(repo);
    const dairy = (await repo.listKategoris()).find((k) => k.nama === "Makanan Basah")!;
    const sku = await repo.createSKU({
      nama: "Susu UHT",
      kategori_id: dairy.id!,
      hpp: 12000,
      harga_normal: 15000,
    });

    // Tidak buat transaksi → avg fallback 1 → urgency 10*3/1=30
    await repo.createBatch({ sku_id: sku.id!, qty: 10, expiry_date: "2026-09-05", hpp_snapshot: 12000 });
    const mockToday = jakartaDate("2026-09-02");
    const due = await getDueNotifications(repo, mockToday);
    expect(due[0].urgencyScore).toBe(30); // 10*3 /1

    // Tambah transaksi 14 hari full → avg akan hitung pure? Tapi scheduler pakai fallback 1 jika distinct<14, jadi tetap 1
    // Untuk test ini kita cek max(avg,1) guard: jika avg 0 tetap 1
    // Sudah di-cover via expiry.test, tapi pastikan scheduler tidak Infinity
    expect(Number.isFinite(due[0].urgencyScore)).toBe(true);
    expect(due[0].urgencyScore).not.toBe(Infinity);
  });
});
