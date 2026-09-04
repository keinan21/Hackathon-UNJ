import type { AdvisorPort } from './AdvisorPort';
import type { AdvisorSuggestion, Batch, SKU } from '../db/types';
import type { InventoryRepository } from '../db/repository';
import { daysToExpiry, urgencyScore } from '../engine/expiry';
import { findTopPairing, buildCooccurrenceMap } from './pairing';
import { validateHargaTebus, validatePromoUsul, type PromoJenis } from '../lib/validation';

export interface LLMPort {
  generate(input: {
    sku: SKU;
    batch: Batch;
    daysToExpiry: number;
    pasanganSku: SKU | null;
    hpp: number;
    hargaNormal: number;
    hargaTebus: number;
  }): Promise<{
    aksi: string;
    alasan: string;
    confidence: AdvisorSuggestion['confidence'];
  }>;
}

// Mock LLM for tests - returns plausible suggestion at floor
export class MockLLM implements LLMPort {
  constructor(private opts?: { forceHargaTebus?: number; shouldFail?: boolean }) {}
  async generate(input: { sku: SKU; batch: Batch; daysToExpiry: number; pasanganSku: SKU | null; hpp: number; hargaNormal: number; hargaTebus: number }) {
    if (this.opts?.shouldFail) throw new Error('LLM offline');
    if (this.opts?.forceHargaTebus !== undefined && this.opts.forceHargaTebus !== input.hargaTebus) throw new Error('Harga tebus tidak boleh di bawah HPP x 0.85 atau ditentukan LLM');
    return {
      aksi: `Tebus murah ${input.sku.nama} dengan ${input.pasanganSku?.nama ?? 'pasangan laris'}`,
      alasan: `${input.sku.nama} mau kadaluarsa ${input.daysToExpiry} hari lagi, pasangkan dengan ${input.pasanganSku?.nama ?? 'SKU laris'} biar cepat habis tanpa rugi.`,
      confidence: 'Tinggi' as const,
    };
  }
}

const TTL_MS = 24 * 60 * 60 * 1000;

export class LangChainGeminiAdvisor implements AdvisorPort {
  public llmCallCount = 0; // for testing cache hit

  constructor(
    private repo: InventoryRepository,
    private llm: LLMPort,
    private opts?: {
      now?: () => Date;
      fallbackPairingMap?: Map<string, string>;
    },
  ) {}

  private now(): Date {
    return this.opts?.now?.() ?? new Date();
  }

  private isCacheValid(entryCreatedAt: string): boolean {
    const age = this.now().getTime() - new Date(entryCreatedAt).getTime();
    return age < TTL_MS;
  }

  async suggestForBatch(batchId: string, orgId: string): Promise<AdvisorSuggestion | null> {
    // cache check first
    const cached = await this.repo.getAdvisorCache(batchId, orgId);
    if (cached && this.isCacheValid(cached.created_at)) {
      return cached.suggestion;
    }

    const batch = await this.repo.getBatch(batchId);
    if (!batch) return null;
    if (batch.expiry_date === null) return null; // non-perishable skip

    const sku = await this.repo.getSku(batch.sku_id);
    if (!sku) return null;

    const hpp = batch.hpp_snapshot;
    const hargaNormal = sku.harga_normal;

    // guardrail: HPP must be >0
    if (!Number.isFinite(hpp) || hpp <= 0) throw new Error('HPP harus lebih dari 0');
    const days = daysToExpiry(batch.expiry_date, this.now());
    if (days === null) return null;

    // pairing: build co-occurrence map
    const transaksis = await this.repo.listTransaksis(orgId);
    const coMap = buildCooccurrenceMap(transaksis);
    // build avg map for pairing preference (total/14)
    const avgMap = new Map<string, number>();
    const totals = new Map<string, number>();
    for (const t of transaksis) totals.set(t.sku_id, (totals.get(t.sku_id) ?? 0) + t.qty_sold);
    for (const [k, v] of totals) avgMap.set(k, v / 14);

    // urgent set: batches expiring within threshold? For pairing we consider batches with days <=7 as urgent to exclude
    const allBatches = await this.repo.listBatchesExpiring(orgId);
    const urgentSkuIds = new Set<string>();
    for (const b of allBatches) {
      const d = daysToExpiry(b.expiry_date, this.now());
      if (d !== null && d <= 7) {
        urgentSkuIds.add(b.sku_id);
      }
    }

    // skuKategori map
    const skus = await this.repo.listSkus(orgId);
    const skuKategoriMap = new Map(skus.map(s => [s.id, s.kategori_id]));

    let pasanganId: string | null = null;
    try {
      pasanganId = findTopPairing(sku.id, coMap, avgMap, urgentSkuIds, this.opts?.fallbackPairingMap, skuKategoriMap);
    } catch {
      pasanganId = null;
    }
    let pasanganSku: SKU | null = null;
    if (pasanganId) pasanganSku = (await this.repo.getSku(pasanganId)) ?? null;

    const hargaTebus = Math.ceil(hpp * 0.85);
    const baseValidation = validateHargaTebus(hpp, hargaTebus, hargaNormal);
    if (!baseValidation.valid) throw new Error(baseValidation.error ?? 'Harga tebus tidak valid');
    const tebusGuard = validatePromoUsul('tebus', { hpp, harga_tebus: hargaTebus, harga_normal: hargaNormal });
    if (!tebusGuard.valid) throw new Error(tebusGuard.error ?? 'Harga tebus tidak valid');

    let llmResult: { aksi: string; alasan: string; confidence: AdvisorSuggestion['confidence'] };
    try {
      this.llmCallCount++;
      llmResult = await this.llm.generate({
        sku,
        batch,
        daysToExpiry: days,
        pasanganSku,
        hpp,
        hargaNormal,
        hargaTebus,
      });
    } catch (e) {
      if (cached) return cached.suggestion;
      throw e;
    }

    const estimasiMargin = hargaTebus - hpp;
    const suggestion: AdvisorSuggestion = {
      batch_id: batch.id,
      aksi: llmResult.aksi,
      alasan: llmResult.alasan,
      pasangan_tebus_murah: pasanganId,
      harga_tebus: hargaTebus,
      estimasi_margin: estimasiMargin,
      confidence: llmResult.confidence,
      created_at: this.now().toISOString(),
    };

    // cache result in advisorCache Dexie with TTL 24h
    await this.repo.setAdvisorCache({
      id: `${orgId}:${batch.id}:${Date.now()}`,
      org_id: orgId,
      batch_id: batch.id,
      suggestion,
      created_at: suggestion.created_at,
    });

    return suggestion;
  }

  private buildHargaForJenis(
    jenis: PromoJenis,
    hpp: number,
    hargaNormal: number,
    extra?: { hppList?: number[]; margin?: number; cashback?: number; total_paket?: number },
  ): { harga_tebus: number; total_paket?: number; cashback?: number; margin?: number } {
    switch (jenis) {
      case 'tebus':
      case 'diskon':
        return { harga_tebus: Math.ceil(hpp * 0.85) };
      case 'bundling': {
        const sum = extra?.hppList ? extra.hppList.reduce((a, b) => a + b, 0) : hpp;
        const total = extra?.total_paket ?? Math.ceil(sum * 0.85);
        return { harga_tebus: Math.ceil(hpp * 0.85), total_paket: total };
      }
      case 'bogo':
        return { harga_tebus: Math.ceil(hpp * 0.85) };
      case 'cashback':
        return { harga_tebus: Math.ceil(hpp * 0.85), margin: extra?.margin ?? 0, cashback: extra?.cashback ?? 0 };
      default:
        return { harga_tebus: Math.ceil(hpp * 0.85) };
    }
  }

  async suggestForBatchWithJenis(
    batchId: string,
    orgId: string,
    jenis: PromoJenis,
    extra?: { hppList?: number[]; total_paket?: number; margin?: number; cashback?: number; harga_normal_override?: number },
  ): Promise<AdvisorSuggestion | null> {
    const cached = await this.repo.getAdvisorCache(batchId, orgId);
    if (cached && this.isCacheValid(cached.created_at)) {
      return cached.suggestion;
    }
    const batch = await this.repo.getBatch(batchId);
    if (!batch) return null;
    if (batch.expiry_date === null) return null;
    const sku = await this.repo.getSku(batch.sku_id);
    if (!sku) return null;
    const hpp = batch.hpp_snapshot;
    const hargaNormal = extra?.harga_normal_override ?? sku.harga_normal;
    if (!Number.isFinite(hpp) || hpp <= 0) throw new Error('HPP harus lebih dari 0');
    const days = daysToExpiry(batch.expiry_date, this.now());
    if (days === null) return null;

    const transaksis = await this.repo.listTransaksis(orgId);
    const coMap = buildCooccurrenceMap(transaksis);
    const avgMap = new Map<string, number>();
    const totals = new Map<string, number>();
    for (const t of transaksis) totals.set(t.sku_id, (totals.get(t.sku_id) ?? 0) + t.qty_sold);
    for (const [k, v] of totals) avgMap.set(k, v / 14);
    const allBatches = await this.repo.listBatchesExpiring(orgId);
    const urgentSkuIds = new Set<string>();
    for (const b of allBatches) {
      const d = daysToExpiry(b.expiry_date, this.now());
      if (d !== null && d <= 7) urgentSkuIds.add(b.sku_id);
    }
    const skus = await this.repo.listSkus(orgId);
    const skuKategoriMap = new Map(skus.map(s => [s.id, s.kategori_id]));
    let pasanganId: string | null = null;
    try {
      pasanganId = findTopPairing(sku.id, coMap, avgMap, urgentSkuIds, this.opts?.fallbackPairingMap, skuKategoriMap);
    } catch {
      pasanganId = null;
    }
    let pasanganSku: SKU | null = null;
    if (pasanganId) pasanganSku = (await this.repo.getSku(pasanganId)) ?? null;

    const hargaInfo = this.buildHargaForJenis(jenis, hpp, hargaNormal, extra);
    const hargaTebus = hargaInfo.harga_tebus;

    let guard;
    if (jenis === 'bundling') {
      const hppList = extra?.hppList ?? [hpp];
      const totalPaket = hargaInfo.total_paket ?? hargaTebus;
      guard = validatePromoUsul('bundling', { hppList, total_paket: totalPaket });
    } else if (jenis === 'bogo') {
      guard = validatePromoUsul('bogo', { hpp, harga_normal: hargaNormal });
    } else if (jenis === 'cashback') {
      const margin = extra?.margin ?? hargaTebus - hpp;
      const cashback = extra?.cashback ?? 0;
      guard = validatePromoUsul('cashback', { hpp, harga_tebus: hargaTebus, harga_normal: hargaNormal, margin, cashback });
    } else {
      guard = validatePromoUsul(jenis as PromoJenis, { hpp, harga_tebus: hargaTebus, harga_normal: hargaNormal });
    }
    if (!guard.valid) throw new Error(guard.error ?? 'Harga tebus tidak valid');

    let llmResult: { aksi: string; alasan: string; confidence: AdvisorSuggestion['confidence'] };
    try {
      this.llmCallCount++;
      llmResult = await this.llm.generate({
        sku,
        batch,
        daysToExpiry: days,
        pasanganSku,
        hpp,
        hargaNormal,
        hargaTebus,
      });
    } catch (e) {
      if (cached) return cached.suggestion;
      throw e;
    }

    const estimasiMargin = hargaTebus - hpp;
    const suggestion: AdvisorSuggestion = {
      batch_id: batch.id,
      aksi: llmResult.aksi,
      alasan: llmResult.alasan,
      pasangan_tebus_murah: pasanganId,
      harga_tebus: hargaTebus,
      estimasi_margin: estimasiMargin,
      confidence: llmResult.confidence,
      created_at: this.now().toISOString(),
    };

    await this.repo.setAdvisorCache({
      id: `${orgId}:${batch.id}:${Date.now()}`,
      org_id: orgId,
      batch_id: batch.id,
      suggestion,
      created_at: suggestion.created_at,
    });

    return suggestion;
  }

  async suggestTopN(orgId: string, n: number): Promise<AdvisorSuggestion[]> {
    // 1. Rule deterministic ranking top-N urgent without LLM
    const batches = await this.repo.listBatchesExpiring(orgId);
    const transaksis = await this.repo.listTransaksis(orgId);
    const totals = new Map<string, number>();
    for (const t of transaksis) totals.set(t.sku_id, (totals.get(t.sku_id) ?? 0) + t.qty_sold);
    const avgMap = new Map<string, number>();
    for (const [k, v] of totals) avgMap.set(k, v / 14);

    const scored: Array<{ batch: Batch; days: number; score: number }> = [];
    for (const b of batches) {
      const days = daysToExpiry(b.expiry_date, this.now());
      if (days === null) continue;
      const avg = avgMap.get(b.sku_id) ?? 1;
      const score = urgencyScore(b.qty, days, avg);
      scored.push({ batch: b, days, score });
    }
    scored.sort((a, b) => a.score - b.score);
    const topN = scored.slice(0, n);

    const results: AdvisorSuggestion[] = [];
    for (const item of topN) {
      // each will hit cache if valid
      const s = await this.suggestForBatch(item.batch.id, orgId);
      if (s) results.push(s);
    }
    return results;
  }

  async triggerDailyCheck(orgId: string): Promise<AdvisorSuggestion[]> {
    // Trigger daily 07:05 - suggest top-N
    return this.suggestTopN(orgId, 3);
  }

  async onBatchInserted(batchId: string, orgId: string): Promise<AdvisorSuggestion | null> {
    const batch = await this.repo.getBatch(batchId);
    if (!batch || batch.expiry_date === null) return null;
    const days = daysToExpiry(batch.expiry_date, this.now());
    if (days === null) return null;
    // on-demand only if urgent (days <=7)
    if (days > 7) return null;
    return this.suggestForBatch(batchId, orgId);
  }
}
