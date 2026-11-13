import {
  Injectable,
  Logger,
  OnApplicationBootstrap,
  OnApplicationShutdown,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  APPROVED_RECOMMENDATION_RETENTION_POLICY,
  retentionPolicyAt,
} from '../../application/recommendation-retention-policy';
import { RecommendationObservabilityService } from '../../application/services/recommendation-observability.service';
import { RunRecommendationSnapshotRetentionUseCase } from '../../application/use-cases/run-recommendation-snapshot-retention.use-case';

/** Runs one bounded retention batch at 03:30 Asia/Ho_Chi_Minh when explicitly enabled. */
@Injectable()
export class RecommendationSnapshotRetentionJob
  implements OnApplicationBootstrap, OnApplicationShutdown
{
  private readonly logger = new Logger(RecommendationSnapshotRetentionJob.name);
  private timer?: NodeJS.Timeout;

  constructor(
    private readonly config: ConfigService,
    private readonly retention: RunRecommendationSnapshotRetentionUseCase,
    private readonly observability: RecommendationObservabilityService,
  ) {}

  onApplicationBootstrap(): void {
    if (this.config.get<string>('app.nodeEnv') === 'test') return;
    this.scheduleNext();
  }

  onApplicationShutdown(): void {
    if (this.timer) clearTimeout(this.timer);
  }

  async runOnce(now = new Date()): Promise<void> {
    const enabled =
      this.config.get<boolean>('recommendationRetention.enabled') === true;
    // A disabled worker never deletes. An operator can still call the use case
    // with dryRun=true for a one-off preview, but production scheduling has no
    // mandatory staging observation period after Q13's revised approval.
    const dryRun = !enabled;
    const started = Date.now();
    for (
      let attempt = 1;
      attempt <= APPROVED_RECOMMENDATION_RETENTION_POLICY.maxRetries;
      attempt += 1
    ) {
      try {
        const result = await this.retention.execute(
          retentionPolicyAt(now, enabled),
          dryRun,
        );
        this.observability.recordRetention(result, Date.now() - started);
        this.logger.log(
          JSON.stringify({
            event: 'recommendation_retention_completed',
            policyVersion: result.policyVersion,
            dryRun,
            scanned: result.scanned,
            deleted: result.deleted,
            protected: result.protected,
          }),
        );
        return;
      } catch (error) {
        if (attempt === APPROVED_RECOMMENDATION_RETENTION_POLICY.maxRetries)
          throw error;
        await new Promise<void>((resolve) =>
          setTimeout(resolve, 1000 * 2 ** (attempt - 1)),
        );
      }
    }
  }

  private scheduleNext(): void {
    const delay = msUntilNextHoChiMinh0330(new Date());
    this.timer = setTimeout(() => {
      void this.runOnce()
        .catch(() => this.logger.error('recommendation_retention_failed'))
        .finally(() => this.scheduleNext());
    }, delay);
  }
}

function msUntilNextHoChiMinh0330(now: Date): number {
  const local = new Date(now.getTime() + 7 * 60 * 60 * 1000);
  const target =
    Date.UTC(
      local.getUTCFullYear(),
      local.getUTCMonth(),
      local.getUTCDate(),
      3,
      30,
    ) -
    7 * 60 * 60 * 1000;
  return (
    (target > now.getTime() ? target : target + 24 * 60 * 60 * 1000) -
    now.getTime()
  );
}
