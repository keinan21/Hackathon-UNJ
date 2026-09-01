/**
 * TASK-02 [FRD-02]: Dexie DB schema + InventoryRepository interface + migrations
 *
 * Local-first (ADR-001): semua akses data via InventoryRepository interface,
 * impl Dexie. org_id default "toko-01" — sync-ready sharding 1→10 toko,
 * TANPA cloud sync logic di v1 (guardrail AGENTS.md).
 *
 * Glossary (CONTEXT.md): SKU = jenis barang (tanpa expiry), Batch = stok fisik
 * dengan expiry masing-masing, expiry null = non-perishable (skip engine).
 */

import Dexie, { type Table } from "dexie";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** org_id default — sync-ready sharding, reserved untuk 1→10 toko (v1 single value) */
export const DEFAULT_ORG_ID = "toko-01"; // sync-ready sharding

export interface Kategori {
  id?: number;
  nama: string;
  /** H- threshold array, editable, default [7,3,1] */
  threshold_h_minus: number[];
  org_id: string; // sync-ready sharding
}

export interface SKU {
  id?: number;
  /** wajib, tidak kosong */
  nama: string;
  /** wajib, FK ke kategoris.id */
  kategori_id: number;
  /** angka > 0 */
  hpp: number;
  /** >= hpp (warning jika di bawah, bukan reject — FRD-02) */
  harga_normal: number;
  barcode?: string;
  org_id: string; // sync-ready sharding
}

export interface Batch {
  id?: number;
  /** wajib, FK ke skus.id */
  sku_id: number;
  /** > 0 */
  qty: number;
  /** null = non-perishable, TIDAK masuk engine expiry */
  expiry_date: string | null; // ISO date "YYYY-MM-DD"
  /** auto now saat insert */
  received_at: string; // ISO datetime
  /** copy hpp SKU saat terima barang */
  hpp_snapshot: number;
  org_id: string; // sync-ready sharding
}

export interface Transaksi {
  id?: number;
  /** FK ke skus.id */
  sku_id: number;
  qty_sold: number;
  sold_at: string; // ISO datetime
  org_id: string; // sync-ready sharding
}

export interface Promo {
  id?: number;
  /** status lifecycle: proposed → active → expired/consumed */
  status: "proposed" | "active" | "expired" | "consumed";
  batch_id: number;
  sku_pasangan_id: number;
  harga_tebus: number;
  hpp_snapshot: number;
  created_at: string; // ISO datetime
  updated_at: string; // ISO datetime
  org_id: string; // sync-ready sharding
}

export interface AdvisorCache {
  key: string;
  /** JSON.stringify dari AdvisorSuggestion list (CONTEXT.md) */
  payload: string;
  created_at: string; // ISO datetime
  org_id: string; // sync-ready sharding
}

// ---------------------------------------------------------------------------
// DB + schema
// ---------------------------------------------------------------------------

export class InventoryDB extends Dexie {
  skus!: Table<SKU, number>;
  kategoris!: Table<Kategori, number>;
  batches!: Table<Batch, number>;
  transaksis!: Table<Transaksi, number>;
  promos!: Table<Promo, number>;
  advisorCache!: Table<AdvisorCache, string>;

  constructor(name = "inventaris-tebus-murah") {
    super(name);
    this.version(1).stores({
      // Primary key ++id; index sisanya. SKU TIDAK punya expiry (FRD-02 guardrail).
      skus: "++id, nama, kategori_id, barcode, org_id",
      kategoris: "++id, nama, org_id",
      // expiry_date nullable: Dexie tidak index null → batch non-perishable
      // otomatis tidak muncul di query by expiry_date (skip engine, CONTEXT.md).
      batches: "++id, sku_id, expiry_date, org_id, [org_id+sku_id]",
      transaksis: "++id, sku_id, sold_at, org_id",
      promos: "++id, status, batch_id, org_id",
      advisorCache: "key, org_id",
    });
  }
}

export const db = new InventoryDB();

// ---------------------------------------------------------------------------
// InventoryRepository interface
// ---------------------------------------------------------------------------

/**
 * Contract tunggal untuk semua akses data (ADR-001 Repository pattern).
 * UI/engine/advisor TIDAK boleh import dexie langsung — lewat interface ini.
 */
export interface InventoryRepository {
  // Kategori
  createKategori(k: Omit<Kategori, "id" | "org_id"> & { org_id?: string }): Promise<Kategori>;
  getKategori(id: number): Promise<Kategori | undefined>;
  listKategoris(org_id?: string): Promise<Kategori[]>;
  updateKategoriThreshold(id: number, threshold_h_minus: number[]): Promise<Kategori>;

  // SKU
  createSKU(s: Omit<SKU, "id" | "org_id"> & { org_id?: string }): Promise<SKU>;
  getSKU(id: number): Promise<SKU | undefined>;
  listSKUsByKategori(kategori_id: number, org_id?: string): Promise<SKU[]>;

  // Batch
  createBatch(b: Omit<Batch, "id" | "received_at" | "org_id"> & { received_at?: string; org_id?: string }): Promise<Batch>;
  listBatchesBySKU(sku_id: number, org_id?: string): Promise<Batch[]>;
  /** Batch dengan expiry != null, urut expiry paling dekat dulu */
  listBatchesExpiring(org_id?: string): Promise<Batch[]>;
  updateBatchQty(id: number, qty: number): Promise<Batch>;

  // Transaksi
  createTransaksi(t: Omit<Transaksi, "id" | "org_id"> & { org_id?: string }): Promise<Transaksi>;
  listTransaksisBySKU(sku_id: number, since: string, org_id?: string): Promise<Transaksi[]>;

  // Promo
  createPromo(p: Omit<Promo, "id" | "created_at" | "updated_at" | "org_id"> & { org_id?: string }): Promise<Promo>;
  listPromosByStatus(status: Promo["status"], org_id?: string): Promise<Promo[]>;
  updatePromoStatus(id: number, status: Promo["status"]): Promise<Promo>;

  // AdvisorCache
  setAdvisorCache(key: string, payload: string, org_id?: string): Promise<AdvisorCache>;
  getAdvisorCache(key: string, org_id?: string): Promise<AdvisorCache | undefined>;
}

// ---------------------------------------------------------------------------
// Validasi (bahasa Indonesia, FRD-02)
// ---------------------------------------------------------------------------

export class ValidationError extends Error {}

function assertOrgId(org_id?: string): string {
  return org_id ?? DEFAULT_ORG_ID;
}

function validateKategori(k: { nama: string; threshold_h_minus: number[] }): void {
  if (!k.nama || k.nama.trim().length === 0) throw new ValidationError("Nama kategori tidak boleh kosong");
}

function validateSKU(s: { nama: string; kategori_id: number; hpp: number; harga_normal: number }): void {
  if (!s.nama || s.nama.trim().length === 0) throw new ValidationError("Nama SKU tidak boleh kosong");
  if (!Number.isInteger(s.kategori_id) || s.kategori_id <= 0)
    throw new ValidationError("kategori_id wajib dan harus angka valid");
  if (!(s.hpp > 0)) throw new ValidationError("HPP harus lebih dari 0");
  if (s.harga_normal < s.hpp) throw new ValidationError("harga_normal tidak boleh di bawah HPP");
}

function validateBatch(b: { sku_id: number; qty: number }): void {
  if (!Number.isInteger(b.sku_id) || b.sku_id <= 0)
    throw new ValidationError("sku_id wajib dan harus angka valid");
  if (!(b.qty > 0)) throw new ValidationError("Qty harus lebih dari 0");
}

// ---------------------------------------------------------------------------
// DexieRepository impl
// ---------------------------------------------------------------------------

export class DexieRepository implements InventoryRepository {
  constructor(private readonly d: InventoryDB = db) {}

  // Kategori ---------------------------------------------------------------

  async createKategori(k: Omit<Kategori, "id" | "org_id"> & { org_id?: string }): Promise<Kategori> {
    validateKategori(k);
    const org = assertOrgId(k.org_id);
    const id = await this.d.kategoris.add({ ...k, org_id: org });
    return { ...k, org_id: org, id };
  }

  async getKategori(id: number): Promise<Kategori | undefined> {
    return this.d.kategoris.get(id);
  }

  async listKategoris(org_id?: string): Promise<Kategori[]> {
    const org = assertOrgId(org_id);
    return this.d.kategoris.where("org_id").equals(org).toArray();
  }

  async updateKategoriThreshold(id: number, threshold_h_minus: number[]): Promise<Kategori> {
    if (!Array.isArray(threshold_h_minus) || threshold_h_minus.length === 0)
      throw new ValidationError("Threshold tidak boleh kosong");
    if (threshold_h_minus.some((t) => !(t > 0)))
      throw new ValidationError("Threshold harus lebih dari 0");
    if (new Set(threshold_h_minus).size !== threshold_h_minus.length)
      throw new ValidationError("Angka threshold tidak boleh sama");
    for (let i = 1; i < threshold_h_minus.length; i++) {
      if (threshold_h_minus[i] >= threshold_h_minus[i - 1])
        throw new ValidationError("Threshold harus urut besar ke kecil");
    }
    const k = await this.d.kategoris.get(id);
    if (!k) throw new ValidationError(`Kategori ${id} tidak ditemukan`);
    await this.d.kategoris.update(id, { threshold_h_minus });
    return { ...k, threshold_h_minus };
  }

  // SKU --------------------------------------------------------------------

  async createSKU(s: Omit<SKU, "id" | "org_id"> & { org_id?: string }): Promise<SKU> {
    validateSKU(s);
    const org = assertOrgId(s.org_id);
    const id = await this.d.skus.add({ ...s, org_id: org });
    return { ...s, org_id: org, id };
  }

  async getSKU(id: number): Promise<SKU | undefined> {
    return this.d.skus.get(id);
  }

  async listSKUsByKategori(kategori_id: number, org_id?: string): Promise<SKU[]> {
    const org = assertOrgId(org_id);
    return this.d.skus.where("kategori_id").equals(kategori_id).and((s) => s.org_id === org).toArray();
  }

  // Batch ------------------------------------------------------------------

  async createBatch(
    b: Omit<Batch, "id" | "received_at" | "org_id"> & { received_at?: string; org_id?: string }
  ): Promise<Batch> {
    validateBatch(b);
    const org = assertOrgId(b.org_id);
    const received_at = b.received_at ?? new Date().toISOString();
    const id = await this.d.batches.add({ ...b, received_at, org_id: org });
    return { ...b, received_at, org_id: org, id };
  }

  async listBatchesBySKU(sku_id: number, org_id?: string): Promise<Batch[]> {
    const org = assertOrgId(org_id);
    return this.d.batches
      .where("sku_id")
      .equals(sku_id)
      .and((x) => x.org_id === org)
      .sortBy("expiry_date");
  }

  async listBatchesExpiring(org_id?: string): Promise<Batch[]> {
    const org = assertOrgId(org_id);
    // expiry_date != null (non-perishable null tidak ter-index → skip otomatis)
    return this.d.batches
      .where("expiry_date")
      .notEqual("")
      .and((x) => x.expiry_date !== null && x.org_id === org)
      .sortBy("expiry_date");
  }

  async updateBatchQty(id: number, qty: number): Promise<Batch> {
    if (!(qty > 0)) throw new ValidationError("Qty harus lebih dari 0");
    const b = await this.d.batches.get(id);
    if (!b) throw new ValidationError(`Batch ${id} tidak ditemukan`);
    await this.d.batches.update(id, { qty });
    return { ...b, qty };
  }

  // Transaksi --------------------------------------------------------------

  async createTransaksi(t: Omit<Transaksi, "id" | "org_id"> & { org_id?: string }): Promise<Transaksi> {
    const org = assertOrgId(t.org_id);
    const id = await this.d.transaksis.add({ ...t, org_id: org });
    return { ...t, org_id: org, id };
  }

  async listTransaksisBySKU(sku_id: number, since: string, org_id?: string): Promise<Transaksi[]> {
    const org = assertOrgId(org_id);
    return this.d.transaksis
      .where("sku_id")
      .equals(sku_id)
      .and((x) => x.org_id === org && x.sold_at >= since)
      .sortBy("sold_at");
  }

  // Promo ------------------------------------------------------------------

  async createPromo(
    p: Omit<Promo, "id" | "created_at" | "updated_at" | "org_id"> & { org_id?: string }
  ): Promise<Promo> {
    const org = assertOrgId(p.org_id);
    const now = new Date().toISOString();
    const row = { ...p, created_at: now, updated_at: now, org_id: org };
    const id = await this.d.promos.add(row);
    return { ...row, id };
  }

  async listPromosByStatus(status: Promo["status"], org_id?: string): Promise<Promo[]> {
    const org = assertOrgId(org_id);
    return this.d.promos.where("status").equals(status).and((x) => x.org_id === org).toArray();
  }

  async updatePromoStatus(id: number, status: Promo["status"]): Promise<Promo> {
    const p = await this.d.promos.get(id);
    if (!p) throw new ValidationError(`Promo ${id} tidak ditemukan`);
    const updated = { ...p, status, updated_at: new Date().toISOString() };
    await this.d.promos.put(updated);
    return updated;
  }

  // AdvisorCache -----------------------------------------------------------

  async setAdvisorCache(key: string, payload: string, org_id?: string): Promise<AdvisorCache> {
    const org = assertOrgId(org_id);
    const row: AdvisorCache = { key, payload, created_at: new Date().toISOString(), org_id: org };
    await this.d.advisorCache.put(row);
    return row;
  }

  async getAdvisorCache(key: string, org_id?: string): Promise<AdvisorCache | undefined> {
    const org = assertOrgId(org_id);
    return this.d.advisorCache.get({ key, org_id: org } as unknown as string);
  }
}
