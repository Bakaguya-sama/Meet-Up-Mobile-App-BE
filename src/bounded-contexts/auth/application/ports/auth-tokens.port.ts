export const AUTH_TOKENS = Symbol('AUTH_TOKENS');

export interface TokenClaims {
  sub: string;
  sid: string;
  type: 'access' | 'refresh';
  exp: number;
}

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
  verifyRefresh(token: string): Promise<TokenClaims>;
  hashRefresh(token: string): string;
}
