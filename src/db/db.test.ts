/**
 * TASK-02 acceptance tests (TASK.md:138-139)
 *
 * - create SKU+Batch with expiry, query by sku_id returns N
 * - batch expiry null not indexed for engine
 * - repository interface has methods for each entity
 * - happy: insert 3 batches diff expiry → query sorted
 * - failure: insert Batch without sku_id → reject
 *
 * Run: bun test src/db/db.test.ts --reporter=verbose
 */

import { describe, expect, test, beforeEach } from "vitest";
// fake-indexeddb harus ter-inject KE globalThis SEBELUM module ./db (yang import
// dexie) dievaluasi — dexie men-cache indexedDB saat load. Dynamic import di
// dalam top-level await memastikan urutan itu.
import * as fakeIndexedDB from "fake-indexeddb";

const g = globalThis as unknown as Record<string, unknown>;
if (!g.indexedDB) {
  g.indexedDB = fakeIndexedDB.indexedDB;
  g.IDBKeyRange = fakeIndexedDB.IDBKeyRange;
}

const { InventoryDB, DexieRepository, DEFAULT_ORG_ID, ValidationError } = await import("./db");
type Repo = import("./db").InventoryRepository;
type InventoryRepoCtor = new (d: import("./db").InventoryDB) => Repo;
const RepoCtor = DexieRepository as unknown as InventoryRepoCtor;

let repo: Repo;

beforeEach(async () => {
  const testDb = new InventoryDB(`test-db-${crypto.randomUUID()}`);
  repo = new RepoCtor(testDb);
});

describe("Kategori", () => {
  test("create + get + list by org_id", async () => {
    const k = await repo.createKategori({ nama: "Dairy", threshold_h_minus: [7, 3, 1] });
    expect(k.id).toBeDefined();
    expect(k.org_id).toBe(DEFAULT_ORG_ID);

    const got = await repo.getKategori(k.id!);
    expect(got?.nama).toBe("Dairy");

    const list = await repo.listKategoris();
    expect(list).toHaveLength(1);
  });

  test("updateKategoriThreshold validasi: duplikat, kosong, tidak menurun", async () => {
    const k = await repo.createKategori({ nama: "Snack", threshold_h_minus: [7, 3, 1] });

    await expect(repo.updateKategoriThreshold(k.id!, [14, 7, 3])).resolves.toMatchObject({
      threshold_h_minus: [14, 7, 3],
    });
    await expect(repo.updateKategoriThreshold(k.id!, [3, 3, 1])).rejects.toThrow(ValidationError);
    await expect(repo.updateKategoriThreshold(k.id!, [])).rejects.toThrow(ValidationError);
    await expect(repo.updateKategoriThreshold(k.id!, [1, 7, 3])).rejects.toThrow(ValidationError);
  });
});

describe("SKU", () => {
  test("create SKU valid, query by kategori_id", async () => {
    const k = await repo.createKategori({ nama: "Dairy", threshold_h_minus: [7, 3, 1] });
    const s = await repo.createSKU({
      nama: "Susu UHT 1L Indomilk",
      kategori_id: k.id!,
      hpp: 12000,
      harga_normal: 15000,
    });
    expect(s.org_id).toBe(DEFAULT_ORG_ID);

    const list = await repo.listSKUsByKategori(k.id!);
    expect(list).toHaveLength(1);
    expect(list[0].nama).toBe("Susu UHT 1L Indomilk");
  });

  test("tolak SKU invalid: hpp 0, harga di bawah HPP, nama kosong", async () => {
    const k = await repo.createKategori({ nama: "Dairy", threshold_h_minus: [7, 3, 1] });
    await expect(
      repo.createSKU({ nama: "X", kategori_id: k.id!, hpp: 0, harga_normal: 1000 })
    ).rejects.toThrow("HPP harus lebih dari 0");
    await expect(
      repo.createSKU({ nama: "X", kategori_id: k.id!, hpp: 12000, harga_normal: 10000 })
    ).rejects.toThrow("harga_normal tidak boleh di bawah HPP");
    await expect(
      repo.createSKU({ nama: "", kategori_id: k.id!, hpp: 1000, harga_normal: 2000 })
    ).rejects.toThrow("Nama SKU tidak boleh kosong");
  });
});

describe("Batch", () => {
  test("happy: 3 batches beda expiry → query by sku_id sorted expiry dekat dulu", async () => {
    const k = await repo.createKategori({ nama: "Dairy", threshold_h_minus: [7, 3, 1] });
    const s = await repo.createSKU({
      nama: "Susu UHT 1L",
      kategori_id: k.id!,
      hpp: 12000,
      harga_normal: 15000,
    });

    await repo.createBatch({ sku_id: s.id!, qty: 10, expiry_date: "2026-09-10", hpp_snapshot: 12000 });
    await repo.createBatch({ sku_id: s.id!, qty: 5, expiry_date: "2026-09-03", hpp_snapshot: 12000 });
    await repo.createBatch({ sku_id: s.id!, qty: 8, expiry_date: "2026-09-07", hpp_snapshot: 12000 });

    const batches = await repo.listBatchesBySKU(s.id!);
    expect(batches).toHaveLength(3);
    // sorted expiry paling dekat dulu (FRD-02)
    expect(batches.map((b) => b.expiry_date)).toEqual(["2026-09-03", "2026-09-07", "2026-09-10"]);
    // received_at auto terisi
    expect(batches[0].received_at).toBeTruthy();
  });

  test("batch non-perishable (expiry null) tidak muncul di query engine expiry", async () => {
    const k = await repo.createKategori({ nama: "Beras", threshold_h_minus: [7, 3, 1] });
    const s = await repo.createSKU({
      nama: "Beras Pandan Wangi 5kg",
      kategori_id: k.id!,
      hpp: 60000,
      harga_normal: 72000,
    });

    await repo.createBatch({ sku_id: s.id!, qty: 20, expiry_date: null, hpp_snapshot: 60000 });
    await repo.createBatch({ sku_id: s.id!, qty: 5, expiry_date: "2026-09-05", hpp_snapshot: 60000 });

    const bySku = await repo.listBatchesBySKU(s.id!);
    expect(bySku).toHaveLength(2);

    const expiring = await repo.listBatchesExpiring();
    expect(expiring).toHaveLength(1);
    expect(expiring[0].expiry_date).toBe("2026-09-05");
  });

  test("failure: insert Batch tanpa sku_id / qty 0 → reject", async () => {
    await expect(
      repo.createBatch({ sku_id: 0, qty: 10, expiry_date: "2026-09-05", hpp_snapshot: 1000 })
    ).rejects.toThrow("sku_id wajib");
    await expect(
      repo.createBatch({ sku_id: 1, qty: 0, expiry_date: "2026-09-05", hpp_snapshot: 1000 })
    ).rejects.toThrow("Qty harus lebih dari 0");
  });
});

describe("Transaksi / Promo / AdvisorCache", () => {
  test("transaksi create + query by sku sejak tanggal", async () => {
    const t = await repo.createTransaksi({ sku_id: 1, qty_sold: 3, sold_at: "2026-09-01T07:00:00Z" });
    expect(t.org_id).toBe(DEFAULT_ORG_ID);

    const since = await repo.listTransaksisBySKU(1, "2026-08-30T00:00:00Z");
    expect(since).toHaveLength(1);
    const none = await repo.listTransaksisBySKU(1, "2026-09-02T00:00:00Z");
    expect(none).toHaveLength(0);
  });

  test("promo lifecycle proposed → active, query by status", async () => {
    const p = await repo.createPromo({
      status: "proposed",
      batch_id: 1,
      sku_pasangan_id: 2,
      harga_tebus: 9000,
      hpp_snapshot: 10000,
    });
    expect(p.created_at).toBeTruthy();

    const proposed = await repo.listPromosByStatus("proposed");
    expect(proposed).toHaveLength(1);

    const active = await repo.updatePromoStatus(p.id!, "active");
    expect(active.status).toBe("active");
    expect(await repo.listPromosByStatus("proposed")).toHaveLength(0);
    expect(await repo.listPromosByStatus("active")).toHaveLength(1);
  });

  test("advisorCache roundtrip by key", async () => {
    await repo.setAdvisorCache("daily-2026-09-01", JSON.stringify({ a: 1 }));
    const got = await repo.getAdvisorCache("daily-2026-09-01");
    expect(got?.payload).toBe(JSON.stringify({ a: 1 }));
    expect(await repo.getAdvisorCache("missing")).toBeUndefined();
  });
});

describe("Repository interface contract", () => {
  test("DexieRepository implements semua method InventoryRepository", async () => {
    const requiredMethods: (keyof Repo)[] = [
      "createKategori",
      "getKategori",
      "listKategoris",
      "updateKategoriThreshold",
      "createSKU",
      "getSKU",
      "listSKUsByKategori",
      "createBatch",
      "listBatchesBySKU",
      "listBatchesExpiring",
      "updateBatchQty",
      "createTransaksi",
      "listTransaksisBySKU",
      "createPromo",
      "listPromosByStatus",
      "updatePromoStatus",
      "setAdvisorCache",
      "getAdvisorCache",
    ];
    for (const m of requiredMethods) {
      expect(typeof (repo as unknown as Record<string, unknown>)[m as string]).toBe("function");
    }
  });
});
