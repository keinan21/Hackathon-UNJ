import type { InventoryRepository } from './repository';
import type { SKU, Batch, Kategori, Transaksi, Promo, AdvisorCacheEntry } from './types';

export class FakeInventoryRepository implements InventoryRepository {
  skus = new Map<string, SKU>();
  kategoris = new Map<string, Kategori>();
  batches = new Map<string, Batch>();
  transaksis = new Map<string, Transaksi>();
  promos = new Map<string, Promo>();
  advisorCache = new Map<string, AdvisorCacheEntry>(); // key: orgId:batchId

  async listSkus(orgId: string) {
    return [...this.skus.values()].filter(s => s.org_id === orgId);
  }
  async getSku(id: string) { return this.skus.get(id); }
  async createSku(sku: SKU) { this.skus.set(sku.id, sku); }
  async updateSku(sku: SKU) { this.skus.set(sku.id, sku); }

  async listKategoris(orgId: string) {
    return [...this.kategoris.values()].filter(k => k.org_id === orgId);
  }
  async getKategori(id: string) { return this.kategoris.get(id); }
  async createKategori(k: Kategori) { this.kategoris.set(k.id, k); }
  async updateKategoriThreshold(id: string, threshold: number[]) {
    const k = this.kategoris.get(id);
    if (!k) throw new Error('Kategori not found');
    // validation: non-empty, descending, >0, no dup - same as TASK-05
    if (!threshold.length) throw new Error('Threshold tidak boleh kosong');
    if (new Set(threshold).size !== threshold.length) throw new Error('Angka tidak boleh sama');
    for (let i = 1; i < threshold.length; i++) {
      if (threshold[i] >= threshold[i-1]) throw new Error('Harus urut besar ke kecil');
    }
    if (threshold.some(v => v <= 0)) throw new Error('Harus lebih dari 0');
    this.kategoris.set(id, { ...k, threshold_h_minus: threshold });
  }

  async listBatchesBySku(skuId: string, orgId: string) {
    return [...this.batches.values()]
      .filter(b => b.sku_id === skuId && b.org_id === orgId)
      .sort((a, b) => {
        if (a.expiry_date === null && b.expiry_date === null) return 0;
        if (a.expiry_date === null) return 1;
        if (b.expiry_date === null) return -1;
        return a.expiry_date.localeCompare(b.expiry_date);
      });
  }
  async listBatchesExpiring(orgId: string) {
    return [...this.batches.values()].filter(b => b.org_id === orgId && b.expiry_date !== null);
  }
  async getBatch(id: string) { return this.batches.get(id); }
  async createBatch(batch: Batch) { this.batches.set(batch.id, batch); }
  async updateBatch(batch: Batch) { this.batches.set(batch.id, batch); }

  async listTransaksis(orgId: string) {
    return [...this.transaksis.values()].filter(t => t.org_id === orgId);
  }
  async listTransaksisBySku(skuId: string, orgId: string) {
    return [...this.transaksis.values()].filter(t => t.sku_id === skuId && t.org_id === orgId);
  }
  async createTransaksi(t: Transaksi) { this.transaksis.set(t.id, t); }

  async listPromos(orgId: string, status?: Promo['status']) {
    let list = [...this.promos.values()].filter(p => p.org_id === orgId);
    if (status) list = list.filter(p => p.status === status);
    return list;
  }
  async getPromo(id: string) { return this.promos.get(id); }
  async createPromo(promo: Promo) { this.promos.set(promo.id, promo); }
  async updatePromo(promo: Promo) { this.promos.set(promo.id, promo); }

  async getAdvisorCache(batchId: string, orgId: string) {
    return this.advisorCache.get(`${orgId}:${batchId}`);
  }
  async setAdvisorCache(entry: AdvisorCacheEntry) {
    this.advisorCache.set(`${entry.org_id}:${entry.batch_id}`, entry);
  }
  async listAdvisorCache(orgId: string) {
    return [...this.advisorCache.values()].filter(c => c.org_id === orgId);
  }
  async clearAdvisorCache(orgId: string) {
    for (const k of [...this.advisorCache.keys()]) {
      if (k.startsWith(`${orgId}:`)) this.advisorCache.delete(k);
    }
  }

  clear() {
    this.skus.clear(); this.kategoris.clear(); this.batches.clear();
    this.transaksis.clear(); this.promos.clear(); this.advisorCache.clear();
  }
}
