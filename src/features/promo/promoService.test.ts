import { describe, it, expect, beforeEach } from 'vitest';
import { FakeInventoryRepository } from '../../db/fakeRepository';
import { PromoService, prefillFromAdvisor } from './promoService';
import type { SKU, Batch, Kategori } from '../../db/types';
import type { AdvisorSuggestion } from '../../db/types';

describe('Tebus Murah template manual + AI assist flow (proposed)', () => {
  let repo: FakeInventoryRepository;
  let service: PromoService;
  const org = 'toko-01';

  beforeEach(async () => {
    repo = new FakeInventoryRepository();
    const kat: Kategori = { id: 'kat-dairy', nama: 'Dairy', threshold_h_minus: [7, 3, 1], org_id: org };
    await repo.createKategori(kat);
    const sku: SKU = { id: 'sku-susu', nama: 'Susu UHT 1L', kategori_id: 'kat-dairy', hpp: 10000, harga_normal: 15000, org_id: org };
    await repo.createSku(sku);
    const skuRoti: SKU = { id: 'sku-roti', nama: 'Roti Tawar', kategori_id: 'kat-dairy', hpp: 8000, harga_normal: 12000, org_id: org };
    await repo.createSku(skuRoti);
    const batch: Batch = { id: 'batch-1', sku_id: 'sku-susu', qty: 10, expiry_date: '2026-09-05', received_at: '2026-08-30T07:00:00.000Z', hpp_snapshot: 10000, org_id: org };
    await repo.createBatch(batch);
    service = new PromoService(repo);
  });

  it('create manual promo valid passes', async () => {
    const promo = await service.createManualPromo({ batch_id: 'batch-1', sku_pasangan_id: 'sku-roti', harga_tebus: 9000 });
    expect(promo.status).toBe('proposed');
    expect(promo.harga_tebus).toBe(9000);
    const list = await repo.listPromos(org, 'proposed');
    expect(list.length).toBe(1);
  });

  it('create with harga_tebus 0.84*HPP rejects with error "below HPP*0.85"', async () => {
    await expect(service.createManualPromo({ batch_id: 'batch-1', sku_pasangan_id: 'sku-roti', harga_tebus: 8400 })).rejects.toThrow(/HPP x 0.85/);
  });

  it('harga_tebus exactly at floor 0.85 passes', async () => {
    const promo = await service.createManualPromo({ batch_id: 'batch-1', sku_pasangan_id: 'sku-roti', harga_tebus: 8500 });
    expect(promo.harga_tebus).toBe(8500);
  });

  it('AI prefill sets harga_tebus', async () => {
    const suggestion: AdvisorSuggestion = {
      batch_id: 'batch-1',
      aksi: 'Tebus murah',
      alasan: 'Susu mau kadaluarsa',
      pasangan_tebus_murah: 'sku-roti',
      harga_tebus: 9000,
      estimasi_margin: -1000,
      confidence: 'Tinggi',
      created_at: new Date().toISOString(),
    };
    const promo = await service.createFromAdvisor(suggestion);
    expect(promo.harga_tebus).toBe(9000);
    expect(promo.sku_pasangan_id).toBe('sku-roti');
    expect(promo.status).toBe('proposed');
  });

  it('prefillFromAdvisor helper fills form', () => {
    const suggestion: AdvisorSuggestion = {
      batch_id: 'batch-1',
      aksi: 'x',
      alasan: 'y',
      pasangan_tebus_murah: 'sku-roti',
      harga_tebus: 9500,
      estimasi_margin: -500,
      confidence: 'Tinggi',
      created_at: new Date().toISOString(),
    };
    const input = prefillFromAdvisor(suggestion);
    expect(input.harga_tebus).toBe(9500);
    expect(input.batch_id).toBe('batch-1');
  });

  it('harga_tebus > harga_normal → still valid but warning (allowed)', async () => {
    // per TASK-14 failure: harga_tebus > harga_normal → warn/reject per guard
    // our validation allows but warns, so create should still pass (warn not reject)
    const promo = await service.createManualPromo({ batch_id: 'batch-1', sku_pasangan_id: 'sku-roti', harga_tebus: 16000 });
    expect(promo.harga_tebus).toBe(16000);
  });

  it('MUST NOT auto-activate - always proposed', async () => {
    const promo = await service.createManualPromo({ batch_id: 'batch-1', sku_pasangan_id: null, harga_tebus: 9000 });
    expect(promo.status).not.toBe('active');
    expect(promo.status).toBe('proposed');
  });

  it('proposed promos list query', async () => {
    await service.createManualPromo({ batch_id: 'batch-1', sku_pasangan_id: 'sku-roti', harga_tebus: 9000 });
    await service.createManualPromo({ batch_id: 'batch-1', sku_pasangan_id: 'sku-roti', harga_tebus: 9200 });
    const proposed = await service.getProposedPromos(org);
    expect(proposed.length).toBe(2);
  });
});
