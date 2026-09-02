import type { AdvisorSuggestion } from '../db/types';

export interface AdvisorPort {
  /**
   * Generate suggestions for top-N urgent batches.
   * - angka from DB, LLM only wording & pairing
   * - guardrail harga_tebus >= HPP*0.85 enforced before LLM
   * - cache TTL 24h
   */
  suggestTopN(orgId: string, n: number): Promise<AdvisorSuggestion[]>;
  suggestForBatch(batchId: string, orgId: string): Promise<AdvisorSuggestion | null>;
  // trigger helpers
  triggerDailyCheck(orgId: string): Promise<AdvisorSuggestion[]>;
  onBatchInserted(batchId: string, orgId: string): Promise<AdvisorSuggestion | null>;
}
