export const MEETUP_INVITE_LINK_STORE = Symbol('MEETUP_INVITE_LINK_STORE');

export interface MeetupInviteLinkPreview {
  title: string;
  scheduledAt: Date;
  expiresAt: Date;
}

export interface MeetupInviteLinkRecord {
  id: string;
  meetupId: string;
  createdById: string;
  expiresAt: Date;
  revokedAt: Date | null;
  useCount: number;
  createdAt: Date;
}

export interface MeetupInviteLinkStorePort {
  create(input: {
    id: string;
    meetupId: string;
    actorId: string;
    tokenHash: string;
    expiresAt: Date;
    revokePrevious: boolean;
    now: Date;
  }): Promise<MeetupInviteLinkRecord>;
  findPreview(tokenHash: string, now: Date): Promise<MeetupInviteLinkPreview | null>;
  revoke(input: {
    meetupId: string;
    linkId: string;
    actorId: string;
    now: Date;
  }): Promise<void>;
  accept(input: {
    tokenHash: string;
    actorId: string;
    now: Date;
  }): Promise<{ meetupId: string; participantId: string; acceptedNow: boolean }>;
}
