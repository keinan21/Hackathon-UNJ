// FakeRepository in-memory for tests only — do not touch src/db
// Contract: expiry null skip, days via Asia/Jakarta Intl.DateTimeFormat ceil,
// filter days <= threshold per Kategori, sort expiry asc, require org_id='toko-01'

export type Kategori = {
  id: string;
  name: string;
  threshold_h_minus: number[];
  org_id: string;
};

export type Sku = {
  id: string;
  nama: string;
  kategori_id: string;
  kategori_name?: string;
  hpp: number;
  harga_normal: number;
  org_id: string;
};

export type Batch = {
  id: string;
  sku_id: string;
  sku_name?: string;
  kategori_id: string;
  kategori_name?: string;
  qty: number;
  expiry_date: string | null; // YYYY-MM-DD or null
  received_at: string;
  hpp_snapshot: number;
  org_id: string;
  avg_daily_usage?: number; // for urgencyScore optional
};

export type UrgentBatch = Batch & {
  daysToExpiry: number;
  urgencyScore: number;
};

/**
 * Asia/Jakarta daysToExpiry via Intl.DateTimeFormat ceil
 * Mirrors spec: ceil((expiry_date - todayAsiaJakartaStartOfDay)/1day)
 */
export function daysToExpiryAsiaJakarta(expiryDate: string | null, today: Date = new Date()): number | null {
  if (expiryDate === null || expiryDate === undefined) return null;
  // today startOfDay in Asia/Jakarta
  const fmt = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Jakarta",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
  const todayKey = fmt.format(today); // YYYY-MM-DD
  const [y, m, d] = todayKey.split("-").map(Number);
  const todayMidnightUTC = Date.UTC(y, m - 1, d);

  // expiry is YYYY-MM-DD interpreted as Asia/Jakarta midnight
  const [ey, em, ed] = expiryDate.split("-").map(Number);
  if (Number.isNaN(ey) || Number.isNaN(em) || Number.isNaN(ed)) return null;
  const expiryMidnightUTC = Date.UTC(ey, em - 1, ed);

  const diffMs = expiryMidnightUTC - todayMidnightUTC;
  return Math.ceil(diffMs / 86400000);
}

export function urgencyScore(qty: number, days: number, avgDailyUsage: number): number {
  return (qty * days) / Math.max(avgDailyUsage, 1);
}

function toExpiryDatePlusDays(days: number, today: Date = new Date()): string {
  const fmt = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Jakarta",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
  const todayKey = fmt.format(today);
  const [y, m, d] = todayKey.split("-").map(Number);
  const base = Date.UTC(y, m - 1, d);
  const target = base + days * 86400000;
  const dt = new Date(target);
  const yy = dt.getUTCFullYear();
  const mm = String(dt.getUTCMonth() + 1).padStart(2, "0");
  const dd = String(dt.getUTCDate()).padStart(2, "0");
  return `${yy}-${mm}-${dd}`;
}

export class FakeRepository {
  kategoris: Kategori[] = [];
  skus: Sku[] = [];
  batches: Batch[] = [];

  constructor() {
    this.seedDefault();
  }

  seedDefault() {
    this.kategoris = [
      { id: "k-dairy", name: "Dairy", threshold_h_minus: [7, 3, 1], org_id: "toko-01" },
      { id: "k-snack", name: "Snack", threshold_h_minus: [7, 3, 1], org_id: "toko-01" },
      { id: "k-beras", name: "Beras", threshold_h_minus: [7, 3, 1], org_id: "toko-01" },
    ];
    this.skus = [
      { id: "sku-susu", nama: "Susu UHT 1L", kategori_id: "k-dairy", kategori_name: "Dairy", hpp: 10000, harga_normal: 15000, org_id: "toko-01" },
      { id: "sku-yoghurt", nama: "Yoghurt Cup 100ml", kategori_id: "k-dairy", kategori_name: "Dairy", hpp: 8000, harga_normal: 12000, org_id: "toko-01" },
      { id: "sku-roti", nama: "Roti Tawar", kategori_id: "k-snack", kategori_name: "Snack", hpp: 5000, harga_normal: 8000, org_id: "toko-01" },
    ];
    // Will be populated via seedUrgentDemo
  }

  clear() {
    this.batches = [];
  }

  addBatch(b: Batch) {
    this.batches.push(b);
  }

  /**
   * Seed 3 batches H-1/H-3/H-10 via today
   * Use this for happy test: H-1 and H-3 urgent, H-10 hidden
   */
  seedUrgentDemo(today: Date = new Date()) {
    this.clear();
    const h1 = toExpiryDatePlusDays(1, today);
    const h3 = toExpiryDatePlusDays(3, today);
    const h10 = toExpiryDatePlusDays(10, today);
    this.batches = [
      {
        id: "b-h1",
        sku_id: "sku-susu",
        sku_name: "Susu UHT 1L",
        kategori_id: "k-dairy",
        kategori_name: "Dairy",
        qty: 10,
        expiry_date: h1,
        received_at: new Date().toISOString(),
        hpp_snapshot: 10000,
        org_id: "toko-01",
        avg_daily_usage: 2,
      },
      {
        id: "b-h3",
        sku_id: "sku-yoghurt",
        sku_name: "Yoghurt Cup 100ml",
        kategori_id: "k-dairy",
        kategori_name: "Dairy",
        qty: 8,
        expiry_date: h3,
        received_at: new Date().toISOString(),
        hpp_snapshot: 8000,
        org_id: "toko-01",
        avg_daily_usage: 2,
      },
      {
        id: "b-h10",
        sku_id: "sku-roti",
        sku_name: "Roti Tawar",
        kategori_id: "k-snack",
        kategori_name: "Snack",
        qty: 5,
        expiry_date: h10,
        received_at: new Date().toISOString(),
        hpp_snapshot: 5000,
        org_id: "toko-01",
        avg_daily_usage: 2,
      },
    ];
  }

  /**
   * Seed many urgent (60) for pagination test
   */
  seedManyUrgent(count = 60, today: Date = new Date()) {
    this.clear();
    const batches: Batch[] = [];
    for (let i = 0; i < count; i++) {
      const days = (i % 7) + 1; // 1..7 all urgent
      const expiry = toExpiryDatePlusDays(days, today);
      const cat = i % 3 === 0 ? "k-dairy" : i % 3 === 1 ? "k-snack" : "k-beras";
      const catName = i % 3 === 0 ? "Dairy" : i % 3 === 1 ? "Snack" : "Beras";
      batches.push({
        id: `b-many-${i}`,
        sku_id: i % 2 === 0 ? "sku-susu" : "sku-roti",
        sku_name: i % 2 === 0 ? "Susu UHT 1L" : "Roti Tawar",
        kategori_id: cat,
        kategori_name: catName,
        qty: 5 + (i % 5),
        expiry_date: expiry,
        received_at: new Date().toISOString(),
        hpp_snapshot: 10000,
        org_id: "toko-01",
        avg_daily_usage: 2,
      });
    }
    this.batches = batches;
  }

  /**
   * Get urgent batches: expiry null skip, require org_id='toko-01',
   * filter days <= threshold max per Kategori, sort expiry asc
   */
  getUrgentBatches(today: Date = new Date(), sortBy: "expiry" | "urgency" = "expiry"): UrgentBatch[] {
    const result: UrgentBatch[] = [];
    for (const b of this.batches) {
      if (b.org_id !== "toko-01") continue;
      if (b.expiry_date === null) continue;
      const days = daysToExpiryAsiaJakarta(b.expiry_date, today);
      if (days === null) continue;
      const kategori = this.kategoris.find((k) => k.id === b.kategori_id);
      const threshold = kategori?.threshold_h_minus ?? [7, 3, 1];
      const maxThreshold = Math.max(...threshold);
      if (days > maxThreshold) continue; // hidden
      const avg = b.avg_daily_usage ?? 2;
      const score = urgencyScore(b.qty, days, avg);
      result.push({ ...b, daysToExpiry: days, urgencyScore: score });
    }
    if (sortBy === "urgency") {
      result.sort((a, b) => a.urgencyScore - b.urgencyScore);
    } else {
      // expiry asc primary
      result.sort((a, b) => {
        if (a.daysToExpiry !== b.daysToExpiry) return a.daysToExpiry - b.daysToExpiry;
        return a.urgencyScore - b.urgencyScore;
      });
    }
    return result;
  }

  /** Badge count per SKU sum qty urgent */
  getBadgeCountPerSku(today: Date = new Date()): Map<string, number> {
    const urgent = this.getUrgentBatches(today);
    const map = new Map<string, number>();
    for (const b of urgent) {
      map.set(b.sku_id, (map.get(b.sku_id) ?? 0) + b.qty);
    }
    return map;
  }
}

export function createDemoRepository(today: Date = new Date()): FakeRepository {
  const repo = new FakeRepository();
  repo.seedUrgentDemo(today);
  return repo;
}
