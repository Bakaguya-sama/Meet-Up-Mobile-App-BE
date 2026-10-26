import { MeetupError } from '../../domain/errors/meetup.error';
import type { MeetupStorePort } from '../ports/persistence/meetup-store.port';

export interface MeetupCandidateSearchContext {
  meetupId: string;
  placeType: string;
  searchRadiusMeters: number;
  acceptedMemberUserIds: string[];
}

/** Public read API for candidate search. No persistence models leave Meetups. */
export class MeetupCandidateSearchReader {
  constructor(private readonly store: MeetupStorePort) {}

  async getCandidateSearchContext(
    actorId: string,
    meetupId: string,
  ): Promise<MeetupCandidateSearchContext> {
    const meetup = await this.store.findById(meetupId.toLowerCase());
    if (!meetup) {
      throw new MeetupError('MEETUP_NOT_FOUND', 'Meetup not found');
    }
    if (meetup.organizerId !== actorId.toLowerCase()) {
      throw new MeetupError(
        'MEETUP_FORBIDDEN',
        'Only the organizer can search for candidate places',
      );
    }
    if (!['inviting', 'choosing'].includes(meetup.status)) {
      throw new MeetupError(
        'MEETUP_INVALID_TRANSITION',
        'Candidate places are unavailable for a finalized or closed meetup',
      );
    }
    const acceptedMemberUserIds = meetup.participants
      .filter((participant) => participant.status === 'accepted')
      .map((participant) => participant.userId);
    if (acceptedMemberUserIds.length < 2) {
      throw new MeetupError(
        'MEETUP_INSUFFICIENT_PARTICIPANTS',
        'At least two accepted members are required to search for places',
      );
    }
    return {
      meetupId: meetup.id,
      placeType: meetup.placeType,
      searchRadiusMeters: meetup.searchRadiusM,
      acceptedMemberUserIds,
    };
  }
}
