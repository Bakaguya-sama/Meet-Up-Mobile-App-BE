import type {
  MeetupChatAccessState,
  MeetupStorePort,
} from '../ports/persistence/meetup-store.port';

/** Public membership contract for other contexts; no persistence objects escape. */
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

  getChatAccess(
    meetupId: string,
    userId: string,
  ): Promise<MeetupChatAccessState | null> {
    return this.store.getChatAccess(
      meetupId.toLowerCase(),
      userId.toLowerCase(),
    );
  }

  listActiveChatRecipientIds(meetupId: string): Promise<string[]> {
    return this.store.listActiveChatRecipientIds(meetupId.toLowerCase());
  }
}
