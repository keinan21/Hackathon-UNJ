import { describe, it, expect } from 'vitest';
import { buildCooccurrenceMap, findTopPairing, createKategoriFallbackMap } from './pairing';
import type { Transaksi } from '../db/types';

describe('pairing engine - co-occurrence + kategori fallback', () => {
  const org = 'toko-01';
  it('histori Roti+Susu 5x → pairing for Susu returns Roti', () => {
    const transaksis: Transaksi[] = [];
    for (let i = 0; i < 5; i++) {
      const soldAt = `2026-08-20T10:00:00.${i}Z`;
      transaksis.push({ id: `t-rot-${i}`, sku_id: 'sku-roti', qty_sold: 1, sold_at: soldAt, org_id: org });
      transaksis.push({ id: `t-sus-${i}`, sku_id: 'sku-susu', qty_sold: 1, sold_at: soldAt, org_id: org });
    }
    const coMap = buildCooccurrenceMap(transaksis);
    const avgMap = new Map<string, number>([['sku-roti', 5], ['sku-susu', 2]]);
    const urgent = new Set<string>(); // no urgent exclusion
    const result = findTopPairing('sku-susu', coMap, avgMap, urgent);
    expect(result).toBe('sku-roti');
  });

  it('pairing prefers high avg when counts equal', () => {
    const transaksis: Transaksi[] = [
      { id: '1', sku_id: 'sku-a', qty_sold: 1, sold_at: '2026-08-20T10:00:00.000Z', org_id: org },
      { id: '2', sku_id: 'sku-b', qty_sold: 1, sold_at: '2026-08-20T10:00:00.000Z', org_id: org },
      { id: '3', sku_id: 'sku-a', qty_sold: 1, sold_at: '2026-08-21T10:00:00.000Z', org_id: org },
      { id: '4', sku_id: 'sku-c', qty_sold: 1, sold_at: '2026-08-21T10:00:00.000Z', org_id: org },
    ];
    const coMap = buildCooccurrenceMap(transaksis);
    const avgMap = new Map<string, number>([['sku-b', 1], ['sku-c', 10]]);
    const result = findTopPairing('sku-a', coMap, avgMap, new Set());
    // both b and c co-occur 1x, but c has higher avg -> should pick c
    expect(result).toBe('sku-c');
  });

  it('excludes urgent SKU from pairing (avg high not urgent)', () => {
    const transaksis: Transaksi[] = [
      { id: '1', sku_id: 'sku-urgent', qty_sold: 1, sold_at: '2026-08-20T10:00:00.000Z', org_id: org },
      { id: '2', sku_id: 'sku-laku', qty_sold: 1, sold_at: '2026-08-20T10:00:00.000Z', org_id: org },
      { id: '3', sku_id: 'sku-urgent', qty_sold: 1, sold_at: '2026-08-21T10:00:00.000Z', org_id: org },
      { id: '4', sku_id: 'sku-urgent2', qty_sold: 1, sold_at: '2026-08-21T10:00:00.000Z', org_id: org },
    ];
    const coMap = buildCooccurrenceMap(transaksis);
    const avgMap = new Map<string, number>([['sku-laku', 10], ['sku-urgent2', 20]]);
    const urgentSet = new Set(['sku-urgent', 'sku-urgent2']); // urgent excludes
    const result = findTopPairing('sku-urgent', coMap, avgMap, urgentSet);
    expect(result).toBe('sku-laku');
  });

  it('no histori → fallback kategori returns configured pasangan', () => {
    const coMap = buildCooccurrenceMap([]);
    const avgMap = new Map<string, number>();
    const fallback = createKategoriFallbackMap([['sku-susu', 'sku-roti']]);
    const result = findTopPairing('sku-susu', coMap, avgMap, new Set(), fallback);
    expect(result).toBe('sku-roti');
  });

  it('fallback kategori via skuKategoriMap (Dairy -> Roti)', () => {
    const coMap = buildCooccurrenceMap([]);
    const avgMap = new Map<string, number>([['sku-roti', 5]]);
    const fallback = createKategoriFallbackMap([['kat-dairy', 'sku-roti']]);
    const skuKategoriMap = new Map([['sku-susu', 'kat-dairy']]);
    const result = findTopPairing('sku-susu', coMap, avgMap, new Set(), fallback, skuKategoriMap);
    expect(result).toBe('sku-roti');
  });

  it('urgent SKU has no pairing → returns null not error, LLM will handle wording', () => {
    const coMap = buildCooccurrenceMap([]);
    const result = findTopPairing('sku-unknown', coMap, new Map(), new Set());
    expect(result).toBeNull();
  });
});
