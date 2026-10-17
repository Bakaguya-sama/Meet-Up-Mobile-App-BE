import { DomainError } from '../../../../shared-kernel/domain/domain-error';

export type MeetupErrorCode =
  | 'INVALID_INPUT'
  | 'MEETUP_NOT_FOUND'
  | 'MEETUP_FORBIDDEN'
  | 'MEETUP_NOT_EDITABLE'
  | 'MEETUP_INVALID_TRANSITION'
  | 'MEETUP_INVITATION_EXPIRED'
  | 'MEETUP_MEMBER_CONFLICT'
  | 'MEETUP_INVITEE_UNAVAILABLE';

export class MeetupError extends DomainError {
  constructor(code: MeetupErrorCode, message: string) {
    super(code, message);
  }
}
