export interface RecommendationRetentionPolicy {
  version: string;
  failedBefore: Date;
  unusedCompletedBefore: Date;
  engagedBefore: Date;
  batchSize: number;
  enabled: boolean;
}

export interface RetentionResult {
  policyVersion: string;
  scanned: number;
  eligible: number;
  deleted: number;
  protected: number;
  failed: number;
  dryRun: boolean;
  oldestEligibleAgeMs: number | null;
}

export interface RecommendationSnapshotRetentionPort {
  execute(
    policy: RecommendationRetentionPolicy,
    dryRun: boolean,
  ): Promise<RetentionResult>;
}

export const RECOMMENDATION_SNAPSHOT_RETENTION = Symbol(
  'RECOMMENDATION_SNAPSHOT_RETENTION',
);
