import type { RecommendationRunStore } from '../ports/recommendation-run-store.port';
import { RecommendationError } from '../../domain/recommendation.error';
import { RecommendationRunFreshnessGuard } from '../public/recommendation-run-freshness.guard';
import { presentForViewer } from '../services/recommendation-result.presenter';
import { MeetupMembershipReader } from '../../../meetups/application/public/meetup-membership-reader';

export class GetRecommendationRunUseCase {
  constructor(
    private readonly store: RecommendationRunStore,
    private readonly freshness: RecommendationRunFreshnessGuard,
    private readonly memberships: MeetupMembershipReader,
  ) {}

  async execute(actorId: string, meetupId: string, runId: string) {
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
    const viewerParticipantId = await this.memberships.findAcceptedParticipantId(
      meetupId,
      actorId,
    );
    if (!viewerParticipantId) {
      throw new RecommendationError(
        'RECOMMENDATION_RUN_FORBIDDEN',
        'Recommendation run is unavailable to this actor',
      );
    }
    return presentForViewer(
      viewerParticipantId,
      run,
      await this.freshness.status(run),
    );
  }
}
