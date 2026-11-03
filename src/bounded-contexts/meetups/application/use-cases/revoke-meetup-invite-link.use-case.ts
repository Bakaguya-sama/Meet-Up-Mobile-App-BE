import type { MeetupInviteLinkStorePort } from '../ports/persistence/meetup-invite-link-store.port';

export class RevokeMeetupInviteLinkUseCase {
  constructor(private readonly store: MeetupInviteLinkStorePort) {}

  execute(input: { meetupId: string; linkId: string; actorId: string }) {
    return this.store.revoke({
      meetupId: input.meetupId.toLowerCase(),
      linkId: input.linkId.toLowerCase(),
      actorId: input.actorId.toLowerCase(),
      now: new Date(),
    });
  }
}
