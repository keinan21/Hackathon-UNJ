// src/lib/settingsStore.ts — Crew A isolated mock, no dexie
// Threshold per Kategori [7,3,1] generic editable (FRD-02, CONTEXT.md:10-11)
// Persist via localStorage (in-memory friendly), not Dexie

export type KategoriSetting = {
  id: string;
  nama: string;
  threshold_h_minus: number[];
  org_id: string;
  contoh_hpp: number; // for HPP*0.85 floor view
};

const STORAGE_KEY = "settings-threshold-store-v1";
export const DEFAULT_ORG_ID = "toko-01";

const DEFAULTS: KategoriSetting[] = [
  { id: "k-dairy", nama: "Dairy", threshold_h_minus: [7, 3, 1], org_id: DEFAULT_ORG_ID, contoh_hpp: 10000 },
  { id: "k-snack", nama: "Snack", threshold_h_minus: [7, 3, 1], org_id: DEFAULT_ORG_ID, contoh_hpp: 8000 },
  { id: "k-beras", nama: "Beras", threshold_h_minus: [7, 3, 1], org_id: DEFAULT_ORG_ID, contoh_hpp: 12000 },
];

export function formatRupiah(n: number): string {
  return `Rp ${n.toLocaleString("id-ID")}`;
}

export function floorHarga(hpp: number): number {
  return Math.floor(hpp * 0.85);
}

/** Validation: Bahasa Indonesia messages per design.md error handling */
export function validateThreshold(values: number[]): string | null {
  if (!Array.isArray(values) || values.length === 0) {
    return "Threshold tidak boleh kosong";
  }
  // check any not finite or empty equivalent
  if (values.some((v) => !Number.isFinite(v) || Number.isNaN(v))) {
    return "Threshold tidak boleh kosong";
  }
  if (values.some((v) => !(v > 0))) {
    return "Threshold harus lebih dari 0";
  }
  if (new Set(values).size !== values.length) {
    return "Angka tidak boleh sama";
  }
  for (let i = 1; i < values.length; i++) {
    if (values[i] >= values[i - 1]) {
      return "Harus menurun";
    }
  }
  return null;
}

function loadFromStorage(): KategoriSetting[] | null {
  if (typeof window === "undefined" || !window.localStorage) return null;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as KategoriSetting[];
    if (!Array.isArray(parsed) || parsed.length === 0) return null;
    // sanity: ensure 3 entries with threshold arrays
    if (parsed.some((k) => !Array.isArray(k.threshold_h_minus))) return null;
    return parsed;
  } catch {
    return null;
  }
}

function saveToStorage(cats: KategoriSetting[]): void {
  if (typeof window === "undefined" || !window.localStorage) return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(cats));
  } catch {
    // ignore quota
  }
}

let memoryCache: KategoriSetting[] | null = null;

export function getKategoris(): KategoriSetting[] {
  if (memoryCache) return memoryCache.map((c) => ({ ...c, threshold_h_minus: [...c.threshold_h_minus] }));
  const stored = loadFromStorage();
  const base = stored ?? DEFAULTS;
  memoryCache = base.map((c) => ({ ...c, threshold_h_minus: [...c.threshold_h_minus] }));
  return memoryCache.map((c) => ({ ...c, threshold_h_minus: [...c.threshold_h_minus] }));
}

export function setKategoris(next: KategoriSetting[]): void {
  memoryCache = next.map((c) => ({ ...c, threshold_h_minus: [...c.threshold_h_minus] }));
  saveToStorage(memoryCache);
}

export function updateThreshold(id: string, newThreshold: number[]): { ok: boolean; error?: string; kategori?: KategoriSetting } {
  const err = validateThreshold(newThreshold);
  if (err) return { ok: false, error: err };
  const cats = getKategoris();
  const idx = cats.findIndex((c) => c.id === id);
  if (idx === -1) return { ok: false, error: "Kategori tidak ditemukan" };
  cats[idx] = { ...cats[idx], threshold_h_minus: [...newThreshold] };
  setKategoris(cats);
  return { ok: true, kategori: cats[idx] };
}

export function resetToDefaults(): void {
  setKategoris(DEFAULTS);
  if (typeof window !== "undefined" && window.localStorage) {
    try {
      window.localStorage.removeItem(STORAGE_KEY);
    } catch {}
  }
  memoryCache = DEFAULTS.map((c) => ({ ...c, threshold_h_minus: [...c.threshold_h_minus] }));
  saveToStorage(memoryCache);
}

// expose for e2e / manual reset
if (typeof window !== "undefined") {
  (window as unknown as { __SETTINGS_STORE__?: unknown }).__SETTINGS_STORE__ = {
    getKategoris,
    updateThreshold,
    validateThreshold,
    resetToDefaults,
    formatRupiah,
    floorHarga,
  };
}
