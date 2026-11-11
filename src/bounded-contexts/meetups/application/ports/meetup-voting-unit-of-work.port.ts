import type { Meetup } from '../../domain/aggregates/meetup.aggregate';
import type { MeetupVoteState } from '../../domain/entities/meetup-vote.entity';
import type { OutboxPort } from '../../../../shared-kernel/application/outbox.port';

export type MeetupVotingTransaction = {
  meetup: Meetup;
  outbox: OutboxPort;
  findVote(meetupParticipantId: string): Promise<MeetupVoteState | null>;
  listVotes(runId: string): Promise<MeetupVoteState[]>;
  saveVote(vote: MeetupVoteState): Promise<void>;
};

export interface MeetupVotingUnitOfWork {
  runLocked<T>(meetupId: string, work: (tx: MeetupVotingTransaction) => Promise<T>): Promise<T>;
}

export const MEETUP_VOTING_UNIT_OF_WORK = Symbol('MEETUP_VOTING_UNIT_OF_WORK');
