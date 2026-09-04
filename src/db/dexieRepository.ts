import Dexie, { type Table } from "dexie";
import type { SKU, Batch, Kategori, Transaksi, Promo, AdvisorCacheEntry, Tag, SkuTag, HppHistory } from "./types";
import type { InventoryRepository } from "./repository";

/**
 * Dexie real untuk string ids (v2) — dipakai UI real.
 * - org_id default toko-01 sync-ready sharding, tanpa cloud sync v1
 * - expiry_date null = non-perishable skip engine (tidak di-index)
 */
export class InventarisDexie extends Dexie {
  skus!: Table<SKU, string>;
  kategoris!: Table<Kategori, string>;
  batches!: Table<Batch, string>;
  transaksis!: Table<Transaksi, string>;
  promos!: Table<Promo, string>;
  advisorCache!: Table<AdvisorCacheEntry, [string, string]>; // key [org_id+batch_id]
  tags!: Table<Tag, string>;
  sku_tags!: Table<SkuTag, string>;
  hpp_history!: Table<HppHistory, string>;

  constructor(name = "inventaris-tebus-murah-v2") {
    super(name);
    this.version(1).stores({
      skus: "id, org_id, kategori_id",
      kategoris: "id, org_id",
      batches: "id, org_id, sku_id, expiry_date",
      transaksis: "id, org_id, sku_id, sold_at",
      promos: "id, org_id, status, batch_id",
      advisorCache: "[org_id+batch_id], org_id, batch_id, created_at",
    });
    this.version(2).stores({
      batches: "id, org_id, sku_id, expiry_date, [org_id+sku_id]",
      transaksis: "id, org_id, sku_id, sold_at, [org_id+sku_id]",
    });
    this.version(3).stores({
      skus: "id, org_id, kategori_id, kode, &[org_id+kode]",
      transaksis: "id, org_id, sku_id, sold_at, [org_id+sku_id], jenis, harga_jual_snapshot",
      tags: "id, org_id, nama, &[org_id+nama]",
      sku_tags: "id, org_id, sku_id, tag_id, &[sku_id+tag_id], [org_id+sku_id]",
      hpp_history: "id, org_id, sku_id, created_at, [org_id+sku_id]",
    });
  }
}

export const dexieV2 = new InventarisDexie();

export class DexieInventoryRepository implements InventoryRepository {
  constructor(private db: InventarisDexie = dexieV2) {}

  // SKU
  async listSkus(orgId: string) {
    return this.db.skus.where("org_id").equals(orgId).toArray();
  }
  async getSku(id: string) {
    return this.db.skus.get(id);
  }
  async createSku(sku: SKU) {
    await this.db.skus.put(sku);
  }
  async updateSku(sku: SKU) {
    await this.db.skus.put(sku);
  }
  // Kategori
  async listKategoris(orgId: string) {
    return this.db.kategoris.where("org_id").equals(orgId).toArray();
  }
  async getKategori(id: string) {
    return this.db.kategoris.get(id);
  }
  async createKategori(k: Kategori) {
    await this.db.kategoris.put({ ...k, id: k.id ?? crypto.randomUUID(), org_id: k.org_id ?? "toko-01" });
  }
  async updateKategoriThreshold(id: string, threshold: number[]) {
    const k = await this.db.kategoris.get(id);
    if (!k) throw new Error("Kategori not found");
    if (!threshold.length) throw new Error("Threshold tidak boleh kosong");
    if (new Set(threshold).size !== threshold.length) throw new Error("Angka tidak boleh sama");
    for (let i = 1; i < threshold.length; i++) if (threshold[i] >= threshold[i - 1]) throw new Error("Harus menurun");
    if (threshold.some((v) => v <= 0)) throw new Error("Harus lebih dari 0");
    await this.db.kategoris.put({ ...k, threshold_h_minus: threshold });
  }
  // Batch
  async listBatchesBySku(skuId: string, orgId: string) {
    return this.db.batches.where("[org_id+sku_id]").equals([orgId, skuId]).toArray().then((arr) =>
      arr.sort((a, b) => {
        if (a.expiry_date === null && b.expiry_date === null) return 0;
        if (a.expiry_date === null) return 1;
        if (b.expiry_date === null) return -1;
        return a.expiry_date.localeCompare(b.expiry_date);
      }),
    );
  }
  async listBatchesExpiring(orgId: string) {
    return this.db.batches.where("org_id").equals(orgId).filter((b) => b.expiry_date !== null).toArray();
  }
  async getBatch(id: string) {
    return this.db.batches.get(id);
  }
  async createBatch(batch: Batch) {
    await this.db.batches.put(batch);
  }
  async updateBatch(batch: Batch) {
    await this.db.batches.put(batch);
  }
  // Transaksi
  async listTransaksis(orgId: string) {
    return this.db.transaksis.where("org_id").equals(orgId).toArray();
  }
  async listTransaksisBySku(skuId: string, orgId: string) {
    return this.db.transaksis.where("[org_id+sku_id]").equals([orgId, skuId]).toArray();
  }
  async createTransaksi(t: Transaksi) {
    await this.db.transaksis.put(t);
  }
  // Promo
  async listPromos(orgId: string, status?: Promo["status"]) {
    let col = this.db.promos.where("org_id").equals(orgId);
    const list = await col.toArray();
    return status ? list.filter((p) => p.status === status) : list;
  }
  async getPromo(id: string) {
    return this.db.promos.get(id);
  }
  async createPromo(promo: Promo) {
    await this.db.promos.put(promo);
  }
  async updatePromo(promo: Promo) {
    await this.db.promos.put(promo);
  }
  async deletePromo(id: string) {
    await this.db.promos.delete(id);
  }
  // AdvisorCache
  async getAdvisorCache(batchId: string, orgId: string) {
    return this.db.advisorCache.get([orgId, batchId]);
  }
  async setAdvisorCache(entry: AdvisorCacheEntry) {
    await this.db.advisorCache.put(entry);
  }
  async listAdvisorCache(orgId: string) {
    return this.db.advisorCache.where("org_id").equals(orgId).toArray();
  }
  async clearAdvisorCache(orgId: string) {
    await this.db.advisorCache.where("org_id").equals(orgId).delete();
  }

  async clearAll(orgId = "toko-01") {
    await this.db.transaction(
      "rw",
      [this.db.skus, this.db.kategoris, this.db.batches, this.db.transaksis, this.db.promos, this.db.advisorCache, this.db.tags, this.db.sku_tags, this.db.hpp_history],
      async () => {
        for (const t of [this.db.skus, this.db.kategoris, this.db.batches, this.db.transaksis, this.db.promos, this.db.advisorCache, this.db.tags, this.db.sku_tags, this.db.hpp_history] as Table<any, any>[]) {
          await t.where("org_id").equals(orgId).delete();
        }
      },
    );
  }
}

export const realRepo = new DexieInventoryRepository(dexieV2);
