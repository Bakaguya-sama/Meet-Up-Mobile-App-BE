import { DomainError } from '../../../../shared-kernel/domain/domain-error';

export type AuthErrorCode =
  | 'INVALID_CREDENTIALS'
  | 'INVALID_TOKEN'
  | 'ACCOUNT_LOCKED'
  | 'EMAIL_ALREADY_EXISTS'
  | 'ACCOUNT_NOT_FOUND'
  | 'INVALID_INPUT'
  | 'INVALID_PREFERENCE_LEVEL'
  | 'ACTIVITY_TAG_NOT_FOUND';

export class AuthError extends DomainError {
  constructor(code: AuthErrorCode, message: string) {
    super(code, message);
  }
}
