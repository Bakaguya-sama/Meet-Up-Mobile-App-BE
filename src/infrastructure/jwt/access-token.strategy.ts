import { Inject, Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import {
  ACCESS_TOKEN_VALIDATOR,
  type AccessTokenValidator,
} from '../../shared-kernel/application/access-token-validator.port';
import type { AccessTokenClaims } from '../../shared-kernel/application/token-claims';
import { isTokenClaims } from './jwt-tokens.service';

@Injectable()
export class AccessTokenStrategy extends PassportStrategy(Strategy, 'jwt') {
  constructor(
    config: ConfigService,
    @Inject(ACCESS_TOKEN_VALIDATOR)
    private readonly accessTokenValidator: AccessTokenValidator,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      secretOrKey: config.getOrThrow<string>('auth.accessSecret'),
      algorithms: ['HS256'],
      issuer: config.getOrThrow<string>('auth.issuer'),
      audience: config.getOrThrow<string>('auth.audience'),
      ignoreExpiration: false,
    });
  }

  async validate(payload: unknown) {
    if (!isTokenClaims(payload, 'access')) {
      throw new UnauthorizedException('Invalid access token');
    }
    return this.accessTokenValidator.execute(payload as AccessTokenClaims);
  }
}
