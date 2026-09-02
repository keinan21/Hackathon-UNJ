import { describe, it, expect, beforeEach, vi } from 'vitest';
import { FakeInventoryRepository } from '../db/fakeRepository';
import { LangChainGeminiAdvisor, MockLLM } from './LangChainGeminiAdvisor';
import type { SKU, Batch, Kategori } from '../db/types';

describe('LangChainGemini hybrid advisor + cache + guardrail', () => {
  let repo: FakeInventoryRepository;
  let advisor: LangChainGeminiAdvisor;
  const org = 'toko-01';
  let skuSusu: SKU;
  let batchUrgent: Batch;

  beforeEach(async () => {
    repo = new FakeInventoryRepository();
    const katDairy: Kategori = { id: 'kat-dairy', nama: 'Dairy', threshold_h_minus: [7, 3, 1], org_id: org };
    await repo.createKategori(katDairy);
    skuSusu = { id: 'sku-susu', nama: 'Susu UHT 1L Indomilk', kategori_id: 'kat-dairy', hpp: 10000, harga_normal: 15000, org_id: org };
    await repo.createSku(skuSusu);
    const skuRoti: SKU = { id: 'sku-roti', nama: 'Roti Tawar', kategori_id: 'kat-dairy', hpp: 8000, harga_normal: 12000, org_id: org };
    await repo.createSku(skuRoti);
    // transaksis for pairing
    for (let i = 0; i < 3; i++) {
      const soldAt = `2026-08-20T10:00:00.${i}Z`;
      await repo.createTransaksi({ id: `t-roti-${i}`, sku_id: 'sku-roti', qty_sold: 2, sold_at: soldAt, org_id: org });
      await repo.createTransaksi({ id: `t-susu-${i}`, sku_id: 'sku-susu', qty_sold: 1, sold_at: soldAt, org_id: org });
    }
    batchUrgent = {
      id: 'batch-1',
      sku_id: 'sku-susu',
      qty: 10,
      expiry_date: '2026-09-05', // H-3 from 2026-09-02
      received_at: '2026-08-30T07:00:00.000Z',
      hpp_snapshot: 10000,
      org_id: org,
    };
    await repo.createBatch(batchUrgent);
    const mockNow = () => new Date('2026-09-02T07:00:00+07:00');
    advisor = new LangChainGeminiAdvisor(repo, new MockLLM(), { now: mockNow, fallbackPairingMap: new Map([['sku-susu', 'sku-roti']]) });
  });

  it('mock urgent batch → advisor returns {aksi, alasan, pasangan, harga_tebus >=HPP*0.85}', async () => {
    const result = await advisor.suggestForBatch('batch-1', org);
    expect(result).not.toBeNull();
    expect(result!.batch_id).toBe('batch-1');
    expect(result!.pasangan_tebus_murah).toBe('sku-roti');
    expect(result!.harga_tebus).toBeGreaterThanOrEqual(8500);
    expect(result!.alasan).toBeTruthy();
    expect(result!.aksi).toBeTruthy();
  });

  it('cache hit second call no LLM', async () => {
    await advisor.suggestForBatch('batch-1', org);
    const countAfterFirst = advisor.llmCallCount;
    await advisor.suggestForBatch('batch-1', org);
    expect(advisor.llmCallCount).toBe(countAfterFirst); // no extra call
  });

  it('harga_tebus 0.84*HPP rejects', async () => {
    const mockNow = () => new Date('2026-09-02T07:00:00+07:00');
    const badAdvisor = new LangChainGeminiAdvisor(repo, new MockLLM({ forceHargaTebus: 8400 }), { now: mockNow });
    await expect(badAdvisor.suggestForBatch('batch-1', org)).rejects.toThrow(/HPP x 0.85/);
  });

  it('top-N 3 urgent → 3 suggestions cached', async () => {
    // add 2 more urgent batches
    await repo.createBatch({ id: 'batch-2', sku_id: 'sku-susu', qty: 5, expiry_date: '2026-09-03', received_at: '2026-08-30T07:00:00.000Z', hpp_snapshot: 10000, org_id: org });
    await repo.createBatch({ id: 'batch-3', sku_id: 'sku-susu', qty: 8, expiry_date: '2026-09-04', received_at: '2026-08-30T07:00:00.000Z', hpp_snapshot: 10000, org_id: org });
    const results = await advisor.suggestTopN(org, 3);
    expect(results.length).toBe(3);
    // second call should be cached
    const before = advisor.llmCallCount;
    const results2 = await advisor.suggestTopN(org, 3);
    expect(results2.length).toBe(3);
    expect(advisor.llmCallCount).toBe(before);
  });

  it('offline → returns cached stale, not throw', async () => {
    const mockNow = () => new Date('2026-09-02T07:00:00+07:00');
    const good = new LangChainGeminiAdvisor(repo, new MockLLM(), { now: mockNow });
    const first = await good.suggestForBatch('batch-1', org);
    expect(first).not.toBeNull();
    // now offline: advance time within TTL but LLM fails
    const offlineAdvisor = new LangChainGeminiAdvisor(repo, new MockLLM({ shouldFail: true }), { now: () => new Date('2026-09-02T08:00:00+07:00') });
    const cached = await offlineAdvisor.suggestForBatch('batch-1', org);
    expect(cached).not.toBeNull();
    expect(cached!.batch_id).toBe('batch-1');
  });

  it('offline without cache throws', async () => {
    const offlineAdvisor = new LangChainGeminiAdvisor(repo, new MockLLM({ shouldFail: true }), { now: () => new Date('2026-09-02T07:00:00+07:00') });
    await repo.clearAdvisorCache(org);
    // ensure no cache
    await expect(offlineAdvisor.suggestForBatch('batch-1', org)).rejects.toThrow();
  });

  it('expiry null batch not suggested', async () => {
    await repo.createBatch({ id: 'batch-null', sku_id: 'sku-susu', qty: 10, expiry_date: null, received_at: '2026-08-30T07:00:00.000Z', hpp_snapshot: 10000, org_id: org });
    const result = await advisor.suggestForBatch('batch-null', org);
    expect(result).toBeNull();
  });

  it('trigger daily 07:05 + on-demand after batch insert urgent', async () => {
    const results = await advisor.triggerDailyCheck(org);
    expect(results.length).toBeGreaterThanOrEqual(1);
    // on-demand: new urgent batch H-2
    const newBatch: Batch = { id: 'batch-new', sku_id: 'sku-susu', qty: 10, expiry_date: '2026-09-04', received_at: new Date().toISOString(), hpp_snapshot: 10000, org_id: org };
    await repo.createBatch(newBatch);
    const onDemand = await advisor.onBatchInserted('batch-new', org);
    expect(onDemand).not.toBeNull();
    // non-urgent >7 days should not trigger
    const nonUrgent: Batch = { id: 'batch-far', sku_id: 'sku-susu', qty: 10, expiry_date: '2026-09-20', received_at: new Date().toISOString(), hpp_snapshot: 10000, org_id: org };
    await repo.createBatch(nonUrgent);
    const noTrigger = await advisor.onBatchInserted('batch-far', org);
    expect(noTrigger).toBeNull();
  });

  it('cache TTL 24h expiry → second call after 25h calls LLM again', async () => {
    let now = new Date('2026-09-02T07:00:00+07:00');
    const adv = new LangChainGeminiAdvisor(repo, new MockLLM(), { now: () => now });
    await adv.suggestForBatch('batch-1', org);
    expect(adv.llmCallCount).toBe(1);
    // within TTL
    now = new Date('2026-09-02T20:00:00+07:00');
    await adv.suggestForBatch('batch-1', org);
    expect(adv.llmCallCount).toBe(1);
    // after TTL
    now = new Date('2026-09-03T08:01:00+07:00');
    await adv.suggestForBatch('batch-1', org);
    expect(adv.llmCallCount).toBe(2);
  });
});
