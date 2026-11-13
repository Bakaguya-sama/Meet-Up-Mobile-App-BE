import { RecommendationError } from '../../domain/recommendation.error';
import type { RecommendationConfig } from '../recommendation-config';
import type { MemberFeature } from './member-utility.service';

export type RankingStrategy = 'min-sum' | 'min-max' | 'fair-pareto-v1';

export interface RankedCandidate {
  canonicalCandidateKey: string;
  finalRank: number;
  groupUtility: number;
  leastMiseryUtility: number;
  paretoLevel: number;
  inclusionProbability: number | null;
  avgEtaSeconds: number;
  maxEtaSeconds: number;
  etaRangeSeconds: number;
  memberRanks: Record<string, number>;
}

export class GroupRankerService {
  constructor(private readonly config: RecommendationConfig) {}

  rank(
    features: MemberFeature[],
    strategy: RankingStrategy,
    effectiveK: number,
    seed: string,
  ): RankedCandidate[] {
    const grouped = new Map<string, MemberFeature[]>();
    for (const feature of features) {
      const list = grouped.get(feature.canonicalCandidateKey) ?? [];
      list.push(feature);
      grouped.set(feature.canonicalCandidateKey, list);
    }
    if (!grouped.size || effectiveK <= 0 || effectiveK > grouped.size) {
      throw new RecommendationError(
        'INVALID_RECOMMENDATION_NUMERIC',
        'Ranking input and effectiveK must be non-empty and consistent',
      );
    }
    const participantIds = [
      ...new Set(features.map((feature) => feature.participantId)),
    ].sort();
    if (
      [...grouped.values()].some(
        (values) => values.length !== participantIds.length,
      )
    ) {
      throw new RecommendationError(
        'INVALID_RECOMMENDATION_NUMERIC',
        'Every ranked candidate must have one feature per member',
      );
    }
    const memberRanks = buildMemberRanks(
      grouped,
      participantIds,
      this.config.utilityTieEpsilon,
    );
    const metrics = [...grouped.entries()].map(([key, values]) => {
      const rankingUtilities = values.map(
        (value) => value.rankingUtility ?? value.memberUtility,
      );
      const etas = values.map((value) => value.etaSeconds);
      const closingPenalty =
        values[0].memberUtility -
        (values[0].rankingUtility ?? values[0].memberUtility);
      return {
        canonicalCandidateKey: key,
        finalRank: 0,
        groupUtility:
          rankingUtilities.reduce((sum, value) => sum + value, 0) /
          rankingUtilities.length,
        leastMiseryUtility: Math.min(...rankingUtilities),
        paretoLevel: 0,
        inclusionProbability: null as number | null,
        avgEtaSeconds:
          etas.reduce((sum, value) => sum + value, 0) / etas.length,
        maxEtaSeconds: Math.max(...etas),
        etaRangeSeconds: Math.max(...etas) - Math.min(...etas),
        memberRanks: memberRanks.get(key)!,
        closingPenalty,
      };
    });
    for (const candidate of metrics) {
      candidate.paretoLevel =
        1 +
        metrics.filter(
          (other) =>
            other !== candidate &&
            dominates(other.memberRanks, candidate.memberRanks, participantIds),
        ).length;
    }
    let ordered: typeof metrics;
    if (strategy === 'min-sum') {
      ordered = [...metrics].sort(
        (a, b) =>
          a.avgEtaSeconds / this.config.tauSeconds +
            a.closingPenalty -
            (b.avgEtaSeconds / this.config.tauSeconds + b.closingPenalty) ||
          a.canonicalCandidateKey.localeCompare(b.canonicalCandidateKey),
      );
    } else if (strategy === 'min-max') {
      ordered = [...metrics].sort(
        (a, b) =>
          a.maxEtaSeconds / this.config.tauSeconds +
            a.closingPenalty -
            (b.maxEtaSeconds / this.config.tauSeconds + b.closingPenalty) ||
          a.avgEtaSeconds / this.config.tauSeconds +
            a.closingPenalty -
            (b.avgEtaSeconds / this.config.tauSeconds + b.closingPenalty) ||
          a.canonicalCandidateKey.localeCompare(b.canonicalCandidateKey),
      );
    } else {
      ordered = rankFairPareto(
        metrics,
        participantIds,
        effectiveK,
        this.config.monteCarloSamples,
        seed,
      );
    }
    return ordered.map((candidate, index) => ({
      ...candidate,
      finalRank: index + 1,
    }));
  }
}

function buildMemberRanks(
  grouped: Map<string, MemberFeature[]>,
  participantIds: string[],
  epsilon: number,
) {
  const ranks = new Map<string, Record<string, number>>(
    [...grouped.keys()].map((key) => [key, {}]),
  );
  for (const participantId of participantIds) {
    const sorted = [...grouped.entries()]
      .map(([key, values]) => {
        const feature = values.find(
          (value) => value.participantId === participantId,
        )!;
        return {
          key,
          quantized: Math.round(
            (feature.rankingUtility ?? feature.memberUtility) / epsilon,
          ),
        };
      })
      .sort((a, b) => b.quantized - a.quantized || a.key.localeCompare(b.key));
    let rank = 1;
    sorted.forEach((value, index) => {
      if (index && value.quantized !== sorted[index - 1].quantized)
        rank = index + 1;
      ranks.get(value.key)![participantId] = rank;
    });
  }
  return ranks;
}

function dominates(
  a: Record<string, number>,
  b: Record<string, number>,
  members: string[],
) {
  return (
    members.every((member) => a[member] <= b[member]) &&
    members.some((member) => a[member] < b[member])
  );
}

function rankFairPareto<T extends RankedCandidate>(
  candidates: T[],
  members: string[],
  effectiveK: number,
  samples: number,
  seed: string,
): T[] {
  const levels = [
    ...new Set(candidates.map((value) => value.paretoLevel)),
  ].sort((a, b) => a - b);
  const poolLevel = levels.find(
    (level) =>
      candidates.filter((candidate) => candidate.paretoLevel <= level).length >=
      effectiveK,
  )!;
  const pool = candidates.filter(
    (candidate) => candidate.paretoLevel <= poolLevel,
  );
  const counts = new Map(pool.map((candidate) => [candidate, 0]));
  const rng = mulberry32(hashSeed(seed));
  for (let sample = 0; sample < samples; sample += 1) {
    const exponential = members.map(() => -Math.log(open01(rng)));
    const sum = exponential.reduce((total, value) => total + value, 0);
    const weights = exponential.map((value) => value / sum);
    const top = [...pool]
      .sort((a, b) => {
        const aRank = members.reduce(
          (total, member, index) =>
            total + weights[index] * a.memberRanks[member],
          0,
        );
        const bRank = members.reduce(
          (total, member, index) =>
            total + weights[index] * b.memberRanks[member],
          0,
        );
        return (
          aRank - bRank ||
          a.canonicalCandidateKey.localeCompare(b.canonicalCandidateKey)
        );
      })
      .slice(0, effectiveK);
    top.forEach((candidate) =>
      counts.set(candidate, counts.get(candidate)! + 1),
    );
  }
  pool.forEach(
    (candidate) =>
      (candidate.inclusionProbability = counts.get(candidate)! / samples),
  );
  const tieBreak = (a: T, b: T) =>
    b.leastMiseryUtility - a.leastMiseryUtility ||
    b.groupUtility - a.groupUtility ||
    a.maxEtaSeconds - b.maxEtaSeconds ||
    a.canonicalCandidateKey.localeCompare(b.canonicalCandidateKey);
  const remaining = candidates.filter((candidate) => !pool.includes(candidate));
  return [
    ...pool.sort(
      (a, b) =>
        b.inclusionProbability! - a.inclusionProbability! || tieBreak(a, b),
    ),
    ...remaining.sort(
      (a, b) => a.paretoLevel - b.paretoLevel || tieBreak(a, b),
    ),
  ];
}

function hashSeed(seed: string) {
  let hash = 2166136261;
  for (const character of seed) {
    hash ^= character.charCodeAt(0);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function mulberry32(initial: number) {
  let state = initial;
  return () => {
    state += 0x6d2b79f5;
    let value = state;
    value = Math.imul(value ^ (value >>> 15), value | 1);
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
  };
}

function open01(rng: () => number) {
  return Math.min(1 - Number.EPSILON, Math.max(Number.MIN_VALUE, rng()));
}
