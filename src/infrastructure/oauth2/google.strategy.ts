import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { Strategy, VerifyCallback } from 'passport-google-oauth20';

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

  async validate(
    accessToken: string,
    refreshToken: string,
    profile: any,
    done: VerifyCallback,
  ): Promise<any> {
    const { name, emails, photos } = profile;
    const user = {
      email: emails[0].value,
      displayName: name.givenName + ' ' + name.familyName,
      avatarUrl: photos[0].value,
    };
    done(null, user);
  }
}
