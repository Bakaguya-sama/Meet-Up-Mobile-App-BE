import type { RecommendationRunResult } from '../../domain/recommendation-run';
import { presentRecommendationResult } from './recommendation-result.presenter';

describe('presentRecommendationResult', () => {
  it('returns rank-ordered top-K with member results and hides full snapshots', () => {
    const run = fixture();
    const view = presentRecommendationResult(run, 'CURRENT_CONTEXT');

    expect(view.results.map((result) => result.rank)).toEqual([1, 2]);
    expect(view.results[0].memberResults).toHaveLength(1);
    expect(view).not.toHaveProperty('candidates');
    expect(view).not.toHaveProperty('memberFeatures');
    expect(view).not.toHaveProperty('places');
  });

  it('rejects a filtered candidate from the public result projection', () => {
    const run = fixture();
    run.candidates[0].filterStatus = 'FILTERED';
    run.candidates[0].filterReason = 'NO_ROUTE';

    expect(() => presentRecommendationResult(run, 'CURRENT_CONTEXT')).toThrow(
      'Persisted recommendation result is inconsistent',
    );
  });
});

function fixture(): RecommendationRunResult {
  const candidate = (id: string, rank: number) => ({
    id,
    runId: 'run',
    canonicalCandidateKey: `google:${id}`,
    provider: 'google',
    providerPlaceId: id,
    name: id,
    latitude: 10,
    longitude: 106,
    providerTypes: ['cafe'],
    sourceCategories: ['cafe'],
    sourcePages: [1],
    filterStatus: 'ELIGIBLE' as const,
    filterReason: null,
    createdAt: new Date('2026-11-02T00:00:00Z'),
    normalizedTags: ['cafe'],
    rating0To5: 4,
    userRatingCount: 10,
    finalRank: rank,
    groupUtility: 0.8,
    candidateLeastMiseryUtility: 0.7,
    paretoLevel: 1,
    inclusionProbability: 1,
    avgEtaSeconds: 600,
    maxEtaSeconds: 700,
    etaRangeSeconds: 100,
    scheduledOpeningStatus: 'OPEN' as const,
    openingEvidence: null,
  });
  const candidates = [candidate('a', 1), candidate('b', 2), candidate('c', 3)];
  const places = candidates.map((value, index) => ({
    id: `place-${value.id}`,
    runId: 'run',
    candidateId: value.id,
    canonicalCandidateKey: value.canonicalCandidateKey,
    rank: index + 1,
    groupUtility: 0.8,
    candidateLeastMiseryUtility: 0.7,
    paretoLevel: 1,
    inclusionProbability: 1,
    avgEtaSeconds: 600,
    maxEtaSeconds: 700,
    etaRangeSeconds: 100,
    scheduledOpeningStatus: 'OPEN' as const,
    openingEvidence: null,
    explanation: {
      summaryCode: 'FAIR_PARETO_RANKED' as const,
      facts: [
        {
          key: 'rank',
          value: index + 1,
          unit: 'COUNT' as const,
          source: 'ENGINE' as const,
        },
      ],
      warnings: [],
    },
    createdAt: new Date('2026-11-02T00:00:00Z'),
  }));
  return {
    id: 'run',
    meetupId: 'meetup',
    requestId: 'request',
    payloadHash: 'a'.repeat(64),
    requestedById: 'actor',
    requestedK: 2,
    status: 'COMPLETED',
    failureCode: null,
    rankingStrategy: 'fair-pareto-v1',
    algorithmVersion: 'algorithm',
    configVersion: 'config',
    featureSchemaVersion: 'features',
    providerMappingVersion: 'mapping',
    providerRequestOptionsVersion: 'provider',
    openingFilter: 'ANY',
    openingEvaluatorVersion: 'opening',
    requestedAt: new Date('2026-11-02T00:00:00Z'),
    scheduledAtSnapshot: new Date('2026-11-02T01:00:00Z'),
    createdAt: new Date('2026-11-02T00:00:00Z'),
    completedAt: new Date('2026-11-02T00:00:01Z'),
    effectiveK: 2,
    warnings: [],
    randomSeed: 'seed',
    routeBatchCount: 1,
    routeElementCount: 3,
    candidates,
    memberFeatures: candidates.map((value) => ({
      id: `feature-${value.id}`,
      runId: 'run',
      candidateId: value.id,
      participantId: 'participant',
      canonicalCandidateKey: value.canonicalCandidateKey,
      etaSeconds: 600,
      distanceMeters: 1000,
      matchedTags: [],
      missingFlags: [],
      travelUtility: 0.7,
      preferenceUtility: 0.8,
      placeQualityUtility: 0.8,
      memberUtility: 0.75,
      routeStatus: 'OK' as const,
      createdAt: new Date('2026-11-02T00:00:00Z'),
    })),
    places,
  };
}
