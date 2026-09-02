import type { Transaksi, SKU } from '../db/types';
import type { InventoryRepository } from '../db/repository';

/**
 * Build co-occurrence map from transaksis.
 * Groups transactions by sold_at (same timestamp = same basket).
 * For each basket, every sku co-occurs with every other sku in same basket.
 * Returns Map<sku_id, Map<pasangan_id, count>>
 */
export function buildCooccurrenceMap(transaksis: Transaksi[]): Map<string, Map<string, number>> {
  const groups = new Map<string, string[]>();
  for (const t of transaksis) {
    const key = t.sold_at; // grouping by exact sold_at
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key)!.push(t.sku_id);
  }

  const coMap = new Map<string, Map<string, number>>();
  for (const skuIds of groups.values()) {
    const unique = [...new Set(skuIds)];
    if (unique.length < 2) continue;
    for (const a of unique) {
      if (!coMap.has(a)) coMap.set(a, new Map());
      const inner = coMap.get(a)!;
      for (const b of unique) {
        if (a === b) continue;
        inner.set(b, (inner.get(b) ?? 0) + 1);
      }
    }
  }
  return coMap;
}

/**
 * Find top pairing for urgent SKU.
 * - Prioritizes co-occurrence count desc, then avgUsage high
 * - Excludes urgent SKUs (not urgent only)
 * - Fallback to kategori manual if no co-occurrence
 */
export function findTopPairing(
  urgentSkuId: string,
  coMap: Map<string, Map<string, number>>,
  avgUsageMap: Map<string, number>,
  urgentSkuIds: Set<string>,
  fallbackMap?: Map<string, string>,
  skuKategoriMap?: Map<string, string>, // sku_id -> kategori_id
): string | null {
  const candidates = coMap.get(urgentSkuId);
  if (candidates && candidates.size > 0) {
    const sorted = [...candidates.entries()]
      .filter(([pasanganId]) => !urgentSkuIds.has(pasanganId))
      .sort((a, b) => {
        const countDiff = b[1] - a[1];
        if (countDiff !== 0) return countDiff;
        const avgA = avgUsageMap.get(a[0]) ?? 0;
        const avgB = avgUsageMap.get(b[0]) ?? 0;
        return avgB - avgA;
      });
    if (sorted.length > 0) return sorted[0][0];
  }

  // Fallback kategori manual
  if (fallbackMap) {
    // direct urgentSkuId -> pasangan
    if (fallbackMap.has(urgentSkuId)) {
      const fb = fallbackMap.get(urgentSkuId)!;
      if (!urgentSkuIds.has(fb)) return fb;
    }
    // kategori_id -> pasangan
    if (skuKategoriMap) {
      const kategoriId = skuKategoriMap.get(urgentSkuId);
      if (kategoriId && fallbackMap.has(kategoriId)) {
        const fb = fallbackMap.get(kategoriId)!;
        if (!urgentSkuIds.has(fb)) return fb;
      }
    }
    // generic fallback: first non-urgent with high avg
    // if fallbackMap contains any non-urgent with high avg, pick highest avg among non-urgent fallback values
    const fallbackCandidates = [...fallbackMap.values()].filter(id => !urgentSkuIds.has(id));
    if (fallbackCandidates.length > 0) {
      fallbackCandidates.sort((a, b) => (avgUsageMap.get(b) ?? 0) - (avgUsageMap.get(a) ?? 0));
      return fallbackCandidates[0];
    }
  }

  return null;
}

/**
 * Higher-level helper using repository.
 * Resolves avgUsage externally (for now expects caller to provide avg map or compute).
 * If avgUsageMap not provided, builds from transaksis count (total qty / 14 days fallback).
 */
export async function getPairingForSku(
  skuId: string,
  repo: Pick<InventoryRepository, 'listTransaksis' | 'listSkus'>,
  opts: {
    orgId: string;
    urgentSkuIds?: Set<string>;
    avgUsageMap?: Map<string, number>;
    fallbackMap?: Map<string, string>;
    skuKategoriMap?: Map<string, string>;
  },
): Promise<string | null> {
  const orgId = opts.orgId;
  const transaksis = await repo.listTransaksis(orgId);
  const coMap = buildCooccurrenceMap(transaksis);

  let avgMap = opts.avgUsageMap;
  if (!avgMap) {
    avgMap = new Map();
    // fallback: count qty_sold per sku / 14
    const totals = new Map<string, number>();
    for (const t of transaksis) {
      totals.set(t.sku_id, (totals.get(t.sku_id) ?? 0) + t.qty_sold);
    }
    for (const [skuId, total] of totals) {
      avgMap.set(skuId, total / 14);
    }
  }

  let skuKategoriMap = opts.skuKategoriMap;
  if (!skuKategoriMap && opts.fallbackMap) {
    const skus = await repo.listSkus(orgId);
    skuKategoriMap = new Map(skus.map(s => [s.id, s.kategori_id]));
  }

  return findTopPairing(skuId, coMap, avgMap, opts.urgentSkuIds ?? new Set(), opts.fallbackMap, skuKategoriMap);
}

// Default kategori fallback manual as per spec example Roti -> Susu
export const DEFAULT_FALLBACK_MAP = new Map<string, string>([
  // sku-level example: urgent Susu -> Roti
  // kategori-level: Dairy -> Snack etc can be added by caller
]);

/**
 * Utility to create a manual fallback map for categories
 * e.g., Dairy -> Roti Tawar laku
 */
export function createKategoriFallbackMap(entries: [kategoriIdOrSkuId: string, pasanganSkuId: string][]): Map<string, string> {
  return new Map(entries);
}
