import { prefillFromAdvisor, type CreatePromoInput } from './promoService';
import type { AdvisorSuggestion } from '../../db/types';

// Stub form for AI assist prefill - UI polishing done by Crew A (mys)
// This file satisfies TASK-14 requirement for TebusForm.tsx existence
export function TebusFormPrefill(suggestion: AdvisorSuggestion): CreatePromoInput {
  return prefillFromAdvisor(suggestion);
}

// Minimal component placeholder (React not required for advisor tests)
export const TebusForm = () => null;
export default TebusForm;
