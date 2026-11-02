import type { EligibleCandidate } from './candidate-filter';
import { ScheduledOpeningEvaluator } from './scheduled-opening.evaluator';

export interface ScheduledOpeningPolicyResult {
  candidates: EligibleCandidate[];
  filtered: Array<{ candidate: EligibleCandidate; reason: 'SCHEDULED_CLOSED' }>;
  warnings: string[];
}

export function applyScheduledOpeningPolicy(
  candidates: EligibleCandidate[],
  scheduledAt: Date,
  evaluator: ScheduledOpeningEvaluator,
): ScheduledOpeningPolicyResult {
  const warnings: string[] = [];
  const filtered: ScheduledOpeningPolicyResult['filtered'] = [];
  const retained = candidates.flatMap((candidate) => {
    const evaluation = evaluator.evaluate(candidate, scheduledAt);
    warnings.push(...evaluation.warnings);
    const evaluated = {
      ...candidate,
      scheduledOpeningStatus: evaluation.status,
      openingEvidence: evaluation.evidence,
    };
    if (evaluation.status === 'CLOSED') {
      filtered.push({ candidate: evaluated, reason: 'SCHEDULED_CLOSED' });
      return [];
    }
    return [evaluated];
  });
  return {
    candidates: retained,
    filtered,
    warnings: [...new Set(warnings)],
  };
}
