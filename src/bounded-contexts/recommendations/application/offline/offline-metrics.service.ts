import type { OfflineDatasetRow } from './offline-evaluation.types';

export interface RankingMetricSummary {
  hitRate: number | null;
  ndcg: number | null;
  evaluableRunCount: number;
  excludedRunCount: number;
  coverage: number | null;
}

/** Metrics are calculated per (run, participant), exclusively from actual impressions. */
export function rankingMetrics(rows: readonly OfflineDatasetRow[], k: number): RankingMetricSummary {
  const groups = new Map<string, OfflineDatasetRow[]>();
  for (const row of rows.filter((row) => row.shown && row.label !== null)) {
    const key = `${row.runId}:${row.participantPseudonym}`;
    groups.set(key, [...(groups.get(key) ?? []), row]);
  }
  let hits = 0; let hitDenominator = 0; let ndcgTotal = 0; let ndcgDenominator = 0;
  for (const group of groups.values()) {
    const ranked = [...group].sort((a, b) => a.impressionRank - b.impressionRank || a.canonicalCandidateKey.localeCompare(b.canonicalCandidateKey));
    const ideal = [...ranked].sort((a, b) => (b.label ?? 0) - (a.label ?? 0));
    const dcg = discountedGain(ranked.slice(0, k));
    const idcg = discountedGain(ideal.slice(0, k));
    if (idcg > 0) { ndcgTotal += dcg / idcg; ndcgDenominator += 1; }
    if (ranked.some((row) => (row.label ?? 0) > 0)) { hitDenominator += 1; if (ranked.slice(0, k).some((row) => (row.label ?? 0) > 0)) hits += 1; }
  }
  const total = groups.size;
  return {
    hitRate: hitDenominator ? hits / hitDenominator : null,
    ndcg: ndcgDenominator ? ndcgTotal / ndcgDenominator : null,
    evaluableRunCount: ndcgDenominator,
    excludedRunCount: total - ndcgDenominator,
    coverage: total ? ndcgDenominator / total : null,
  };
}

function discountedGain(rows: readonly OfflineDatasetRow[]) {
  return rows.reduce((total, row, index) => total + (2 ** (row.label ?? 0) - 1) / Math.log2(index + 2), 0);
}
