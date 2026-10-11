import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { Strategy, VerifyCallback } from 'passport-google-oauth20';
import type { Profile } from 'passport-google-oauth20';

@Injectable()
export class GoogleStrategy extends PassportStrategy(Strategy, 'google') {
  constructor(config: ConfigService) {
    super({
      clientID: config.getOrThrow<string>('auth.google.clientID'),
      clientSecret: config.getOrThrow<string>('auth.google.clientSecret'),
      callbackURL: config.getOrThrow<string>('auth.google.callbackURL'),
      scope: ['email', 'profile'],
    });
  }

  validate(
    _accessToken: string,
    _refreshToken: string,
    profile: Profile,
    done: VerifyCallback,
  ): void {
    const email = profile.emails?.[0]?.value;
    if (!email) {
      done(new UnauthorizedException('Google account has no email'));
      return;
    }
    const displayName =
      [profile.name?.givenName, profile.name?.familyName]
        .filter(Boolean)
        .join(' ') ||
      profile.displayName ||
      email;
    done(null, {
      email,
      displayName,
      avatarUrl: profile.photos?.[0]?.value,
    });
  }
}
