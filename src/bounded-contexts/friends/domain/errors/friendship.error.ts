import { DomainError } from '../../../../shared-kernel/domain/domain-error';

export type FriendshipErrorCode =
  | 'SELF_FRIENDSHIP'
  | 'FRIENDSHIP_ALREADY_EXISTS'
  | 'FRIENDSHIP_NOT_PENDING'
  | 'FRIENDSHIP_NOT_FOUND'
  | 'FRIENDSHIP_RESPONSE_FORBIDDEN'
  | 'FRIEND_USER_NOT_FOUND';

export class FriendshipError extends DomainError {
  constructor(code: FriendshipErrorCode, message: string) {
    super(code, message);
  }
}
