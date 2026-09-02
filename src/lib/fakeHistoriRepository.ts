// fakeHistoriRepository — Crew A isolated, no dexie, in-memory histori for TASK-17
export type HistoriItem = {
  id: string;
  created_at: string; // ISO
  batch_name: string;
  sku_pasangan_name: string;
  aksi: string;
  alasan: string;
  pasangan: string;
  harga_tebus: number;
  confidence: "Tinggi" | "Sedang" | "Rendah";
  org_id: string;
};

function daysAgoISO(daysAgo: number, hourJakarta = 7): string {
  const now = new Date();
  // create date at 07:05 WIB ago
  const d = new Date(now);
  d.setDate(d.getDate() - daysAgo);
  // set to 07:05 WIB — approximate as UTC+7: set UTC and add offset
  // simpler: use local and set hours 7, then toISOString
  // for histori we just need distinct created_at desc order, so use now minus days
  return new Date(now.getTime() - daysAgo * 24 * 60 * 60 * 1000 - Math.random() * 3600000).toISOString();
}

export function createDemoHistori(count = 10): HistoriItem[] {
  const templates: Omit<HistoriItem, "id" | "created_at" | "org_id">[] = [
    {
      batch_name: "Susu UHT 1L",
      sku_pasangan_name: "Roti Tawar",
      aksi: "Tebus Murah Susu UHT 1L + Roti Tawar",
      alasan: "Susu mau kadaluarsa 2 hari lagi, pasangkan dengan roti yang laris biar cepat habis tanpa rugi.",
      pasangan: "Roti Tawar",
      harga_tebus: 9000,
      confidence: "Tinggi",
    },
    {
      batch_name: "Yoghurt Cup 100ml",
      sku_pasangan_name: "Snack Regal",
      aksi: "Tebus Murah Yoghurt + Snack Regal",
      alasan: "Yoghurt H-1 segera promo biar tidak terbuang, snack manis jadi pemanis.",
      pasangan: "Snack Regal",
      harga_tebus: 7200,
      confidence: "Tinggi",
    },
    {
      batch_name: "Susu UHT 500ml",
      sku_pasangan_name: "Biskuit Roma",
      aksi: "Tebus Murah Susu 500ml + Biskuit",
      alasan: "Stok susu mau habis masa, pasang dengan biskuit laris biar cepat laku.",
      pasangan: "Biskuit Roma",
      harga_tebus: 8500,
      confidence: "Sedang",
    },
    {
      batch_name: "Keju Slice",
      sku_pasangan_name: "Roti Tawar",
      aksi: "Tebus Murah Keju + Roti",
      alasan: "Keju H-3 butuh dorongan, roti pasangan alami sarapan.",
      pasangan: "Roti Tawar",
      harga_tebus: 11000,
      confidence: "Sedang",
    },
    {
      batch_name: "Yoghurt Drink 200ml",
      sku_pasangan_name: "Snack Chitato",
      aksi: "Tebus Murah Yoghurt Drink + Chitato",
      alasan: "Minuman yoghurt H-2, padankan snack asin biar kombo menarik.",
      pasangan: "Snack Chitato",
      harga_tebus: 6500,
      confidence: "Rendah",
    },
    {
      batch_name: "Susu UHT Coklat",
      sku_pasangan_name: "Roti Tawar Gandum",
      aksi: "Tebus Murah Susu Coklat + Roti Gandum",
      alasan: "Varian coklat H-3, gandum laris pagi hari.",
      pasangan: "Roti Tawar Gandum",
      harga_tebus: 9500,
      confidence: "Tinggi",
    },
    {
      batch_name: "Puding Cup",
      sku_pasangan_name: "Susu UHT 1L",
      aksi: "Tebus Murah Puding + Susu",
      alasan: "Puding H-1 paling urgent, susu jadi penyeimbang.",
      pasangan: "Susu UHT 1L",
      harga_tebus: 5500,
      confidence: "Sedang",
    },
    {
      batch_name: "Yakult 5s",
      sku_pasangan_name: "Biskuit Marie",
      aksi: "Tebus Murah Yakult + Marie",
      alasan: "Yakult H-2 butuh cepat, Marie pelengkap teh.",
      pasangan: "Biskuit Marie",
      harga_tebus: 7000,
      confidence: "Tinggi",
    },
    {
      batch_name: "Susu UHT Stroberi",
      sku_pasangan_name: "Roti Sobek",
      aksi: "Tebus Murah Susu Stroberi + Roti Sobek",
      alasan: "Stroberi kurang laku, roti sobek bantu tarik.",
      pasangan: "Roti Sobek",
      harga_tebus: 8800,
      confidence: "Rendah",
    },
    {
      batch_name: "Yoghurt Plain",
      sku_pasangan_name: "Granola Bar",
      aksi: "Tebus Murah Yoghurt Plain + Granola",
      alasan: "Plain butuh edukasi, granola sehat jadi pasangan.",
      pasangan: "Granola Bar",
      harga_tebus: 7800,
      confidence: "Sedang",
    },
  ];
  return templates.slice(0, count).map((t, i) => ({
    ...t,
    id: `hist-${i + 1}`,
    created_at: daysAgoISO(i),
    org_id: "toko-01",
  }));
}

// Helper: get 5 terbaru sorted desc
export function getHistoriTerbaru(items: HistoriItem[], limit = 5): HistoriItem[] {
  return [...items].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()).slice(0, limit);
}

// Singleton demo for import convenience — 10 entries
export const demoHistori: HistoriItem[] = createDemoHistori(10);
