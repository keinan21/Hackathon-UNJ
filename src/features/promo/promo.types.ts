// promo.types.ts — Crew A Frontend only, no Dexie import
// Guardrail floor is VIEW only, value from Repository (not computed in UI logic beyond display margin)

export type PromoStatus = "proposed" | "active" | "expired" | "consumed";

export type Promo = {
  id: string;
  batch_id: string;
  sku_name: string;
  expiry_date: string; // YYYY-MM-DD
  daysToExpiry: number;
  qty: number;
  // pricing — numbers from DB via Repository, MUST NOT be calculated by LLM or UI logic beyond view margin
  modal: number; // hpp_snapshot display "Modal"
  harga_normal: number;
  harga_tebus: number;
  harga_floor: number; // HPP * 0.85 from Repository view
  keuntungan_tipis: number; // harga_tebus - harga_floor for caption "Untung tipis Rp500"
  // pairing
  sku_pasangan_id: string;
  sku_pasangan_name: string;
  alasan: string;
  status: PromoStatus;
  created_at: string;
  org_id: string;
};

export function formatRupiah(value: number): string {
  return `Rp${value.toLocaleString("id-ID")}`;
}

// Demo fixtures — values convention org_id toko-01
export function createDemoPromos(today: Date = new Date()): Promo[] {
  // Use fixed expiry 2026-09-02 H-2 style, with harga_tebus 9000 floor 8500
  const expiry = "2026-09-02";
  const modal = 10000;
  const harga_floor = 8500; // HPP*0.85 view from Repository
  const harga_tebus = 9000;
  return [
    {
      id: "promo-1",
      batch_id: "b-h2-susu",
      sku_name: "Susu UHT 1L",
      expiry_date: expiry,
      daysToExpiry: 2,
      qty: 10,
      modal,
      harga_normal: 15000,
      harga_tebus,
      harga_floor,
      keuntungan_tipis: harga_tebus - harga_floor, // 500
      sku_pasangan_id: "sku-roti",
      sku_pasangan_name: "Roti Tawar",
      alasan: "Susu mau kadaluarsa 2 hari lagi, pasangkan dengan roti yang laris biar cepat habis tanpa rugi.",
      status: "proposed",
      created_at: new Date(today.getTime() - 1000 * 60 * 60 * 2).toISOString(),
      org_id: "toko-01",
    },
    {
      id: "promo-2",
      batch_id: "b-h1-yoghurt",
      sku_name: "Yoghurt Cup 100ml",
      expiry_date: "2026-09-01",
      daysToExpiry: 1,
      qty: 8,
      modal: 8000,
      harga_normal: 12000,
      harga_tebus: 7200,
      harga_floor: 6800,
      keuntungan_tipis: 400,
      sku_pasangan_id: "sku-roti",
      sku_pasangan_name: "Roti Tawar",
      alasan: "Yoghurt H-1 segera promo biar tidak terbuang.",
      status: "proposed",
      created_at: new Date(today.getTime() - 1000 * 60 * 60 * 5).toISOString(),
      org_id: "toko-01",
    },
  ];
}

export function createActiveDemoPromos(today: Date = new Date()): Promo[] {
  const demos = createDemoPromos(today);
  return demos.map((p) => ({ ...p, status: "active" as PromoStatus }));
}
