import type {
  RecommendationRetentionPolicy,
  RecommendationSnapshotRetentionPort,
} from '../ports/recommendation-snapshot-retention.port';

/** The scheduled worker invokes this boundary; it receives no production policy by default. */
export class RunRecommendationSnapshotRetentionUseCase {
  constructor(
    private readonly retention: RecommendationSnapshotRetentionPort,
  ) {}

  execute(policy: RecommendationRetentionPolicy, dryRun: boolean) {
    return this.retention.execute(policy, dryRun);
  }
}
