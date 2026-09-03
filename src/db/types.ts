export interface SKU {
  id: string;
  nama: string;
  kategori_id: string;
  hpp: number;
  harga_normal: number;
  barcode?: string;
  kode?: string;
  org_id: string; // sync-ready sharding, v1 single org toko-01
}

export interface Kategori {
  id: string;
  nama: string;
  threshold_h_minus: number[];
  org_id: string;
}

export interface Batch {
  id: string;
  sku_id: string;
  qty: number;
  expiry_date: string | null; // ISO date string, null = non-perishable skip engine
  received_at: string; // ISO
  hpp_snapshot: number;
  org_id: string;
}

export interface Transaksi {
  id: string;
  sku_id: string;
  qty_sold: number;
  sold_at: string; // ISO
  org_id: string;
  jenis?: "masuk" | "keluar" | "opname" | string;
  harga_jual_snapshot?: number;
  pengirim?: string | null;
  penerima?: string | null;
  catatan?: string | null;
}

export interface Tag {
  id: string;
  nama: string;
  org_id: string;
}

export interface SkuTag {
  id: string;
  sku_id: string;
  tag_id: string;
  org_id: string;
}

export interface HppHistory {
  id: string;
  sku_id: string;
  hpp_lama: number;
  hpp_baru: number;
  created_at: string;
  org_id: string;
}

export interface Promo {
  id: string;
  batch_id: string;
  sku_pasangan_id: string | null;
  harga_tebus: number;
  status: 'proposed' | 'active' | 'expired' | 'consumed';
  org_id: string;
  created_at: string;
  updated_at?: string;
}

export interface AdvisorSuggestion {
  batch_id: string;
  aksi: string;
  alasan: string;
  pasangan_tebus_murah: string | null; // sku_pasangan_id
  harga_tebus: number;
  estimasi_margin: number;
  confidence: 'Tinggi' | 'Sedang' | 'Rendah';
  created_at: string;
}

export interface AdvisorCacheEntry {
  id: string;
  org_id: string;
  batch_id: string;
  suggestion: AdvisorSuggestion;
  created_at: string; // for TTL
}
