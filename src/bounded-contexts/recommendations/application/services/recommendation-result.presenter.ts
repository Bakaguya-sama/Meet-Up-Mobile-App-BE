import type {
  RankedRecommendationResult,
  RecommendationPublicView,
  RecommendationRunResult,
} from '../../domain/recommendation-run';
import type { RecommendationContextStatus } from '../../domain/temporal-context';

export function presentRecommendationResult(
  run: RecommendationRunResult,
  contextStatus: RecommendationContextStatus,
): RecommendationPublicView {
  const candidateById = new Map(
    run.candidates.map((candidate) => [candidate.id, candidate]),
  );
  const featuresByCandidateId = new Map<string, typeof run.memberFeatures>();
  for (const feature of run.memberFeatures) {
    const values = featuresByCandidateId.get(feature.candidateId) ?? [];
    values.push(feature);
    featuresByCandidateId.set(feature.candidateId, values);
  }

  const results: RankedRecommendationResult[] = run.places
    .filter((place) => place.rank <= (run.effectiveK ?? 0))
    .sort((left, right) => left.rank - right.rank)
    .map((place) => {
      const candidate = candidateById.get(place.candidateId);
      if (!candidate || candidate.filterStatus !== 'ELIGIBLE') {
        throw new Error('Persisted recommendation result is inconsistent');
      }
      return {
        ...place,
        explanation: structuredClone(place.explanation),
        openingEvidence: place.openingEvidence
          ? structuredClone(place.openingEvidence)
          : null,
        candidate,
        memberResults: (featuresByCandidateId.get(place.candidateId) ?? [])
          .filter((feature) => feature.routeStatus === 'OK')
          .sort((left, right) =>
            left.participantId.localeCompare(right.participantId),
          ),
      };
    });

  const { candidates, memberFeatures, places, ...metadata } = run;
  void candidates;
  void memberFeatures;
  void places;
  return { ...metadata, contextStatus, results };
}
