export const SYNTHETIC_OFFLINE_RUN_COUNT = 120;
export const SYNTHETIC_CANDIDATES_PER_RUN = 6;
export const SYNTHETIC_SHOWN_PER_MEMBER = 5;

export interface SyntheticOfflineRunCase {
  runIndex: number;
  requestedAt: Date;
  groupSize: 2 | 3 | 5;
  categories: readonly string[];
  algorithmVersion: string;
  configVersion: string;
}

/** Stable UUIDs make fixture rows, manifests, and diagnostics reproducible. */
export function stableUuid(namespace: number, value: number): string {
  if (namespace < 0 || namespace >= 1_000 || value < 0 || value >= 1_000_000_000) {
    throw new Error('Synthetic UUID namespace/value is outside the deterministic fixture range');
  }
  return `00000000-0000-4000-8000-${namespace.toString().padStart(3, '0')}${value.toString().padStart(9, '0')}`;
}

export function buildSyntheticOfflineMatrix(): SyntheticOfflineRunCase[] {
  const categories = ['cafe', 'restaurant', 'park', 'bar', 'movie_theater'];
  return Array.from({ length: SYNTHETIC_OFFLINE_RUN_COUNT }, (_, runIndex) => {
    const bucket = runIndex < 60 ? 0 : runIndex < 90 ? 1 : 2;
    const requestedAt = new Date(Date.UTC(2026, bucket, 1 + (runIndex % 28), 10, 0, 0));
    return {
      runIndex,
      requestedAt,
      groupSize: ([2, 3, 5] as const)[runIndex % 3],
      categories: Array.from({ length: SYNTHETIC_CANDIDATES_PER_RUN }, (_, candidateIndex) => categories[(runIndex + candidateIndex) % categories.length]),
      algorithmVersion: bucket === 2 ? 'recommendation-engine-v2' : 'recommendation-engine-v1',
      configVersion: ['recommendation-config-synthetic-a', 'recommendation-config-synthetic-b', 'recommendation-config-synthetic-c'][runIndex % 3],
    };
  });
}
