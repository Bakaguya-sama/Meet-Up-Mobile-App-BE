import { Injectable } from '@nestjs/common';
import { DataSource, EntityManager } from 'typeorm';
import type {
  RecommendationRetentionPolicy,
  RecommendationSnapshotRetentionPort,
  RetentionResult,
} from '../../../application/ports/recommendation-snapshot-retention.port';

@Injectable()
export class TypeOrmRecommendationSnapshotRetention implements RecommendationSnapshotRetentionPort {
  constructor(private readonly dataSource: DataSource) {}

  async execute(
    policy: RecommendationRetentionPolicy,
    dryRun: boolean,
  ): Promise<RetentionResult> {
    if (
      !policy.version ||
      policy.batchSize < 1 ||
      !Number.isFinite(policy.batchSize)
    )
      throw new Error('A versioned finite retention policy is required');
    if (!dryRun && !policy.enabled)
      throw new Error(
        'Recommendation retention is disabled until an approved policy enables it',
      );
    return this.dataSource.transaction((manager) =>
      this.process(manager, policy, dryRun),
    );
  }

  private async process(
    manager: EntityManager,
    policy: RecommendationRetentionPolicy,
    dryRun: boolean,
  ): Promise<RetentionResult> {
    const rows = await manager.query<
      Array<{ id: string; created_at: Date; protected: boolean }>
    >(
      `SELECT run.id, run.created_at,
        EXISTS (SELECT 1 FROM recommendation_run_holds hold WHERE hold.run_id = run.id) AS protected
       FROM recommendation_runs run
       WHERE (run.status = 'FAILED' AND run.completed_at < $1)
          OR (run.status = 'COMPLETED'
            AND NOT (
              EXISTS (SELECT 1 FROM votes vote WHERE vote.run_id = run.id)
              OR EXISTS (SELECT 1 FROM meetup_sessions meetup WHERE meetup.chosen_run_id = run.id)
              OR EXISTS (SELECT 1 FROM recommendation_impressions impression WHERE impression.run_id = run.id)
              OR EXISTS (SELECT 1 FROM recommendation_feedback_events feedback WHERE feedback.run_id = run.id)
            ) AND run.completed_at < $2)
          OR (run.status = 'COMPLETED'
            AND (
              EXISTS (SELECT 1 FROM votes vote WHERE vote.run_id = run.id)
              OR EXISTS (SELECT 1 FROM meetup_sessions meetup WHERE meetup.chosen_run_id = run.id)
              OR EXISTS (SELECT 1 FROM recommendation_impressions impression WHERE impression.run_id = run.id)
              OR EXISTS (SELECT 1 FROM recommendation_feedback_events feedback WHERE feedback.run_id = run.id)
            ) AND run.completed_at < $3)
       ORDER BY run.created_at ASC, run.id ASC
       LIMIT $4 FOR UPDATE SKIP LOCKED`,
      [
        policy.failedBefore,
        policy.unusedCompletedBefore,
        policy.engagedBefore,
        policy.batchSize,
      ],
    );
    const eligible = rows.filter((row) => !row.protected);
    if (!dryRun && eligible.length)
      await manager.query(
        'DELETE FROM recommendation_runs WHERE id = ANY($1::uuid[])',
        [eligible.map((row) => row.id)],
      );
    const oldest = eligible[0]?.created_at;
    return {
      policyVersion: policy.version,
      scanned: rows.length,
      eligible: eligible.length,
      deleted: dryRun ? 0 : eligible.length,
      protected: rows.length - eligible.length,
      failed: 0,
      dryRun,
      oldestEligibleAgeMs: oldest
        ? Math.max(0, Date.now() - new Date(oldest).getTime())
        : null,
    };
  }
}
