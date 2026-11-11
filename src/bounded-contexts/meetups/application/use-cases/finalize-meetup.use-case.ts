import type { RecommendationVotingReader } from '../../../recommendations/application/public/recommendation-voting-reader';
import type { MeetupVotingUnitOfWork } from '../ports/meetup-voting-unit-of-work.port';
import { VoteWinnerDomainService } from '../../domain/services/vote-winner.domain-service';
import { MeetupError } from '../../domain/errors/meetup.error';

export class FinalizeMeetupUseCase {
  constructor(
    private readonly voting: MeetupVotingUnitOfWork,
    private readonly recommendations: RecommendationVotingReader,
    private readonly winner: VoteWinnerDomainService,
  ) {}

  async execute(actorId: string, meetupId: string, runId: string, selectedPlaceId?: string) {
    meetupId = meetupId.toLowerCase();
    runId = runId.toLowerCase();
    const run = await this.recommendations.getDisplayedRun(meetupId, runId);
    if (!run) throw new MeetupError('RECOMMENDATION_STALE_CONTEXT', 'Displayed recommendation run not found');
    return this.voting.runLocked(meetupId, async (tx) => {
      const votes = await tx.listVotes(runId);
      const counts = new Map<string, number>();
      for (const vote of votes) counts.set(vote.recommendationPlaceId, (counts.get(vote.recommendationPlaceId) ?? 0) + 1);
      const candidates = run.candidates.map((candidate) => ({
        ...candidate,
        voteCount: counts.get(candidate.recommendationPlaceId) ?? 0,
      }));
      const chosen = selectedPlaceId
        ? candidates.find((candidate) => candidate.recommendationPlaceId === selectedPlaceId.toLowerCase())
        : this.winner.select(candidates);
      if (!chosen) throw new MeetupError('INVALID_INPUT', 'Select a displayed candidate or collect at least one vote');
      const now = new Date();
      tx.meetup.finalize(actorId.toLowerCase(), {
        runId, recommendationPlaceId: chosen.recommendationPlaceId,
        scheduledAtSnapshot: run.scheduledAtSnapshot,
      }, votes.map((vote) => vote.meetupParticipantId), now);
      return {
        meetupId, runId, recommendationPlaceId: chosen.recommendationPlaceId,
        canonicalCandidateKey: chosen.canonicalCandidateKey,
        chosenById: actorId.toLowerCase(), chosenAt: now.toISOString(),
        voteCount: chosen.voteCount,
      };
    });
  }
}
