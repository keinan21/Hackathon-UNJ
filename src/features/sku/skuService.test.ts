/**
 * TASK-06 [FRD-02] acceptance tests
 *
 * - create SKU Dairy valid passes
 * - create SKU hpp<=0 rejects
 * - create SKU dengan field expiry_date rejects/tidak tersimpan
 * - kategori required (kategori_id wajib)
 *
 * Pattern: fake-indexeddb inject ke globalThis SEBELUM dynamic import
 * (dexie cache indexedDB saat load, sama seperti src/db/db.test.ts)
 *
 * Run: bun test src/features/sku/skuService.test.ts --reporter=verbose
 */

import { describe, expect, test, beforeEach } from "vitest";
import * as fakeIndexedDB from "fake-indexeddb";

// fake-indexeddb harus ter-inject KE globalThis SEBELUM module ./db dan ./skuService
// (yang import dexie) dievaluasi — dexie men-cache indexedDB saat load.
// Dynamic import di dalam top-level await memastikan urutan itu.
const g = globalThis as unknown as Record<string, unknown>;
if (!g.indexedDB) {
  g.indexedDB = fakeIndexedDB.indexedDB;
  g.IDBKeyRange = fakeIndexedDB.IDBKeyRange;
}

// Dynamic imports setelah fake-indexeddb inject
const { db, ValidationError } = await import("../../db/db");
const skuService = await import("./skuService");

beforeEach(async () => {
  // Bersihkan singleton db antar test (local-first, single device)
  await db.skus.clear();
  await db.kategoris.clear();
  await db.batches.clear();
});

describe("skuService — SKU Kategori CRUD (TASK-06 FRD-02)", () => {
  test("create SKU Dairy valid passes", async () => {
    const kategori = await skuService.createKategori({
      nama: "Dairy",
      threshold_h_minus: [7, 3, 1],
    });
    expect(kategori.id).toBeDefined();
    expect(kategori.org_id).toBe("toko-01");

    const sku = await skuService.createSKU({
      nama: "Susu UHT 1L Indomilk",
      kategori_id: kategori.id!,
      hpp: 12000,
      harga_normal: 15000,
    });
    expect(sku.id).toBeDefined();
    expect(sku.org_id).toBe("toko-01");
    expect(sku.nama).toBe("Susu UHT 1L Indomilk");
    // MUST NOT store expiry_date di SKU
    expect((sku as unknown as Record<string, unknown>).expiry_date).toBeUndefined();

    const list = await skuService.listSKUsByKategori(kategori.id!);
    expect(list).toHaveLength(1);
    expect(list[0].nama).toBe("Susu UHT 1L Indomilk");

    const got = await skuService.getSKU(sku.id!);
    expect(got?.nama).toBe("Susu UHT 1L Indomilk");
  });

  test("create SKU hpp<=0 rejects dengan pesan HPP harus lebih dari 0", async () => {
    const kategori = await skuService.createKategori({
      nama: "Dairy",
      threshold_h_minus: [7, 3, 1],
    });
    await expect(
      skuService.createSKU({
        nama: "Susu UHT 1L",
        kategori_id: kategori.id!,
        hpp: 0,
        harga_normal: 15000,
      })
    ).rejects.toThrow(ValidationError);
    await expect(
      skuService.createSKU({
        nama: "Susu UHT 1L",
        kategori_id: kategori.id!,
        hpp: 0,
        harga_normal: 15000,
      })
    ).rejects.toThrow("HPP harus lebih dari 0");

    // hpp negatif juga reject
    await expect(
      skuService.createSKU({
        nama: "Susu UHT 1L",
        kategori_id: kategori.id!,
        hpp: -100,
        harga_normal: 15000,
      })
    ).rejects.toThrow("HPP harus lebih dari 0");

    // harga_normal di bawah HPP juga reject
    await expect(
      skuService.createSKU({
        nama: "Susu UHT 1L",
        kategori_id: kategori.id!,
        hpp: 12000,
        harga_normal: 10000,
      })
    ).rejects.toThrow("harga_normal tidak boleh di bawah HPP");

    // tidak ada yang tersimpan
    const list = await skuService.listSKUsByKategori(kategori.id!);
    expect(list).toHaveLength(0);
  });

  test("create SKU dengan field expiry_date rejects/tidak tersimpan (guard FRD-02)", async () => {
    const kategori = await skuService.createKategori({
      nama: "Dairy",
      threshold_h_minus: [7, 3, 1],
    });

    // Payload berisi expiry_date harus ditolak (expiry milik Batch, bukan SKU)
    await expect(
      skuService.createSKU({
        nama: "Susu UHT 1L",
        kategori_id: kategori.id!,
        hpp: 12000,
        harga_normal: 15000,
        expiry_date: "2026-09-10",
      } as unknown as Parameters<typeof skuService.createSKU>[0])
    ).rejects.toThrow(ValidationError);

    await expect(
      skuService.createSKU({
        nama: "Susu UHT 1L",
        kategori_id: kategori.id!,
        hpp: 12000,
        harga_normal: 15000,
        expiry_date: "2026-09-10",
      } as unknown as Parameters<typeof skuService.createSKU>[0])
    ).rejects.toThrow(/expiry/i);

    // Pastikan tidak ada SKU yang tersimpan akibat reject
    const list = await skuService.listSKUsByKategori(kategori.id!);
    expect(list).toHaveLength(0);

    // Valid SKU tanpa expiry_date tetap bisa dibuat, dan tetap tidak punya expiry_date
    const valid = await skuService.createSKU({
      nama: "Susu UHT 1L Valid",
      kategori_id: kategori.id!,
      hpp: 12000,
      harga_normal: 15000,
    });
    expect((valid as unknown as Record<string, unknown>).expiry_date).toBeUndefined();
    const got = await skuService.getSKU(valid.id!);
    expect((got as unknown as Record<string, unknown>).expiry_date).toBeUndefined();
  });

  test("kategori required — kategori_id wajib dan nama non-empty", async () => {
    // kategori_id 0 / missing harus reject
    await expect(
      skuService.createSKU({
        nama: "Susu UHT 1L",
        hpp: 12000,
        harga_normal: 15000,
      } as unknown as Parameters<typeof skuService.createSKU>[0])
    ).rejects.toThrow("kategori_id wajib");

    await expect(
      skuService.createSKU({
        nama: "Susu UHT 1L",
        kategori_id: 0,
        hpp: 12000,
        harga_normal: 15000,
      })
    ).rejects.toThrow("kategori_id wajib");

    // nama kosong juga reject
    const kategori = await skuService.createKategori({
      nama: "Dairy",
      threshold_h_minus: [7, 3, 1],
    });
    await expect(
      skuService.createSKU({
        nama: "",
        kategori_id: kategori.id!,
        hpp: 12000,
        harga_normal: 15000,
      })
    ).rejects.toThrow("Nama SKU tidak boleh kosong");

    await expect(
      skuService.createSKU({
        nama: "   ",
        kategori_id: kategori.id!,
        hpp: 12000,
        harga_normal: 15000,
      })
    ).rejects.toThrow("Nama SKU tidak boleh kosong");
  });

  test("updateSKU valid dan expiry_date di patch tetap reject", async () => {
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

    // update harga valid
    const updated = await skuService.updateSKU(sku.id!, { harga_normal: 16000 });
    expect(updated.harga_normal).toBe(16000);
    expect(updated.hpp).toBe(12000);

    // patch berisi expiry_date harus reject
    await expect(
      skuService.updateSKU(sku.id!, {
        expiry_date: "2026-09-10",
      } as unknown as Parameters<typeof skuService.updateSKU>[1])
    ).rejects.toThrow(/expiry/i);

    // pastikan tidak berubah akibat reject
    const got = await skuService.getSKU(sku.id!);
    expect(got?.harga_normal).toBe(16000);
  });

  test("Kategori CRUD: create, list, updateThreshold valid dan invalid", async () => {
    const k = await skuService.createKategori({
      nama: "Snack",
      threshold_h_minus: [7, 3, 1],
    });
    expect(k.org_id).toBe("toko-01");

    const list = await skuService.listKategoris();
    expect(list.map((x) => x.nama)).toContain("Snack");

    const updated = await skuService.updateKategoriThreshold(k.id!, [14, 7, 3]);
    expect(updated.threshold_h_minus).toEqual([14, 7, 3]);

    await expect(skuService.updateKategoriThreshold(k.id!, [3, 3, 1])).rejects.toThrow("tidak boleh sama");
    await expect(skuService.updateKategoriThreshold(k.id!, [])).rejects.toThrow("tidak boleh kosong");
  });
});
