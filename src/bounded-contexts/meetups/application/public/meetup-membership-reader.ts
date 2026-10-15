import type { MeetupStorePort } from '../ports/persistence/meetup-store.port';

/** Public membership contract for Locations; no participant or persistence objects escape. */
export class MeetupMembershipReader {
  constructor(private readonly store: MeetupStorePort) {}
  areAcceptedInActiveMeetup(
    meetupId: string,
    userIds: string[],
  ): Promise<boolean> {
    if (!userIds.length) return Promise.resolve(false);
    return this.store.areAcceptedInActiveMeetup(meetupId.toLowerCase(), [
      ...new Set(userIds.map((id) => id.toLowerCase())),
    ]);
  }
}
