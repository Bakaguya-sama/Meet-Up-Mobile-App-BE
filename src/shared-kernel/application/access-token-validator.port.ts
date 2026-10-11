import type { AccessTokenClaims } from './token-claims';
import type { AuthenticatedUser } from './authenticated-user';

export const ACCESS_TOKEN_VALIDATOR = Symbol('ACCESS_TOKEN_VALIDATOR');

/**
 * Context-owned authorization check invoked after a JWT has been verified.
 */
export interface AccessTokenValidator {
  execute(claims: AccessTokenClaims): Promise<AuthenticatedUser>;
}
