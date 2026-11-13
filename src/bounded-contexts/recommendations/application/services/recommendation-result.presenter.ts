import type {
  RecommendationPublicView,
  RecommendationRunResult,
} from '../../domain/recommendation-run';
import type { RecommendationContextStatus } from '../../domain/temporal-context';

export function presentForViewer(
  actorId: string,
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

  const results = run.places
    .filter((place) => place.rank <= (run.effectiveK ?? 0))
    .sort((left, right) => left.rank - right.rank)
    .map((place) => {
      const candidate = candidateById.get(place.candidateId);
      if (!candidate || candidate.filterStatus !== 'ELIGIBLE') {
        throw new Error('Persisted recommendation result is inconsistent');
      }
      return {
        rank: place.rank,
        canonicalCandidateKey: place.canonicalCandidateKey,
        candidate: {
          canonicalCandidateKey: candidate.canonicalCandidateKey,
          provider: candidate.provider,
          providerPlaceId: candidate.providerPlaceId,
          name: candidate.name,
          rating0To5: candidate.rating0To5,
          userRatingCount: candidate.userRatingCount,
        },
        avgEtaSeconds: place.avgEtaSeconds,
        maxEtaSeconds: place.maxEtaSeconds,
        etaRangeSeconds: place.etaRangeSeconds,
        memberEtas: (featuresByCandidateId.get(place.candidateId) ?? [])
          .filter((feature) => feature.routeStatus === 'OK')
          .sort((left, right) =>
            left.participantId.localeCompare(right.participantId),
          )
          .map((feature) => ({
            participantId: feature.participantId,
            etaSeconds: feature.etaSeconds,
          })),
        viewerFeature: privateFeature(
          actorId,
          featuresByCandidateId.get(place.candidateId) ?? [],
        ),
        scheduledOpeningStatus: place.scheduledOpeningStatus,
        closingEvidence: place.closingEvidence
          ? structuredClone(place.closingEvidence)
          : null,
        explanation: publicExplanation(place.explanation),
      };
    });

  const { candidates, memberFeatures, places, ...metadata } = run;
  void candidates;
  void memberFeatures;
  void places;
  return { ...metadata, contextStatus, results };
}

/** Legacy internal call sites use requester presentation only until migrated. */
export function presentRecommendationResult(
  run: RecommendationRunResult,
  contextStatus: RecommendationContextStatus,
) {
  return presentForViewer(run.requestedById, run, contextStatus);
}

function privateFeature(
  actorId: string,
  features: RecommendationRunResult['memberFeatures'],
) {
  const feature = features.find(
    (value) => value.participantId.toLowerCase() === actorId.toLowerCase(),
  );
  return feature
    ? {
        participantId: feature.participantId,
        matchedTags: feature.matchedTags.map((tag) => ({ ...tag })),
        travelUtility: feature.travelUtility,
        preferenceUtility: feature.preferenceUtility,
        placeQualityUtility: feature.placeQualityUtility,
        memberUtility: feature.memberUtility,
      }
    : null;
}

function publicExplanation(
  explanation: RecommendationPublicView['results'][number]['explanation'],
) {
  const privateFacts = new Set([
    'groupUtility',
    'candidateLeastMiseryUtility',
    'inclusionProbability',
  ]);
  return {
    ...structuredClone(explanation),
    facts: explanation.facts.filter((fact) => !privateFacts.has(fact.key)),
  };
}
