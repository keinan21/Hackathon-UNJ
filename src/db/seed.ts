/**
 * TASK-05 [FRD-02]: Seed kategori + threshold config (generic [7,3,1] editable)
 *
 * Generic threshold [7,3,1] adalah default truth (FRD-02, CONTEXT.md:10-11).
 * Seed 3 kategori Dairy/Snack/Beras dengan nilai tersebut.
 * Editable via InventoryRepository.updateKategoriThreshold — validasi
 * non-empty, descending, >0, no dup — MUST NOT hardcode non-editable.
 *
 * Idempotent: cek listKategoris dulu, jika nama sudah ada skip.
 */

type SeedRepository = {
  listKategoris(orgId?: string): Promise<Array<{ nama: string }>>;
  createKategori(k: { nama: string; threshold_h_minus: number[] }): Promise<unknown>;
};

/** Default threshold H- generik, truth editable (FRD-02) */
export const DEFAULT_THRESHOLD_H_MINUS: number[] = [7, 3, 1];

const DEFAULT_KATEGORIS: Array<{ nama: string; threshold_h_minus: number[] }> = [
  { nama: "Dairy", threshold_h_minus: [...DEFAULT_THRESHOLD_H_MINUS] },
  { nama: "Snack", threshold_h_minus: [...DEFAULT_THRESHOLD_H_MINUS] },
  { nama: "Beras", threshold_h_minus: [...DEFAULT_THRESHOLD_H_MINUS] },
];

let seedLock: Promise<void> = Promise.resolve();

/**
 * Seed 3 kategori default jika belum ada.
 * Idempotent: query listKategoris, skip nama yang sudah ada.
 * Pakai createKategori (org_id default toko-01, sync-ready sharding).
 * Serialize concurrent calls via module-level promise chain — second sees first's rows and skips (fixes React.StrictMode double-mount race).
 */
export async function seedDefaultKategoris(repo: SeedRepository): Promise<void> {
  const prev = seedLock;
  let release!: () => void;
  seedLock = new Promise<void>((res) => {
    release = res;
  });
  await prev;
  try {
    const existing = await repo.listKategoris("toko-01");
    const existingNames = new Set(existing.map((k) => k.nama));

    for (const k of DEFAULT_KATEGORIS) {
      if (!existingNames.has(k.nama)) {
        await repo.createKategori({
          nama: k.nama,
          threshold_h_minus: [...k.threshold_h_minus],
        });
        existingNames.add(k.nama);
      }
    }
  } finally {
    release();
  }
}
