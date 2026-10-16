import type {
  Meetup,
  MeetupState,
} from '../../../domain/aggregates/meetup.aggregate';

export const MEETUP_STORE = Symbol('MEETUP_STORE');
export interface MeetupStorePort {
  /** Persist aggregate and pending integration deliveries atomically. */
  insert(meetup: Meetup): Promise<void>;
  /** Lock the aggregate root before loading participants; commit events with the mutation. */
  updateLocked(
    id: string,
    change: (meetup: Meetup) => void | Promise<void>,
  ): Promise<MeetupState>;
  findVisible(id: string, actorId: string): Promise<MeetupState | null>;
  findById(id: string): Promise<MeetupState | null>;
  listVisible(input: {
    actorId: string;
    offset: number;
    limit: number;
  }): Promise<{ items: Omit<MeetupState, 'participants'>[]; total: number }>;
  areAcceptedInActiveMeetup(
    meetupId: string,
    userIds: string[],
  ): Promise<boolean>;
}
