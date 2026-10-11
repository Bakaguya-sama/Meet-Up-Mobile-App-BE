export interface SessionTokenClaims {
  sub: string;
  sid: string;
  type: 'access' | 'refresh';
  exp: number;
}

export interface AccessTokenClaims extends SessionTokenClaims {
  type: 'access';
}
