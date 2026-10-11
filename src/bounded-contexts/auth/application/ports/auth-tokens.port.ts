export const AUTH_TOKENS = Symbol('AUTH_TOKENS');

import type { SessionTokenClaims } from '../../../../shared-kernel/application/token-claims';

export type TokenClaims = SessionTokenClaims;

export interface TokenPair {
  accessToken: string;
  refreshToken: string;
  tokenType: 'Bearer';
  expiresIn: number;
  refreshExpiresIn: number;
}

export interface AuthTokens {
  newId(): string;
  issue(userId: string, sessionId: string): Promise<TokenPair>;
  verifyRefresh(token: string): Promise<TokenClaims | null>;
  hashRefresh(token: string): string;
}
