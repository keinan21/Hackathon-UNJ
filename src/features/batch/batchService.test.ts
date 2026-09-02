/**
 * TASK-07 [FRD-02] acceptance tests
 *
 * - (a) create batch qty 10 expiry 2026-09-05 passes + hpp_snapshot copy
 * - (b) create batch expiry null passes but not returned by listBatchesExpiring
 * - (c) qty 0 rejects
 * - (d) 3 batches diff expiry -> list sorted asc (lihat src/db/db.test.ts pattern)
 *
 * Pattern: fake-indexeddb inject ke globalThis SEBELUM dynamic import
 * (dexie cache indexedDB saat load, sama seperti src/db/db.test.ts)
 *
 * Run: bun test src/features/batch/batchService.test.ts --reporter=verbose
 */

import { describe, expect, test, beforeEach } from "vitest";
import * as fakeIndexedDB from "fake-indexeddb";

// fake-indexeddb harus ter-inject KE globalThis SEBELUM module ./db dan ./batchService
// (yang import dexie) dievaluasi — dexie men-cache indexedDB saat load.
// Dynamic import di dalam top-level await memastikan urutan itu.
const g = globalThis as unknown as Record<string, unknown>;
if (!g.indexedDB) {
  g.indexedDB = fakeIndexedDB.indexedDB;
  g.IDBKeyRange = fakeIndexedDB.IDBKeyRange;
}

// Dynamic imports setelah fake-indexeddb inject
const { db, ValidationError } = await import("../../db/db");
const batchService = await import("./batchService");
const skuService = await import("../sku/skuService");

beforeEach(async () => {
  // Bersihkan singleton db antar test (local-first, single device)
  await db.batches.clear();
  await db.skus.clear();
  await db.kategoris.clear();
});

describe("batchService — Batch Lot CRUD (TASK-07 FRD-02)", () => {
  test("(a) create batch qty 10 expiry 2026-09-05 passes + hpp_snapshot copy dari SKU.hpp", async () => {
    const kategori = await skuService.createKategori({
      nama: "Dairy",
      threshold_h_minus: [7, 3, 1],
    });
    const sku = await skuService.createSKU({
      nama: "Susu UHT 1L Indomilk",
      kategori_id: kategori.id!,
      hpp: 12000,
      harga_normal: 15000,
    });

    // createBatch tanpa hpp_snapshot → copy dari SKU.hpp (12000)
    const batch = await batchService.createBatch({
      sku_id: sku.id!,
      qty: 10,
      expiry_date: "2026-09-05",
    });

    expect(batch.id).toBeDefined();
    expect(batch.sku_id).toBe(sku.id);
    expect(batch.qty).toBe(10);
    expect(batch.expiry_date).toBe("2026-09-05");
    expect(batch.hpp_snapshot).toBe(12000);
    expect(batch.received_at).toBeTruthy();
    // ISO datetime
    expect(() => new Date(batch.received_at)).not.toThrow();
    expect(batch.org_id).toBe("toko-01");
  });

  test("(b) create batch expiry null passes but not returned by listBatchesExpiring (non-perishable skip engine)", async () => {
    const kategori = await skuService.createKategori({
      nama: "Beras",
      threshold_h_minus: [7, 3, 1],
    });
    const sku = await skuService.createSKU({
      nama: "Beras Pandan Wangi 5kg",
      kategori_id: kategori.id!,
      hpp: 60000,
      harga_normal: 72000,
    });

    // Batch non-perishable (expiry null) — harus tersimpan
    const batchNull = await batchService.createBatch({
      sku_id: sku.id!,
      qty: 20,
      expiry_date: null,
    });
    expect(batchNull.id).toBeDefined();
    expect(batchNull.expiry_date).toBeNull();
    expect(batchNull.hpp_snapshot).toBe(60000); // copy dari SKU
    expect(batchNull.org_id).toBe("toko-01");

    // Batch dengan expiry valid
    const batchExp = await batchService.createBatch({
      sku_id: sku.id!,
      qty: 5,
      expiry_date: "2026-09-05",
      hpp_snapshot: 60000, // explicit
    });
    expect(batchExp.expiry_date).toBe("2026-09-05");

    // listBatchesBySKU harus kembalikan keduanya (null + expiry)
    const bySku = await batchService.listBatchesBySKU(sku.id!);
    expect(bySku).toHaveLength(2);

    // listBatchesExpiring harus exclude null — hanya 1 yang expiry not null
    const expiring = await batchService.listBatchesExpiring();
    expect(expiring).toHaveLength(1);
    expect(expiring[0].expiry_date).toBe("2026-09-05");
    expect(expiring[0].id).toBe(batchExp.id);

    // Pastikan batch null tidak ada di expiring
    const ids = expiring.map((b) => b.id);
    expect(ids).not.toContain(batchNull.id);
  });

  test("(c) qty 0 rejects dengan pesan Qty harus lebih dari 0", async () => {
    const kategori = await skuService.createKategori({
      nama: "Dairy",
      threshold_h_minus: [7, 3, 1],
    });
    const sku = await skuService.createSKU({
      nama: "Susu UHT 1L",
      kategori_id: kategori.id!,
      hpp: 12000,
      harga_normal: 15000,
    });

    await expect(
      batchService.createBatch({
        sku_id: sku.id!,
        qty: 0,
        expiry_date: "2026-09-05",
      })
    ).rejects.toThrow(ValidationError);

    await expect(
      batchService.createBatch({
        sku_id: sku.id!,
        qty: 0,
        expiry_date: "2026-09-05",
      })
    ).rejects.toThrow("Qty harus lebih dari 0");

    // qty negatif juga reject
    await expect(
      batchService.createBatch({
        sku_id: sku.id!,
        qty: -5,
        expiry_date: "2026-09-05",
      })
    ).rejects.toThrow("Qty harus lebih dari 0");

    // updateBatchQty 0 juga reject
    const ok = await batchService.createBatch({
      sku_id: sku.id!,
      qty: 10,
      expiry_date: "2026-09-05",
    });
    await expect(batchService.updateBatchQty(ok.id!, 0)).rejects.toThrow(
      "Qty harus lebih dari 0"
    );

    // Tidak ada batch tambahan yang tersimpan akibat reject (hanya 1 yang valid)
    const list = await batchService.listBatchesBySKU(sku.id!);
    expect(list).toHaveLength(1);
  });

  test("(d) 3 batches beda expiry -> list sorted asc expiry paling dekat dulu", async () => {
    const kategori = await skuService.createKategori({
      nama: "Dairy",
      threshold_h_minus: [7, 3, 1],
    });
    const sku = await skuService.createSKU({
      nama: "Susu UHT 1L",
      kategori_id: kategori.id!,
      hpp: 12000,
      harga_normal: 15000,
    });

    // Insert 3 batches acak order, qty bebas
    await batchService.createBatch({
      sku_id: sku.id!,
      qty: 10,
      expiry_date: "2026-09-10",
      hpp_snapshot: 12000,
    });
    await batchService.createBatch({
      sku_id: sku.id!,
      qty: 5,
      expiry_date: "2026-09-03",
      hpp_snapshot: 12000,
    });
    await batchService.createBatch({
      sku_id: sku.id!,
      qty: 8,
      expiry_date: "2026-09-07",
      hpp_snapshot: 12000,
    });

    const batches = await batchService.listBatchesBySKU(sku.id!);
    expect(batches).toHaveLength(3);
    // sorted expiry paling dekat dulu (FRD-02: list batch per SKU diurutkan expiry paling dekat dulu)
    expect(batches.map((b) => b.expiry_date)).toEqual([
      "2026-09-03",
      "2026-09-07",
      "2026-09-10",
    ]);
    // received_at auto terisi semua
    for (const b of batches) {
      expect(b.received_at).toBeTruthy();
      expect(b.org_id).toBe("toko-01");
    }

    // listBatchesExpiring juga sorted asc (global)
    const expiring = await batchService.listBatchesExpiring();
    expect(expiring.map((b) => b.expiry_date)).toEqual([
      "2026-09-03",
      "2026-09-07",
      "2026-09-10",
    ]);
  });

  test("updateBatchQty valid dan org_id forward toko-01", async () => {
    const kategori = await skuService.createKategori({
      nama: "Snack",
      threshold_h_minus: [7, 3, 1],
    });
    const sku = await skuService.createSKU({
      nama: "Roti Tawar",
      kategori_id: kategori.id!,
      hpp: 8000,
      harga_normal: 10000,
    });
    const batch = await batchService.createBatch({
      sku_id: sku.id!,
      qty: 10,
      expiry_date: "2026-09-05",
    });
    const updated = await batchService.updateBatchQty(batch.id!, 5);
    expect(updated.qty).toBe(5);
    expect(updated.id).toBe(batch.id);

    const got = await batchService.getBatch(batch.id!);
    expect(got?.qty).toBe(5);
  });
});
