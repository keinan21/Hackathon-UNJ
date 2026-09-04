import { describe, expect, test, beforeEach } from "vitest";
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
let testDb: InstanceType<typeof InventoryDB>;

beforeEach(async () => {
  testDb = new InventoryDB(`test-tags-${crypto.randomUUID()}`);
  repo = new RepoCtor(testDb);
});

describe("Tag CRUD — create + list", () => {
  test("create + listTags by org", async () => {
    const t1 = await repo.createTag({ nama: "Promo" });
    const t2 = await repo.createTag({ nama: "Laris" });
    expect(t1.id).toBeDefined();
    expect(t1.org_id).toBe(DEFAULT_ORG_ID);
    expect(t2.id).toBeDefined();
    const list = await repo.listTags();
    expect(list).toHaveLength(2);
    const names = list.map((t) => t.nama).sort();
    expect(names).toEqual(["Laris", "Promo"]);
  });
});

describe("Tag CRUD — validasi duplikat", () => {
  test("nama duplikat per org → Nama tag sudah dipakai", async () => {
    await repo.createTag({ nama: "Promo" });
    await expect(repo.createTag({ nama: "Promo" })).rejects.toThrow("Nama tag sudah dipakai");
    await expect(repo.createTag({ nama: " Promo " })).rejects.toThrow("Nama tag sudah dipakai");
  });

  test("nama kosong → Nama tag tidak boleh kosong", async () => {
    await expect(repo.createTag({ nama: "" })).rejects.toThrow("Nama tag tidak boleh kosong");
    await expect(repo.createTag({ nama: "   " })).rejects.toThrow("Nama tag tidak boleh kosong");
  });

  test("rename duplikat → Nama tag sudah dipakai", async () => {
    const a = await repo.createTag({ nama: "Promo" });
    const b = await repo.createTag({ nama: "Laris" });
    await expect(repo.renameTag(b.id!, "Promo")).rejects.toThrow("Nama tag sudah dipakai");
    void a;
  });
});

describe("Tag CRUD — rename propagasi by id", () => {
  test("rename + relasi ikut (by id) — listTagsBySKU ikut nama baru", async () => {
    const k = await repo.createKategori({ nama: "Makanan Basah", threshold_h_minus: [7, 3, 1] });
    const sku = await repo.createSKU({ nama: "Roti Tawar", kategori_id: k.id!, hpp: 8000, harga_normal: 12000 });
    const tag = await repo.createTag({ nama: "Promo" });
    await repo.addTagToSKU(sku.id!, tag.id!);

    const renamed = await repo.renameTag(tag.id!, "Diskon");
    expect(renamed.nama).toBe("Diskon");
    expect(renamed.id).toBe(tag.id);

    const bySku = await repo.listTagsBySKU(sku.id!);
    expect(bySku).toHaveLength(1);
    expect(bySku[0].nama).toBe("Diskon");
    expect(bySku[0].id).toBe(tag.id);
  });

  test("rename nama kosong → error", async () => {
    const tag = await repo.createTag({ nama: "Promo" });
    await expect(repo.renameTag(tag.id!, "")).rejects.toThrow("Nama tag tidak boleh kosong");
    await expect(repo.renameTag(tag.id!, "   ")).rejects.toThrow("Nama tag tidak boleh kosong");
  });

  test("rename tag tidak ditemukan → error", async () => {
    await expect(repo.renameTag(99999, "Baru")).rejects.toThrow("tidak ditemukan");
  });
});

describe("Tag CRUD — attach idempotent + detach", () => {
  test("attach ganda idempotent — no-op bukan error, tetap 1 link", async () => {
    const k = await repo.createKategori({ nama: "Snack", threshold_h_minus: [7, 3, 1] });
    const sku = await repo.createSKU({ nama: "Keripik", kategori_id: k.id!, hpp: 5000, harga_normal: 8000 });
    const tag = await repo.createTag({ nama: "Pedas" });

    const first = await repo.addTagToSKU(sku.id!, tag.id!);
    const second = await repo.addTagToSKU(sku.id!, tag.id!);
    expect(second.id).toBe(first.id);

    const links = await testDb.sku_tags.where("[sku_id+tag_id]").equals([sku.id!, tag.id!]).toArray();
    expect(links).toHaveLength(1);

    const bySku = await repo.listTagsBySKU(sku.id!);
    expect(bySku).toHaveLength(1);
  });

  test("detach — hapus link, tag tetap ada, sku tetap ada", async () => {
    const k = await repo.createKategori({ nama: "Snack", threshold_h_minus: [7, 3, 1] });
    const sku = await repo.createSKU({ nama: "Keripik", kategori_id: k.id!, hpp: 5000, harga_normal: 8000 });
    const tag = await repo.createTag({ nama: "Pedas" });
    await repo.addTagToSKU(sku.id!, tag.id!);

    expect((await repo.listTagsBySKU(sku.id!))).toHaveLength(1);
    await repo.removeTagFromSKU(sku.id!, tag.id!);
    expect((await repo.listTagsBySKU(sku.id!))).toHaveLength(0);

    const tagStill = await testDb.tags.get(tag.id!);
    expect(tagStill).toBeDefined();
    const skuStill = await testDb.skus.get(sku.id!);
    expect(skuStill).toBeDefined();
  });

  test("detach idempotent — detach dua kali tidak error", async () => {
    const k = await repo.createKategori({ nama: "Snack", threshold_h_minus: [7, 3, 1] });
    const sku = await repo.createSKU({ nama: "Keripik", kategori_id: k.id!, hpp: 5000, harga_normal: 8000 });
    const tag = await repo.createTag({ nama: "Pedas" });
    await repo.addTagToSKU(sku.id!, tag.id!);
    await repo.removeTagFromSKU(sku.id!, tag.id!);
    await expect(repo.removeTagFromSKU(sku.id!, tag.id!)).resolves.toBeUndefined();
  });

  test("listTagsBySKU — banyak tag ter-attach", async () => {
    const k = await repo.createKategori({ nama: "Snack", threshold_h_minus: [7, 3, 1] });
    const sku = await repo.createSKU({ nama: "Keripik", kategori_id: k.id!, hpp: 5000, harga_normal: 8000 });
    const t1 = await repo.createTag({ nama: "Pedas" });
    const t2 = await repo.createTag({ nama: "Manis" });
    await repo.addTagToSKU(sku.id!, t1.id!);
    await repo.addTagToSKU(sku.id!, t2.id!);
    const bySku = await repo.listTagsBySKU(sku.id!);
    expect(bySku).toHaveLength(2);
    expect(bySku.map((t) => t.nama).sort()).toEqual(["Manis", "Pedas"]);
  });
});

describe("Tag CRUD — delete cascade link", () => {
  test("delete tag → link sku_tags ikut hilang, SKU tetap ada", async () => {
    const k = await repo.createKategori({ nama: "Minuman Botol", threshold_h_minus: [7, 3, 1] });
    const sku1 = await repo.createSKU({ nama: "Teh Botol", kategori_id: k.id!, hpp: 3000, harga_normal: 5000 });
    const sku2 = await repo.createSKU({ nama: "Kopi Botol", kategori_id: k.id!, hpp: 4000, harga_normal: 6000 });
    const tag = await repo.createTag({ nama: "Promo" });
    await repo.addTagToSKU(sku1.id!, tag.id!);
    await repo.addTagToSKU(sku2.id!, tag.id!);

    await repo.deleteTag(tag.id!);

    expect(await testDb.tags.get(tag.id!)).toBeUndefined();
    const remainingLinks = await testDb.sku_tags.where("tag_id").equals(tag.id!).toArray();
    expect(remainingLinks).toHaveLength(0);
    expect(await testDb.skus.get(sku1.id!)).toBeDefined();
    expect(await testDb.skus.get(sku2.id!)).toBeDefined();
    expect((await repo.listTagsBySKU(sku1.id!))).toHaveLength(0);
    expect((await repo.listTagsBySKU(sku2.id!))).toHaveLength(0);
  });

  test("delete tag tidak ditemukan → error", async () => {
    await expect(repo.deleteTag(99999)).rejects.toThrow("tidak ditemukan");
  });

  test("filter tag TIDAK pengaruhi threshold/notif — tag hanya label", async () => {
    const k = await repo.createKategori({ nama: "Dairy", threshold_h_minus: [7, 3, 1] });
    const sku = await repo.createSKU({ nama: "Susu", kategori_id: k.id!, hpp: 10000, harga_normal: 15000 });
    const tag = await repo.createTag({ nama: "Promo" });
    await repo.addTagToSKU(sku.id!, tag.id!);
    const gotK = await repo.getKategori(k.id!);
    expect(gotK?.threshold_h_minus).toEqual([7, 3, 1]);
  });
});
