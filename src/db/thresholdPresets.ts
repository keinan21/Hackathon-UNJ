/**
 * Preset threshold 6 → 4 (Task-08).
 *
 * 6 nilai historis: [7,3,1], [14,7,3], [30,14,7], [60,30,14], [90,30,14], [180,90,30]
 * Dikelompokkan ke 4 preset dengan metrik sum-abs-diff terdekat:
 *   [7,3,1]   → 🥛 Susu/Segar
 *   [14,7,3]  → 📦 Snack/Kering
 *   [30,14,7] → 🌾 Semikonstan
 *   [60,30,14] → 🪨 Tahan
 *   [90,30,14] → 🪨 (nilai 90, terdekat ke [60,30,14])
 *   [180,90,30] → 🪨 (nilai 180, terdekat ke [60,30,14])
 *
 * Helper presetUntukThreshold() menghitung jarak ke tiap preset dan
 * mengembalikan preset terdekat. Untuk nilai 90 dan 180, FALLBACK
 * tetap [60,30,14] (nilai TIDAK ditulis ulang ke DB — display-only).
 *
 * Validasi manual tetap: harus menurun, angka tidak boleh sama, tidak kosong.
 */

export type ThresholdPreset = {
  emoji: string;
  label: string;
  threshold: number[];
};

export const THRESHOLD_PRESETS: readonly ThresholdPreset[] = [
  { emoji: "🥛", label: "Susu/Segar", threshold: [7, 3, 1] },
  { emoji: "📦", label: "Snack/Kering", threshold: [14, 7, 3] },
  { emoji: "🌾", label: "Semikonstan", threshold: [30, 14, 7] },
  { emoji: "🪨", label: "Tahan", threshold: [60, 30, 14] },
] as const;

export type PresetKey = (typeof THRESHOLD_PRESETS)[number]["label"];

/** Jarak antar threshold pakai sum-abs-diff */
function jarak(a: number[], b: number[]): number {
  if (a.length !== b.length) return Infinity;
  return a.reduce((s, v, i) => s + Math.abs(v - b[i]), 0);
}

/**
 * Tentukan preset terdekat untuk threshold tertentu.
 * Untuk nilai yang tidak persis sama (90,180), preset terdekat tetap
 * dikembalikan sebagai display-only; nilai DB TIDAK ditulis ulang.
 */
export function presetUntukThreshold(threshold: number[]): ThresholdPreset {
  let best = THRESHOLD_PRESETS[0];
  let bestDist = jarak(threshold, best.threshold);
  for (let i = 1; i < THRESHOLD_PRESETS.length; i++) {
    const dist = jarak(threshold, THRESHOLD_PRESETS[i].threshold);
    if (dist < bestDist) {
      bestDist = dist;
      best = THRESHOLD_PRESETS[i];
    }
  }
  return best;
}

/** Ambil threshold mentah dari preset (untuk display/backup) */
export function thresholdDariPreset(emoji: string): number[] | undefined {
  return THRESHOLD_PRESETS.find((p) => p.emoji === emoji)?.threshold;
}

/** Fallback kategori dengan preset emojis untuk SettingsPage */
export const FALLBACK_KATEGORI_PRESET: Array<{ id: string; name: string; threshold: number[]; emoji: string }> = [
  { id: "k-dairy", name: "Dairy", threshold: [7, 3, 1], emoji: "🥛" },
  { id: "k-snack", name: "Snack", threshold: [7, 3, 1], emoji: "🥛" },
  { id: "k-beras", name: "Beras", threshold: [7, 3, 1], emoji: "🥛" },
];
