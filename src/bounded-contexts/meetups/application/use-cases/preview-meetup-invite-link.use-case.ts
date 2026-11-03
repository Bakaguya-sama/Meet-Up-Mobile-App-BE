import { MeetupInviteLinkToken } from '../../domain/aggregates/meetup-invite-link';
import { MeetupInviteLinkError } from '../../domain/errors/meetup-invite-link.error';
import type { MeetupInviteLinkStorePort } from '../ports/persistence/meetup-invite-link-store.port';

export class PreviewMeetupInviteLinkUseCase {
  constructor(private readonly store: MeetupInviteLinkStorePort) {}

  async execute(rawToken: string) {
    if (!MeetupInviteLinkToken.isWellFormed(rawToken)) {
      throw inviteLinkNotFound();
    }
    const preview = await this.store.findPreview(
      MeetupInviteLinkToken.hash(rawToken),
      new Date(),
    );
    if (!preview) throw inviteLinkNotFound();
    return preview;
  }
}

export function inviteLinkNotFound(): MeetupInviteLinkError {
  return new MeetupInviteLinkError(
    'MEETUP_INVITE_LINK_NOT_FOUND',
    'Invite link is unavailable',
  );
}
