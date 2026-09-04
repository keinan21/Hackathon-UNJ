import type { SKU, Batch, Kategori, Transaksi, Promo, AdvisorCacheEntry } from './types';

// sync-ready sharding, v1 single org toko-01
export interface InventoryRepository {
  // SKU
  listSkus(orgId: string): Promise<SKU[]>;
  getSku(id: string): Promise<SKU | undefined>;
  createSku(sku: SKU): Promise<void>;
  updateSku(sku: SKU): Promise<void>;
  // Kategori
  listKategoris(orgId: string): Promise<Kategori[]>;
  getKategori(id: string): Promise<Kategori | undefined>;
  createKategori(k: Kategori): Promise<void>;
  updateKategoriThreshold(id: string, threshold: number[]): Promise<void>;
  // Batch
  listBatchesBySku(skuId: string, orgId: string): Promise<Batch[]>;
  listBatchesExpiring(orgId: string): Promise<Batch[]>; // expiry_date != null
  getBatch(id: string): Promise<Batch | undefined>;
  createBatch(batch: Batch): Promise<void>;
  updateBatch(batch: Batch): Promise<void>;
  // Transaksi
  listTransaksis(orgId: string): Promise<Transaksi[]>;
  listTransaksisBySku(skuId: string, orgId: string): Promise<Transaksi[]>;
  createTransaksi(t: Transaksi): Promise<void>;
  // Promo
  listPromos(orgId: string, status?: Promo['status']): Promise<Promo[]>;
  getPromo(id: string): Promise<Promo | undefined>;
  createPromo(promo: Promo): Promise<void>;
  updatePromo(promo: Promo): Promise<void>;
  deletePromo(id: string): Promise<void>;
  // AdvisorCache
  getAdvisorCache(batchId: string, orgId: string): Promise<AdvisorCacheEntry | undefined>;
  setAdvisorCache(entry: AdvisorCacheEntry): Promise<void>;
  listAdvisorCache(orgId: string): Promise<AdvisorCacheEntry[]>;
  clearAdvisorCache(orgId: string): Promise<void>;
}
