import type { MemberFeature } from './member-utility.service';
import type { ClosingEvidence } from '../../domain/temporal-context';

export function applyClosingPenalty(
  features: MemberFeature[],
  evidenceByCandidate: ReadonlyMap<string, ClosingEvidence>,
): MemberFeature[] {
  return features.map((feature) => {
    const penalty =
      evidenceByCandidate.get(feature.canonicalCandidateKey)?.closingPenalty ??
      0;
    return {
      ...feature,
      rankingUtility: clamp(feature.memberUtility - penalty),
    };
  });
}

function clamp(value: number) {
  return Math.max(0, Math.min(1, value));
}
