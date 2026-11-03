import { MeetupInviteLinkToken } from '../../domain/aggregates/meetup-invite-link';
import type { MeetupInviteLinkStorePort } from '../ports/persistence/meetup-invite-link-store.port';
import { inviteLinkNotFound } from './preview-meetup-invite-link.use-case';

export class AcceptMeetupInviteLinkUseCase {
  constructor(private readonly store: MeetupInviteLinkStorePort) {}

  async execute(rawToken: string, actorId: string) {
    if (!MeetupInviteLinkToken.isWellFormed(rawToken)) {
      throw inviteLinkNotFound();
    }
    return this.store.accept({
      tokenHash: MeetupInviteLinkToken.hash(rawToken),
      actorId: actorId.toLowerCase(),
      now: new Date(),
    });
  }
}
