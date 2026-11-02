import type { EligibleCandidate } from './candidate-filter';
import { ScheduledOpeningEvaluator } from './scheduled-opening.evaluator';

export interface ScheduledOpeningPolicyResult {
  candidates: EligibleCandidate[];
  warnings: string[];
}

export function applyScheduledOpeningPolicy(
  candidates: EligibleCandidate[],
  scheduledAt: Date,
  evaluator: ScheduledOpeningEvaluator,
): ScheduledOpeningPolicyResult {
  const warnings: string[] = [];
  const retained = candidates.flatMap((candidate) => {
    const evaluation = evaluator.evaluate(candidate, scheduledAt);
    warnings.push(...evaluation.warnings);
    return evaluation.status === 'CLOSED'
      ? []
      : [
          {
            ...candidate,
            scheduledOpeningStatus: evaluation.status,
            openingEvidence: evaluation.evidence,
          },
        ];
  });
  return { candidates: retained, warnings: [...new Set(warnings)] };
}
