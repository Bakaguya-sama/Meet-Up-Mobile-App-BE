import { MeetupMembershipReader } from '../../../meetups/application/public/meetup-membership-reader';
import { RecommendationError } from '../../domain/recommendation.error';
import type { RecommendationRunStore } from '../ports/recommendation-run-store.port';
import { AiExplanationService } from '../services/ai-explanation.service';

export class GetAiExplanationsUseCase {
  constructor(
    private readonly runs: RecommendationRunStore,
    private readonly memberships: MeetupMembershipReader,
    private readonly explanations: AiExplanationService,
  ) {}

  async execute(actorId: string, meetupId: string, runId: string) {
    const participantId = await this.memberships.findAcceptedParticipantId(
      meetupId,
      actorId,
    );
    if (!participantId)
      throw new RecommendationError(
        'RECOMMENDATION_RUN_FORBIDDEN',
        'Recommendation run is unavailable to this actor',
      );
    const run = await this.runs.findById(
      meetupId.toLowerCase(),
      runId.toLowerCase(),
    );
    if (!run || run.status !== 'COMPLETED')
      throw new RecommendationError(
        'RECOMMENDATION_RUN_NOT_FOUND',
        'Completed recommendation run not found',
      );
    const items = await Promise.all(
      run.places
        .filter((place) => place.rank <= (run.effectiveK ?? 0))
        .sort((a, b) => a.rank - b.rank)
        .map(async (place) => ({
          rank: place.rank,
          canonicalCandidateKey: place.canonicalCandidateKey,
          explanation: await this.explanations.explain(run, place),
        })),
    );
    return { runId: run.id, items };
  }
}
