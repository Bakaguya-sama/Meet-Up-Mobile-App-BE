import { randomUUID } from 'node:crypto';
import { MeetupInviteLinkError } from '../../domain/errors/meetup-invite-link.error';
import { MeetupInviteLinkToken } from '../../domain/aggregates/meetup-invite-link';
import type { MeetupInviteLinkStorePort } from '../ports/persistence/meetup-invite-link-store.port';

export class CreateMeetupInviteLinkUseCase {
  constructor(
    private readonly store: MeetupInviteLinkStorePort,
    private readonly publicAppBaseUrl: string,
  ) {}

  async execute(input: {
    meetupId: string;
    actorId: string;
    expiresAt: string;
    revokePrevious: boolean;
  }) {
    const expiresAt = new Date(input.expiresAt);
    if (!Number.isFinite(expiresAt.getTime())) {
      throw new MeetupInviteLinkError(
        'MEETUP_INVITE_LINK_INVALID_EXPIRY',
        'Invite link expiry must be a valid timestamp',
      );
    }
    const { rawToken, tokenHash } = MeetupInviteLinkToken.issue();
    const now = new Date();
    const link = await this.store.create({
      id: randomUUID(),
      meetupId: input.meetupId.toLowerCase(),
      actorId: input.actorId.toLowerCase(),
      tokenHash,
      expiresAt,
      revokePrevious: input.revokePrevious,
      now,
    });

    return {
      id: link.id,
      inviteUrl: `${this.publicAppBaseUrl.replace(/\/+$/, '')}/meetup-invites/${rawToken}`,
      expiresAt: link.expiresAt,
      revokedAt: link.revokedAt,
    };
  }
}
