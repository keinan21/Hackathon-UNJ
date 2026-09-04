/**
 * TASK-18 [FRD-05/FRD-06] — Engine omzet/margin/cashflow 14 hari deterministik
 *
 * Pure, tanpa import Dexie/LLM/fetch — input arrays + today, output angka.
 * Angka dari DB, bukan LLM. Dipakai scheduler 07:00 + buildRecapText + Telegram.
 *
 * ---------------------------------------------------------------------------
 * Mapping ke field existing (JANGAN ubah schema Dexie):
 * ---------------------------------------------------------------------------
 * - Transaksi (src/db/types.ts & src/db/db.ts):
 *   id, sku_id, qty_sold, sold_at (ISO), org_id, jenis? ("masuk"|"keluar"|"opname" default "keluar"),
 *   harga_jual_snapshot?, pengirim, penerima, catatan
 *   → TIDAK ada field hpp_snapshot / harga_beli di Transaksi di schema existing.
 *
 * - Batch (src/db/types.ts): id, sku_id, qty, expiry_date, received_at (ISO), hpp_snapshot, org_id
 *   → hpp_snapshot adalah harga beli per pcs saat batch masuk (copy dari SKU.hpp atau harga_beli explicit).
 *
 * Rumus deterministik (Bahasa Indonesia, Rp):
 * - omzet  = Σ harga_jual_snapshot × qty_sold  untuk transaksi jenis="keluar" dalam window 14 hari
 * - margin = omzet − Σ HPP_terjual,  HPP_terjual = hpp_per_keluar × qty_sold
 * - belanja = Σ harga_beli_masuk × qty untuk jenis="masuk" dalam window
 * - cashflow = omzet − belanja
 *
 * Cara dapat HPP_terjual / harga_beli_masuk tanpa ubah schema:
 * - Untuk keluar: transaksi boleh membawa enrichment `hpp_snapshot` (atau `harga_beli`/`hpp`) sebagai field
 *   optional tambahan (casting `as any`). Jika tidak ada, coba cari batch matching
 *   (sku_id sama, received_at ≈ sold_at, qty sama) untuk ambil hpp_snapshot. Jika tetap tidak
 *   ketemu, fallback 0 agar margin tetap deterministik tanpa hallucinate.
 * - Untuk masuk (belanja): prioritas (1) transaksi.hpp_snapshot / harga_beli jika ada,
 *   (2) cari batch matching recieved_at ≈ sold_at + sku+qty, ambil batch.hpp_snapshot,
 *   (3) fallback 0.
 * - Matching window 5 detik karena inboundForm menyimpan batch + transaksi dengan nowIso yang sama
 *   dalam satu transaksi Dexie (src/features/inout/InboundForm.tsx:146-168).
 *
 * Window 14 hari:
 * - Kalender Asia/Jakarta (tanpa DST, offset +7). Hari dibulatkan ke startOfDay Asia/Jakarta via Intl.
 * - Window 14 hari inklusif: [todayJakarta 00:00 -13 hari , todayJakarta 00:00 tomorrow ) — 14 tanggal YYYY-MM-DD.
 * - Transaksi dikelompokkan via sold_at → tanggal Jakarta YYYY-MM-DD, cek ada di Set 14 hari.
 * - Data di luar window (misal 20 hari lalu) dipotong, tidak dihitung.
 *
 * Pure helpers: calcOmzet14, build14DaysSetJakarta, formatJakartaYMD
 */

const JAKARTA_OFFSET_MS = 7 * 60 * 60 * 1000;

export function formatJakartaYMD(d: Date): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Jakarta",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(d);
}

function toJakartaStartOfDay(d: Date): Date {
  const fmt = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Jakarta",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
  const parts = fmt.formatToParts(d);
  const y = Number(parts.find((p) => p.type === "year")!.value);
  const m = Number(parts.find((p) => p.type === "month")!.value);
  const day = Number(parts.find((p) => p.type === "day")!.value);
  return new Date(Date.UTC(y, m - 1, day, 0, 0, 0, 0) - JAKARTA_OFFSET_MS);
}

export function build14DaysSetJakarta(today: Date = new Date()): Set<string> {
  const start = toJakartaStartOfDay(today);
  const baseUTC = start.getTime();
  const set = new Set<string>();
  for (let i = 0; i < 14; i++) {
    const delta = i - 13; // -13 .. 0
    const utc = baseUTC + delta * 86_400_000;
    set.add(formatJakartaYMD(new Date(utc)));
  }
  return set;
}

export type OmzetInputTransaksi = {
  sku_id: number | string;
  qty_sold: number;
  sold_at: string; // ISO
  jenis?: string; // "masuk" | "keluar"
  harga_jual_snapshot?: number | null;
  // enrichment optional — tidak ada di schema Dexie, tapi boleh diisi untuk deterministik
  hpp_snapshot?: number | null;
  harga_beli?: number | null;
  hpp?: number | null;
  org_id?: string;
};

export type OmzetInputBatch = {
  id: number | string;
  sku_id: number | string;
  qty: number;
  hpp_snapshot: number;
  received_at: string; // ISO
  expiry_date: string | null;
  org_id: string;
};

export type OmzetResult = {
  omzet: number;
  margin: number;
  cashflow: number;
  belanja: number;
};

/**
 * Hitung omzet/margin/cashflow 14 hari — pure deterministik.
 * @param transaksis - array transaksi (keluar + masuk)
 * @param batches - array batch untuk derive harga_beli masuk & HPP keluar jika enrichment tidak ada
 * @param today - tanggal acuan (default now), di-normalize ke Asia/Jakarta 00:00
 */
export function calcOmzet14(
  transaksis: OmzetInputTransaksi[],
  batches: OmzetInputBatch[] = [],
  today: Date = new Date(),
): OmzetResult {
  const windowSet = build14DaysSetJakarta(today);

  let omzet = 0;
  let hppTerjual = 0;
  let belanja = 0;

  // Index batches by sku_id for quick lookup untuk fallback matching
  const batchesBySku = new Map<string, OmzetInputBatch[]>();
  for (const b of batches) {
    const key = String(b.sku_id);
    if (!batchesBySku.has(key)) batchesBySku.set(key, []);
    batchesBySku.get(key)!.push(b);
  }

  for (const t of transaksis) {
    let day: string;
    try {
      day = formatJakartaYMD(new Date(t.sold_at));
    } catch {
      continue;
    }
    if (!windowSet.has(day)) continue;

    const qty = typeof t.qty_sold === "number" ? t.qty_sold : 0;
    if (!(qty > 0)) continue;
    const jenis = (t.jenis ?? "keluar") as string;

    if (jenis === "masuk") {
      // belanja = harga_beli × qty
      let hargaBeli: number | null = null;
      const enriched = t as unknown as Record<string, unknown>;
      if (typeof enriched.hpp_snapshot === "number" && Number.isFinite(enriched.hpp_snapshot as number)) {
        hargaBeli = enriched.hpp_snapshot as number;
      } else if (typeof enriched.harga_beli === "number" && Number.isFinite(enriched.harga_beli as number)) {
        hargaBeli = enriched.harga_beli as number;
      } else if (typeof enriched.hpp === "number" && Number.isFinite(enriched.hpp as number)) {
        hargaBeli = enriched.hpp as number;
      } else {
        // fallback: cari batch matching (same sku, received_at ~ sold_at within 5s, qty sama)
        const candidates = batchesBySku.get(String(t.sku_id)) ?? [];
        const soldTs = new Date(t.sold_at).getTime();
        let found: OmzetInputBatch | undefined;
        for (const b of candidates) {
          try {
            const recvTs = new Date(b.received_at).getTime();
            if (Math.abs(recvTs - soldTs) < 5000 && b.qty === qty) {
              found = b;
              break;
            }
          } catch {
            continue;
          }
        }
        // jika tidak ketemu via waktu+qty, coba match sku terakhir (fallback closest by time)
        if (!found && candidates.length > 0) {
          let best: OmzetInputBatch | undefined;
          let bestDiff = Infinity;
          for (const b of candidates) {
            try {
              const diff = Math.abs(new Date(b.received_at).getTime() - soldTs);
              if (diff < bestDiff) {
                bestDiff = diff;
                best = b;
              }
            } catch {
              continue;
            }
          }
          // hanya pakai jika diff < 60s (masih masuk akal untuk inbound pair)
          if (best && bestDiff < 60_000) found = best;
        }
        if (found) hargaBeli = found.hpp_snapshot;
      }
      if (hargaBeli !== null && Number.isFinite(hargaBeli) && hargaBeli > 0) {
        belanja += hargaBeli * qty;
      }
      // harga_jual_snapshot untuk masuk diabaikan (selalu 0 di inboundForm)
    } else if (jenis === "keluar") {
      const hargaJual =
        t.harga_jual_snapshot !== null && t.harga_jual_snapshot !== undefined && Number.isFinite(t.harga_jual_snapshot)
          ? (t.harga_jual_snapshot as number)
          : 0;
      omzet += hargaJual * qty;

      // HPP terjual
      let hpp: number | null = null;
      const enriched = t as unknown as Record<string, unknown>;
      if (typeof enriched.hpp_snapshot === "number" && Number.isFinite(enriched.hpp_snapshot as number)) {
        hpp = enriched.hpp_snapshot as number;
      } else if (typeof enriched.harga_beli === "number" && Number.isFinite(enriched.harga_beli as number)) {
        hpp = enriched.harga_beli as number;
      } else if (typeof enriched.hpp === "number" && Number.isFinite(enriched.hpp as number)) {
        hpp = enriched.hpp as number;
      }
      // jika tetap null, fallback 0 (tidak hallucinate) — caller bisa enrich via batch hpp jika diperlukan
      if (hpp !== null && Number.isFinite(hpp) && hpp > 0) {
        hppTerjual += hpp * qty;
      }
    }
    // jenis opname atau lain diabaikan untuk omzet/margin/cashflow
  }

  const margin = omzet - hppTerjual;
  const cashflow = omzet - belanja;
  return { omzet, margin, cashflow, belanja };
}

// Alias untuk konsistensi dengan arus.ts naming
export const calcOmzet14Jakarta = calcOmzet14;
