/**
 * Alias tampil kategori — display-only (UX kasir, tanpa fitur baru).
 *
 * Nama di DB (seed `src/db/seed.ts`) tetap jadi sumber kebenaran:
 * threshold, kode SKU, dan data tersimpan TIDAK berubah.
 * Helper ini hanya untuk teks yang dibaca manusia + contoh barang.
 */

const ALIAS: Record<string, string> = {
  Misc: "Lain-lain",
  "Makanan Frozen": "Makanan Beku",
  "Obat Bebas": "Obat dan Kesehatan",
};

const CONTOH: Record<string, string> = {
  Sembako: "beras, minyak, telur",
  "Bumbu Dapur": "garam, gula, kecap",
  "Makanan Kering": "mi instan, biskuit",
  "Makanan Basah": "tahu, tempe, ayam",
  "Makanan Frozen": "nugget, sosis",
  "Minuman Kaleng": "soda kaleng",
  "Minuman Botol": "teh botol, air mineral",
  "Obat Bebas": "plester, vitamin",
  "Perawatan Diri": "sabun, sampo",
  Rokok: "per bungkus",
  Misc: "plastik, baterai",
};

/** Nama kategori untuk ditampilkan ke pengguna. Tidak dikenal → tampil apa adanya. */
export function namaTampilKategori(nama: string): string {
  return ALIAS[nama] ?? nama;
}

/** Contoh barang untuk kategori. Tidak dikenal → string kosong. */
export function contohKategori(nama: string): string {
  return CONTOH[nama] ?? "";
}
