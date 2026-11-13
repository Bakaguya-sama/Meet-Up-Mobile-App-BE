import type { RecommendationRetentionPolicy } from './ports/recommendation-snapshot-retention.port';

export const APPROVED_RECOMMENDATION_RETENTION_POLICY = {
  version: 'recommendation-retention-q13-v1',
  approvedBy: ['Product Owner', 'Security/Privacy'],
  failedDays: 7,
  unusedCompletedDays: 30,
  engagedDays: 180,
  protectedReasons: ['replay', 'evaluation', 'export', 'legal_hold'] as const,
  schedule: '03:30 Asia/Ho_Chi_Minh',
  batchSize: 100,
  maxRetries: 3,
} as const;

export function retentionPolicyAt(
  now: Date,
  enabled: boolean,
): RecommendationRetentionPolicy {
  return {
    version: APPROVED_RECOMMENDATION_RETENTION_POLICY.version,
    failedBefore: subtractDays(
      now,
      APPROVED_RECOMMENDATION_RETENTION_POLICY.failedDays,
    ),
    unusedCompletedBefore: subtractDays(
      now,
      APPROVED_RECOMMENDATION_RETENTION_POLICY.unusedCompletedDays,
    ),
    engagedBefore: subtractDays(
      now,
      APPROVED_RECOMMENDATION_RETENTION_POLICY.engagedDays,
    ),
    batchSize: APPROVED_RECOMMENDATION_RETENTION_POLICY.batchSize,
    enabled,
  };
}

function subtractDays(now: Date, days: number): Date {
  return new Date(now.getTime() - days * 24 * 60 * 60 * 1000);
}
