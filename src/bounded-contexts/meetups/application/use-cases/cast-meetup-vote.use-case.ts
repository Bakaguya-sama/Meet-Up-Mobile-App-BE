import { randomUUID } from 'node:crypto';
import type { RecommendationVotingReader } from '../../../recommendations/application/public/recommendation-voting-reader';
import type { MeetupVotingUnitOfWork } from '../ports/meetup-voting-unit-of-work.port';
import { MeetupError } from '../../domain/errors/meetup.error';

export class CastMeetupVoteUseCase {
  constructor(
    private readonly voting: MeetupVotingUnitOfWork,
    private readonly recommendations: RecommendationVotingReader,
  ) {}

  async execute(
    actorId: string,
    meetupId: string,
    runId: string,
    recommendationPlaceId: string,
  ) {
    meetupId = meetupId.toLowerCase();
    runId = runId.toLowerCase();
    recommendationPlaceId = recommendationPlaceId.toLowerCase();
    const run = await this.recommendations.getDisplayedRun(meetupId, runId);
    if (!run)
      throw new MeetupError(
        'RECOMMENDATION_STALE_CONTEXT',
        'Displayed recommendation run not found',
      );
    if (run.isStale)
      throw new MeetupError(
        'RECOMMENDATION_STALE_CONTEXT',
        'Recommendation run is stale; request a new run',
      );
    const candidate = run.candidates.find(
      (item) => item.recommendationPlaceId === recommendationPlaceId,
    );
    if (!candidate)
      throw new MeetupError(
        'INVALID_INPUT',
        'Vote must target a displayed recommendation candidate',
      );

    return this.voting.runLocked(meetupId, async (tx) => {
      const now = new Date();
      const participantId = tx.meetup.assertCanVote(
        actorId.toLowerCase(),
        run.scheduledAtSnapshot,
        now,
      );
      const previous = await tx.findVote(participantId);
      if (
        previous?.runId === runId &&
        previous.recommendationPlaceId === recommendationPlaceId
      ) {
        const votes = await tx.listVotes(runId);
        return {
          meetupId,
          runId,
          recommendationPlaceId,
          canonicalCandidateKey: candidate.canonicalCandidateKey,
          voteCount: votes.filter(
            (vote) => vote.recommendationPlaceId === recommendationPlaceId,
          ).length,
          changed: false,
        };
      }

      const vote = {
        id: previous?.id ?? randomUUID(),
        meetupId,
        runId,
        recommendationPlaceId,
        meetupParticipantId: participantId,
        createdAt: previous?.createdAt ?? now,
        updatedAt: now,
      };
      await tx.saveVote(vote);
      const votes = await tx.listVotes(runId);
      const recipients = tx.meetup
        .snapshot()
        .participants.filter((p) => p.status === 'accepted')
        .map((p) => p.userId);
      if (previous) {
        const oldVotes =
          previous.runId === runId ? votes : await tx.listVotes(previous.runId);
        const oldCount = oldVotes.filter(
          (item) =>
            item.recommendationPlaceId === previous.recommendationPlaceId,
        ).length;
        await tx.outbox.add(
          {
            eventId: randomUUID(),
            eventName: 'VoteUpdated.v1',
            occurredAt: now.toISOString(),
            meetupId,
            runId: previous.runId,
            placeId: previous.recommendationPlaceId,
            voteCount: oldCount,
          },
          { destination: 'realtime', recipientIds: recipients },
        );
      }
      const voteCount = votes.filter(
        (item) => item.recommendationPlaceId === recommendationPlaceId,
      ).length;
      await tx.outbox.add(
        {
          eventId: randomUUID(),
          eventName: 'VoteUpdated.v1',
          occurredAt: now.toISOString(),
          meetupId,
          runId,
          placeId: recommendationPlaceId,
          voteCount,
        },
        { destination: 'realtime', recipientIds: recipients },
      );
      return {
        meetupId,
        runId,
        recommendationPlaceId,
        canonicalCandidateKey: candidate.canonicalCandidateKey,
        voteCount,
        changed: true,
      };
    });
  }
}
