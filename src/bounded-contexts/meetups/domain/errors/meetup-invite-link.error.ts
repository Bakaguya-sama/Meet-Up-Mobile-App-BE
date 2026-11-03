import { DomainError } from '../../../../shared-kernel/domain/domain-error';

export type MeetupInviteLinkErrorCode =
  | 'MEETUP_INVITE_LINK_NOT_FOUND'
  | 'MEETUP_INVITE_LINK_FORBIDDEN'
  | 'MEETUP_INVITE_LINK_INVALID_EXPIRY'
  | 'MEETUP_INVITE_RATE_LIMITED';

export class MeetupInviteLinkError extends DomainError {
  constructor(code: MeetupInviteLinkErrorCode, message: string) {
    super(code, message);
  }
}
