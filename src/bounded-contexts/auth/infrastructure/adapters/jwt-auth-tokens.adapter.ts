import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { createHash, randomUUID } from 'node:crypto';
import type {
  AuthTokens,
  TokenClaims,
  TokenPair,
} from '../../application/ports/auth-tokens.port';
import { AuthError } from '../../domain/errors/auth.error';

const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function isTokenClaims(
  value: unknown,
  type: 'access' | 'refresh',
): value is TokenClaims {
  if (!value || typeof value !== 'object') return false;
  const claims = value as Partial<TokenClaims>;
  return (
    claims.type === type &&
    typeof claims.sub === 'string' &&
    uuid.test(claims.sub) &&
    typeof claims.sid === 'string' &&
    uuid.test(claims.sid) &&
    typeof claims.exp === 'number' &&
    Number.isFinite(claims.exp) &&
    claims.exp > Date.now() / 1000
  );
}

@Injectable()
export class JwtTokens implements AuthTokens {
  constructor(
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
  ) {}

  newId(): string {
    return randomUUID();
  }

  async issue(userId: string, sessionId: string): Promise<TokenPair> {
    const expiresIn = this.config.getOrThrow<number>('auth.accessTtlSeconds');
    const refreshExpiresIn = this.config.getOrThrow<number>(
      'auth.refreshTtlSeconds',
    );
    const common = {
      algorithm: 'HS256' as const,
      issuer: this.config.getOrThrow<string>('auth.issuer'),
      audience: this.config.getOrThrow<string>('auth.audience'),
    };
    const [accessToken, refreshToken] = await Promise.all([
      this.jwt.signAsync(
        { sub: userId, sid: sessionId, type: 'access' },
        {
          ...common,
          secret: this.config.getOrThrow<string>('auth.accessSecret'),
          expiresIn,
        },
      ),
      this.jwt.signAsync(
        { sub: userId, sid: sessionId, type: 'refresh' },
        {
          ...common,
          secret: this.config.getOrThrow<string>('auth.refreshSecret'),
          expiresIn: refreshExpiresIn,
        },
      ),
    ]);
    return {
      accessToken,
      refreshToken,
      tokenType: 'Bearer',
      expiresIn,
      refreshExpiresIn,
    };
  }

  async verifyRefresh(token: string): Promise<TokenClaims> {
    try {
      const claims: unknown = await this.jwt.verifyAsync(token, {
        secret: this.config.getOrThrow<string>('auth.refreshSecret'),
        algorithms: ['HS256'],
        issuer: this.config.getOrThrow<string>('auth.issuer'),
        audience: this.config.getOrThrow<string>('auth.audience'),
      });
      if (!isTokenClaims(claims, 'refresh')) throw new Error('Invalid claims');
      return claims;
    } catch {
      throw new AuthError('INVALID_TOKEN', 'Invalid or expired refresh token');
    }
  }

  hashRefresh(token: string): string {
    return createHash('sha256').update(token).digest('hex');
  }
}
