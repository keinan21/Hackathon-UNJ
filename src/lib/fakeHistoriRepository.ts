// FakeHistoriRepository — no dexie, mock histori saran 10 descending for dashboard 3 seksi
export type HistoriItem = {
  id: string;
  aksi: string;
  alasan: string;
  pasangan: string;
  harga_tebus: number;
  harga_floor: number;
  sku_name: string;
  sku_pasangan_name: string;
  created_at: string; // ISO
  confidence: number;
  org_id: string;
};

function daysAgoISO(daysAgo: number): string {
  const d = new Date(Date.now() - daysAgo * 86400000);
  return d.toISOString();
}

const templates: Omit<HistoriItem, "id" | "created_at">[] = [
  { aksi: "Tebus Murah Susu UHT 1L + Roti Tawar", alasan: "Susu mau kadaluarsa 2 hari lagi, pasangkan dengan roti yang laris biar cepat habis tanpa rugi.", pasangan: "Roti Tawar", harga_tebus: 9000, harga_floor: 8500, sku_name: "Susu UHT 1L", sku_pasangan_name: "Roti Tawar", confidence: 0.92, org_id: "toko-01" },
  { aksi: "Tebus Murah Yoghurt Cup 100ml + Roti Tawar", alasan: "Yoghurt H-1 segera promo biar tidak terbuang.", pasangan: "Roti Tawar", harga_tebus: 7200, harga_floor: 6800, sku_name: "Yoghurt Cup 100ml", sku_pasangan_name: "Roti Tawar", confidence: 0.88, org_id: "toko-01" },
  { aksi: "Tebus Murah Roti Tawar + Susu UHT 1L", alasan: "Roti mepet H-2, pasangkan susu untuk paket sarapan.", pasangan: "Susu UHT 1L", harga_tebus: 4800, harga_floor: 4250, sku_name: "Roti Tawar", sku_pasangan_name: "Susu UHT 1L", confidence: 0.85, org_id: "toko-01" },
  { aksi: "Tebus Murah Susu UHT 1L + Snack", alasan: "Stok susu banyak, pairing snack dorong volume.", pasangan: "Snack", harga_tebus: 9500, harga_floor: 8500, sku_name: "Susu UHT 1L", sku_pasangan_name: "Snack", confidence: 0.81, org_id: "toko-01" },
  { aksi: "Tebus Murah Keju Slice + Roti Tawar", alasan: "Keju H-3, bundling roti hemat.", pasangan: "Roti Tawar", harga_tebus: 11000, harga_floor: 10200, sku_name: "Keju Slice", sku_pasangan_name: "Roti Tawar", confidence: 0.79, org_id: "toko-01" },
  { aksi: "Tebus Murah Yoghurt + Buah Potong", alasan: "Yoghurt dekat expiry, buah segar laris.", pasangan: "Buah Potong", harga_tebus: 6500, harga_floor: 6000, sku_name: "Yoghurt Cup 100ml", sku_pasangan_name: "Buah Potong", confidence: 0.77, org_id: "toko-01" },
  { aksi: "Tebus Murah Beras 5kg + Minyak", alasan: "Beras H-7, promo minyak biar gerak.", pasangan: "Minyak Goreng", harga_tebus: 48000, harga_floor: 42500, sku_name: "Beras 5kg", sku_pasangan_name: "Minyak Goreng", confidence: 0.74, org_id: "toko-01" },
  { aksi: "Tebus Murah Susu UHT 1L + Kopi", alasan: "Paket kopi susu pagi laris.", pasangan: "Kopi Sachet", harga_tebus: 9200, harga_floor: 8500, sku_name: "Susu UHT 1L", sku_pasangan_name: "Kopi Sachet", confidence: 0.72, org_id: "toko-01" },
  { aksi: "Tebus Murah Roti Tawar + Selai", alasan: "Roti mepet, selai pendamping.", pasangan: "Selai Coklat", harga_tebus: 5000, harga_floor: 4250, sku_name: "Roti Tawar", sku_pasangan_name: "Selai Coklat", confidence: 0.70, org_id: "toko-01" },
  { aksi: "Tebus Murah Snack + Minuman", alasan: "Snack H-2, bundling minuman.", pasangan: "Minuman", harga_tebus: 6000, harga_floor: 5100, sku_name: "Snack", sku_pasangan_name: "Minuman", confidence: 0.68, org_id: "toko-01" },
];

export function createDemoHistori(): HistoriItem[] {
  return templates.map((t, i) => ({
    ...t,
    id: `hist-${i + 1}`,
    created_at: daysAgoISO(i),
  }));
}

export const demoHistori = createDemoHistori();

export function getHistoriTerbaru(limit = 5): HistoriItem[] {
  return [...demoHistori].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()).slice(0, limit);
}

export function getHistoriById(id: string): HistoriItem | undefined {
  return demoHistori.find((h) => h.id === id);
}
