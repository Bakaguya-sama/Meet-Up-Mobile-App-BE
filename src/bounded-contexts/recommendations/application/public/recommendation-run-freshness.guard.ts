import type {
  RecommendationRunResult,
  RecommendationRunView,
} from '../../domain/recommendation-run';
import { LEGACY_TEMPORAL_PROVIDER_OPTIONS_VERSION } from '../../domain/recommendation-run';
import type { RecommendationContextStatus } from '../../domain/temporal-context';
import { RecommendationError } from '../../domain/recommendation.error';
import type { MeetupSchedulePort } from '../ports/meetup-schedule.port';
import type { RecommendationRunStore } from '../ports/recommendation-run-store.port';

/** Shared application guard for GET now and vote/finalize in Step 4. */
export class RecommendationRunFreshnessGuard {
  constructor(
    private readonly store: RecommendationRunStore,
    private readonly schedules: MeetupSchedulePort,
  ) {}

  async toView(run: RecommendationRunResult): Promise<RecommendationRunView> {
    return { ...run, contextStatus: await this.status(run) };
  }

  async status(
    run: Pick<
      RecommendationRunResult,
      'meetupId' | 'scheduledAtSnapshot' | 'providerRequestOptionsVersion'
    >,
  ): Promise<RecommendationContextStatus> {
    if (
      run.providerRequestOptionsVersion ===
      LEGACY_TEMPORAL_PROVIDER_OPTIONS_VERSION
    ) {
      return 'STALE_CONTEXT';
    }
    const current = await this.schedules.getScheduledAt(run.meetupId);
    return current.getTime() === run.scheduledAtSnapshot.getTime()
      ? 'CURRENT_CONTEXT'
      : 'STALE_CONTEXT';
  }

  async assertFreshForDecision(meetupId: string, runId: string) {
    const run = await this.store.findById(
      meetupId.toLowerCase(),
      runId.toLowerCase(),
    );
    if (!run) {
      throw new RecommendationError(
        'RECOMMENDATION_RUN_NOT_FOUND',
        'Recommendation run not found',
      );
    }
    if ((await this.status(run)) === 'STALE_CONTEXT') {
      throw new RecommendationError(
        'RECOMMENDATION_STALE_CONTEXT',
        'The meetup schedule changed; create a new recommendation run',
      );
    }
    return run;
  }
}
