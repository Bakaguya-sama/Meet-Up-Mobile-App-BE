import type {
  RecommendationExplanation,
  RecommendationExplanationFact,
  RecommendationPlaceSnapshot,
} from '../../domain/recommendation-run';
import type { RankingStrategy } from './group-ranker.service';

type ExplanationMetrics = Pick<
  RecommendationPlaceSnapshot,
  | 'rank'
  | 'groupUtility'
  | 'candidateLeastMiseryUtility'
  | 'paretoLevel'
  | 'inclusionProbability'
  | 'avgEtaSeconds'
  | 'maxEtaSeconds'
  | 'scheduledOpeningStatus'
  | 'closingEvidence'
>;

export class ExplanationBuilder {
  build(
    strategy: RankingStrategy,
    metrics: ExplanationMetrics,
    effectiveK: number,
    warnings: string[],
  ): RecommendationExplanation {
    const facts: RecommendationExplanationFact[] = [
      fact('rank', metrics.rank, 'COUNT', 'ENGINE'),
      fact('effectiveK', effectiveK, 'COUNT', 'ENGINE'),
      fact('avgEtaSeconds', metrics.avgEtaSeconds, 'SECOND', 'ROUTES'),
      fact('maxEtaSeconds', metrics.maxEtaSeconds, 'SECOND', 'ROUTES'),
      fact(
        'candidateLeastMiseryUtility',
        metrics.candidateLeastMiseryUtility,
        'UTILITY_0_1',
        'ENGINE',
      ),
      fact('groupUtility', metrics.groupUtility, 'UTILITY_0_1', 'ENGINE'),
    ];

    if (metrics.scheduledOpeningStatus) {
      facts.push({
        key: 'scheduledOpeningStatus',
        value: metrics.scheduledOpeningStatus,
        source: 'PLACES',
      });
    }
    if (metrics.closingEvidence?.status === 'CLOSING_SOON') {
      facts.push(
        {
          key: 'closingStatus',
          value: metrics.closingEvidence.status,
          source: 'PLACES',
        },
        fact(
          'secondsUntilClose',
          metrics.closingEvidence.secondsUntilClose ?? 0,
          'SECOND',
          'PLACES',
        ),
        fact(
          'closingRisk',
          metrics.closingEvidence.closingRisk,
          'PROBABILITY_0_1',
          'ENGINE',
        ),
        fact(
          'closingPenalty',
          metrics.closingEvidence.closingPenalty,
          'UTILITY_0_1',
          'ENGINE',
        ),
      );
    }
    if (strategy === 'fair-pareto-v1') {
      facts.push(fact('paretoLevel', metrics.paretoLevel, 'COUNT', 'ENGINE'));
      if (metrics.inclusionProbability !== null) {
        facts.push(
          fact(
            'inclusionProbability',
            metrics.inclusionProbability,
            'PROBABILITY_0_1',
            'ENGINE',
          ),
        );
      }
    }

    return {
      summaryCode: summaryCode(strategy),
      facts,
      warnings: [...new Set(warnings)],
    };
  }
}

function summaryCode(strategy: RankingStrategy) {
  if (strategy === 'min-sum') return 'MIN_SUM_RANKED' as const;
  if (strategy === 'min-max') return 'MIN_MAX_RANKED' as const;
  return 'FAIR_PARETO_RANKED' as const;
}

function fact(
  key: string,
  value: number,
  unit: RecommendationExplanationFact['unit'],
  source: RecommendationExplanationFact['source'],
): RecommendationExplanationFact {
  return { key, value, unit, source };
}
