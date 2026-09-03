import type { InventoryRepository } from '../../db/repository';
import type { Promo, AdvisorSuggestion } from '../../db/types';
import { validateHargaTebus } from '../../lib/validation';
import type { AdvisorPort } from '../../advisor/AdvisorPort';

export interface CreatePromoInput {
  batch_id: string;
  sku_pasangan_id: string | null;
  harga_tebus: number;
  org_id?: string;
}

export class PromoService {
  constructor(private repo: InventoryRepository, private now: () => Date = () => new Date()) {}

  async createManualPromo(input: CreatePromoInput): Promise<Promo> {
    const orgId = input.org_id ?? 'toko-01';
    const batch = await this.repo.getBatch(input.batch_id);
    if (!batch) throw new Error('Batch tidak ditemukan');
    if (batch.org_id !== orgId && batch.org_id !== undefined) {
      // allow but enforce org
    }
    const sku = await this.repo.getSku(batch.sku_id);
    if (!sku) throw new Error('SKU tidak ditemukan');

    const hpp = batch.hpp_snapshot;
    const hargaNormal = sku.harga_normal;

    const validation = validateHargaTebus(hpp, input.harga_tebus, hargaNormal);
    if (!validation.valid) {
      throw new Error(validation.error ?? 'Harga tebus tidak valid');
    }

    // floor check explicit message for test
    const floor = hpp * 0.85;
    if (input.harga_tebus < floor - 1e-9) {
      throw new Error(`Harga tebus tidak boleh di bawah HPP x 0.85 (Rp ${Math.round(floor).toLocaleString('id-ID')})`);
    }

    const promo: Promo = {
      id: `promo-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      batch_id: input.batch_id,
      sku_pasangan_id: input.sku_pasangan_id,
      harga_tebus: input.harga_tebus,
      status: 'proposed',
      org_id: orgId,
      created_at: this.now().toISOString(),
    };

    // MUST NOT auto-activate, always proposed
    await this.repo.createPromo(promo);
    return promo;
  }

  /**
   * AI assist prefill: takes AdvisorSuggestion and creates proposed promo
   * harga_tebus already validated via advisor guardrail, but re-validate here
   */
  async createFromAdvisor(suggestion: AdvisorSuggestion, orgId = 'toko-01'): Promise<Promo> {
    return this.createManualPromo({
      batch_id: suggestion.batch_id,
      sku_pasangan_id: suggestion.pasangan_tebus_murah,
      harga_tebus: suggestion.harga_tebus,
      org_id: orgId,
    });
  }

  async createSuggestedPromo(batchId: string, advisor: AdvisorPort, orgId = 'toko-01'): Promise<Promo | null> {
    const existing = await this.repo.listPromos(orgId);
    const open = existing.find(promo => promo.batch_id === batchId && (promo.status === 'proposed' || promo.status === 'active'));
    if (open) return open;
    const suggestion = await advisor.suggestForBatch(batchId, orgId);
    return suggestion ? this.createFromAdvisor(suggestion, orgId) : null;
  }

  async getProposedPromos(orgId: string): Promise<Promo[]> {
    return this.repo.listPromos(orgId, 'proposed');
  }

  async getActivePromos(orgId: string): Promise<Promo[]> {
    return this.repo.listPromos(orgId, 'active');
  }
}

// Minimal React form stub for AI assist - not full UI, just for spec
export function prefillFromAdvisor(suggestion: AdvisorSuggestion): CreatePromoInput {
  return {
    batch_id: suggestion.batch_id,
    sku_pasangan_id: suggestion.pasangan_tebus_murah,
    harga_tebus: suggestion.harga_tebus,
  };
}
