import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { createHash, randomUUID } from 'node:crypto';
import type { SessionTokenClaims } from '../../shared-kernel/application/token-claims';

const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function isTokenClaims(
  value: unknown,
  type: 'access' | 'refresh',
): value is SessionTokenClaims {
  if (!value || typeof value !== 'object') return false;
  const claims = value as Partial<SessionTokenClaims>;
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
export class JwtTokens {
  constructor(
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
  ) {}

  newId(): string {
    return randomUUID();
  }

  async issue(userId: string, sessionId: string) {
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
      tokenType: 'Bearer' as const,
      expiresIn,
      refreshExpiresIn,
    };
  }

  async verifyRefresh(token: string): Promise<SessionTokenClaims | null> {
    try {
      const claims: unknown = await this.jwt.verifyAsync(token, {
        secret: this.config.getOrThrow<string>('auth.refreshSecret'),
        algorithms: ['HS256'],
        issuer: this.config.getOrThrow<string>('auth.issuer'),
        audience: this.config.getOrThrow<string>('auth.audience'),
      });
      return isTokenClaims(claims, 'refresh') ? claims : null;
    } catch {
      return null;
    }
  }

  hashRefresh(token: string): string {
    return createHash('sha256').update(token).digest('hex');
  }
}
