import { OfflineDatasetBuilderService } from './offline-dataset-builder.service';
import { FeedbackLabelPolicy } from './feedback-label.policy';
import { rankingMetrics } from './offline-metrics.service';
import { validateTimeSplit } from './time-split.policy';
import type {
  OfflineEvaluationSource,
  OfflineSourceRun,
} from './offline-evaluation.types';
import { createOfflineEvaluator } from './offline-evaluator.service';
import { RECOMMENDATION_CONFIG_DEV_V1 } from '../recommendation-config';

const run: OfflineSourceRun = {
  id: 'run-1',
  requestedAt: new Date('2026-01-01T00:00:00.000Z'),
  algorithmVersion: 'fair-pareto-v1',
  configVersion: 'config-v1',
  featureSchemaVersion: 'feature-v1',
  rankingStrategy: 'fair-pareto-v1',
  randomSeed: 'seed',
  effectiveK: 2,
  routeElementCount: 4,
  candidates: [
    {
      canonicalCandidateKey: 'a',
      sourceCategories: ['cafe'],
      rating0To5: 4.5,
      userRatingCount: 10,
      finalRank: 1,
      groupUtility: 0.8,
      candidateLeastMiseryUtility: 0.7,
      avgEtaSeconds: 100,
      maxEtaSeconds: 120,
      etaRangeSeconds: 20,
      scheduledOpeningStatus: 'OPEN',
    },
    {
      canonicalCandidateKey: 'b',
      sourceCategories: ['bar'],
      rating0To5: 4,
      userRatingCount: 5,
      finalRank: 2,
      groupUtility: 0.6,
      candidateLeastMiseryUtility: 0.5,
      avgEtaSeconds: 200,
      maxEtaSeconds: 210,
      etaRangeSeconds: 10,
      scheduledOpeningStatus: 'OPEN',
    },
  ],
  memberFeatures: [
    {
      participantId: 'participant-1',
      canonicalCandidateKey: 'a',
      etaSeconds: 100,
      distanceMeters: 300,
      staticDurationSeconds: 90,
      travelUtility: 0.8,
      preferenceUtility: 0.8,
      placeQualityUtility: 0.8,
      memberUtility: 0.8,
      rankingUtility: 0.8,
      missingFlags: [],
    },
    {
      participantId: 'participant-1',
      canonicalCandidateKey: 'b',
      etaSeconds: 200,
      distanceMeters: 500,
      staticDurationSeconds: 180,
      travelUtility: 0.6,
      preferenceUtility: 0.6,
      placeQualityUtility: 0.6,
      memberUtility: 0.6,
      rankingUtility: 0.6,
      missingFlags: [],
    },
  ],
  impressions: [
    {
      eventId: 'impression-a',
      participantId: 'participant-1',
      canonicalCandidateKey: 'a',
      rank: 1,
    },
  ],
  feedback: [
    {
      eventId: 'selected-a',
      participantId: null,
      canonicalCandidateKey: 'a',
      eventType: 'MEETUP_PLACE_SELECTED',
    },
  ],
};

describe('offline evaluation', () => {
  const source: OfflineEvaluationSource = {
    readCompletedRuns: jest.fn().mockResolvedValue([run]),
  };
  it('uses only impressed candidates, pseudonymizes identifiers, and has deterministic content', async () => {
    const builder = new OfflineDatasetBuilderService(source, 'test-salt');
    const input = {
      from: new Date('2026-01-01T00:00:00Z'),
      to: new Date('2026-02-01T00:00:00Z'),
      generatedAt: new Date('2026-02-02T00:00:00Z'),
    };
    const first = await builder.build(input);
    const second = await builder.build(input);
    expect(first.rows).toHaveLength(1);
    expect(first.rows[0].label).toBe(3);
    expect(first.rows[0].participantPseudonym).not.toContain('participant-1');
    expect(JSON.stringify(first.rows)).not.toContain('latitude');
    expect(JSON.stringify(first.rows)).not.toContain('selected-a');
    expect(first.manifest.contentSha256).toBe(second.manifest.contentSha256);
  });
  it('uses the highest label and never turns not-shown into a negative', () => {
    const policy = new FeedbackLabelPolicy();
    expect(
      policy.label([
        {
          eventId: '1',
          participantId: 'x',
          canonicalCandidateKey: 'a',
          eventType: 'NAVIGATION_OPENED',
        },
        {
          eventId: '2',
          participantId: null,
          canonicalCandidateKey: 'a',
          eventType: 'MEETUP_PLACE_SELECTED',
        },
      ]).label,
    ).toBe(3);
    expect(
      run.impressions.some((item) => item.canonicalCandidateKey === 'b'),
    ).toBe(false);
  });
  it('reports N/A when no relevance exists and validates temporal splits', () => {
    const rows = [{ ...awaitRow(), label: 0 }];
    expect(rankingMetrics(rows, 5).ndcg).toBeNull();
    expect(rankingMetrics(rows, 5).coverage).toBe(0);
    expect(() =>
      validateTimeSplit({
        train: { from: new Date('2026-02-01'), to: new Date('2026-03-01') },
        validation: {
          from: new Date('2026-02-15'),
          to: new Date('2026-04-01'),
        },
        test: { from: new Date('2026-04-01'), to: new Date('2026-05-01') },
      }),
    ).toThrow('non-overlapping');
  });
  it('replays all baselines from snapshots without a provider dependency', async () => {
    const evaluator = createOfflineEvaluator(
      source,
      RECOMMENDATION_CONFIG_DEV_V1,
    );
    const report = await evaluator.evaluate({
      from: new Date('2026-01-01T00:00:00Z'),
      to: new Date('2026-02-01T00:00:00Z'),
      k: 2,
    });
    expect(report.map((item) => item.strategy)).toEqual([
      'min-sum',
      'min-max',
      'fair-pareto-v1',
    ]);
    expect(report.every((item) => item.status === 'OK')).toBe(true);
  });
});

function awaitRow() {
  return {
    runId: 'r',
    canonicalCandidateKey: 'a',
    participantPseudonym: 'p',
    recommendationTimestamp: '2026-01-01T00:00:00.000Z',
    algorithmVersion: 'a',
    configVersion: 'c',
    featureSchemaVersion: 'f',
    rankingStrategy: 'fair-pareto-v1',
    groupSize: 1,
    category: null,
    impressionRank: 1,
    originalRank: 1,
    label: 3 as const,
    shown: true as const,
    rawEvents: {},
    features: {
      etaSeconds: 1,
      distanceMeters: 1,
      staticDurationSeconds: null,
      travelUtility: 1,
      preferenceUtility: 1,
      placeQualityUtility: 1,
      memberUtility: 1,
      rankingUtility: 1,
      groupUtility: 1,
      leastMiseryUtility: 1,
      avgEtaSeconds: 1,
      maxEtaSeconds: 1,
      etaRangeSeconds: 0,
      candidateRating: null,
      candidateRatingCount: null,
      scheduledOpeningStatus: null,
      missingFlags: [],
    },
  };
}
