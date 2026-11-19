import type { RecommendationConfig } from '../recommendation-config';
import {
  GroupRankerService,
  type RankingStrategy,
} from '../services/group-ranker.service';
import type { MemberFeature } from '../services/member-utility.service';
import { FeedbackLabelPolicy } from './feedback-label.policy';
import {
  rankingMetrics,
  type RankingMetricSummary,
} from './offline-metrics.service';
import type {
  OfflineDatasetRow,
  OfflineEvaluationSource,
} from './offline-evaluation.types';

export interface OfflineStrategyReport {
  strategy: RankingStrategy;
  status: 'OK' | 'UNAVAILABLE';
  error: string | null;
  metrics: RankingMetricSummary | null;
  averageEtaSeconds: number | null;
  averageGroupUtility: number | null;
  averageLeastMiseryUtility: number | null;
  breakdown: {
    groupSize: Record<string, RankingMetricSummary>;
    category: Record<string, RankingMetricSummary>;
    algorithmConfigVersion: Record<string, RankingMetricSummary>;
  };
}

/** Snapshot-only evaluator. Its only dependency is OfflineEvaluationSource; it cannot call external providers. */
export class OfflineEvaluatorService {
  constructor(
    private readonly source: OfflineEvaluationSource,
    private readonly ranker: GroupRankerService,
    private readonly labels = new FeedbackLabelPolicy(),
  ) {}

  async evaluate(input: {
    from: Date;
    to: Date;
    k: number;
    algorithmVersion?: string;
    configVersion?: string;
  }): Promise<OfflineStrategyReport[]> {
    const runs = await this.source.readCompletedRuns(input);
    const strategies: RankingStrategy[] = [
      'min-sum',
      'min-max',
      'fair-pareto-v1',
    ];
    return strategies.map((strategy) =>
      this.evaluateStrategy(strategy, runs, input.k),
    );
  }

  private evaluateStrategy(
    strategy: RankingStrategy,
    runs: Awaited<ReturnType<OfflineEvaluationSource['readCompletedRuns']>>,
    k: number,
  ): OfflineStrategyReport {
    try {
      const rows: OfflineDatasetRow[] = [];
      const etas: number[] = [];
      const utilities: number[] = [];
      const leastMisery: number[] = [];
      for (const run of runs) {
        if (!run.randomSeed || !run.effectiveK || !run.memberFeatures.length)
          throw new Error(
            `Run ${run.id} lacks immutable replay seed/effectiveK/features`,
          );
        const ranking = this.ranker.rank(
          run.memberFeatures.map(toMemberFeature),
          strategy,
          run.effectiveK,
          run.randomSeed,
        );
        const candidateRank = new Map(
          ranking.map((candidate) => [
            candidate.canonicalCandidateKey,
            candidate,
          ]),
        );
        const candidates = new Map(
          run.candidates.map((candidate) => [
            candidate.canonicalCandidateKey,
            candidate,
          ]),
        );
        for (const impression of run.impressions) {
          const result = candidateRank.get(impression.canonicalCandidateKey);
          if (!result) continue;
          const label = this.labels.label(
            run.feedback.filter(
              (event) =>
                event.canonicalCandidateKey ===
                  impression.canonicalCandidateKey &&
                (event.participantId === impression.participantId ||
                  event.eventType === 'MEETUP_PLACE_SELECTED'),
            ),
          );
          rows.push({
            runId: run.id,
            canonicalCandidateKey: impression.canonicalCandidateKey,
            participantPseudonym: `evaluation-${impression.participantId}`,
            recommendationTimestamp: run.requestedAt.toISOString(),
            algorithmVersion: run.algorithmVersion,
            configVersion: run.configVersion,
            featureSchemaVersion: run.featureSchemaVersion,
            rankingStrategy: strategy,
            groupSize: new Set(
              run.memberFeatures.map((feature) => feature.participantId),
            ).size,
            category:
              candidates.get(impression.canonicalCandidateKey)
                ?.sourceCategories[0] ?? null,
            impressionRank: result.finalRank,
            originalRank: impression.rank,
            label: label.label,
            shown: true,
            rawEvents: label.rawEvents,
            features: {
              etaSeconds: result.avgEtaSeconds,
              distanceMeters: 0,
              staticDurationSeconds: null,
              travelUtility: 0,
              preferenceUtility: 0,
              placeQualityUtility: 0,
              memberUtility: 0,
              rankingUtility: 0,
              groupUtility: result.groupUtility,
              leastMiseryUtility: result.leastMiseryUtility,
              avgEtaSeconds: result.avgEtaSeconds,
              maxEtaSeconds: result.maxEtaSeconds,
              etaRangeSeconds: result.etaRangeSeconds,
              candidateRating: null,
              candidateRatingCount: null,
              scheduledOpeningStatus: null,
              missingFlags: [],
            },
          });
          etas.push(result.avgEtaSeconds);
          utilities.push(result.groupUtility);
          leastMisery.push(result.leastMiseryUtility);
        }
      }
      return {
        strategy,
        status: 'OK',
        error: null,
        metrics: rankingMetrics(rows, k),
        averageEtaSeconds: average(etas),
        averageGroupUtility: average(utilities),
        averageLeastMiseryUtility: average(leastMisery),
        breakdown: {
          groupSize: breakdown(rows, k, (row) => String(row.groupSize)),
          category: breakdown(rows, k, (row) => row.category ?? 'unknown'),
          algorithmConfigVersion: breakdown(
            rows,
            k,
            (row) => `${row.algorithmVersion}:${row.configVersion}`,
          ),
        },
      };
    } catch (error) {
      return {
        strategy,
        status: 'UNAVAILABLE',
        error: error instanceof Error ? error.message : String(error),
        metrics: null,
        averageEtaSeconds: null,
        averageGroupUtility: null,
        averageLeastMiseryUtility: null,
        breakdown: { groupSize: {}, category: {}, algorithmConfigVersion: {} },
      };
    }
  }
}

function toMemberFeature(feature: {
  participantId: string;
  canonicalCandidateKey: string;
  etaSeconds: number;
  distanceMeters: number;
  staticDurationSeconds: number | null;
  travelUtility: number;
  preferenceUtility: number;
  placeQualityUtility: number;
  memberUtility: number;
  rankingUtility: number;
}): MemberFeature {
  return {
    ...feature,
    staticDurationSeconds: feature.staticDurationSeconds ?? undefined,
    placeTags: [],
    preferences: [],
    rating0To5: null,
    userRatingCount: null,
    matchedTags: [],
    missingFlags: [],
  };
}
function average(values: number[]) {
  return values.length
    ? values.reduce((sum, value) => sum + value, 0) / values.length
    : null;
}
function breakdown(
  rows: OfflineDatasetRow[],
  k: number,
  key: (row: OfflineDatasetRow) => string,
) {
  const groups = new Map<string, OfflineDatasetRow[]>();
  rows.forEach((row) =>
    groups.set(key(row), [...(groups.get(key(row)) ?? []), row]),
  );
  return Object.fromEntries(
    [...groups.entries()]
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([name, values]) => [name, rankingMetrics(values, k)]),
  );
}

export function createOfflineEvaluator(
  source: OfflineEvaluationSource,
  config: RecommendationConfig,
) {
  return new OfflineEvaluatorService(source, new GroupRankerService(config));
}
