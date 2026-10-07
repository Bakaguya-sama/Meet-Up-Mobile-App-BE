import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { AuthenticateAccessUseCase } from '../../bounded-contexts/auth/application/use-cases/auth.use-cases';
import { isTokenClaims } from './jwt-tokens';

@Injectable()
export class AccessTokenStrategy extends PassportStrategy(Strategy, 'jwt') {
  constructor(
    config: ConfigService,
    private readonly authenticateAccess: AuthenticateAccessUseCase,
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

  validate(payload: unknown) {
    if (!isTokenClaims(payload, 'access'))
      throw new UnauthorizedException('Invalid access token');
    return this.authenticateAccess.execute(payload);
  }
}
