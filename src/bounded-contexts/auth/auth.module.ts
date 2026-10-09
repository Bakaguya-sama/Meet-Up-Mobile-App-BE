import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { ThrottlerModule } from '@nestjs/throttler';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuthController } from './presentation/http/auth.controller';
import { AccessTokenGuard } from '../../presentation/http/guards/access-token.guard';
import { AccessTokenStrategy } from './infrastructure/adapters/access-token.strategy';
import { GoogleStrategy } from './infrastructure/adapters/google.strategy';
import { JwtTokens } from './infrastructure/adapters/jwt-auth-tokens.adapter';
import { AUTH_TOKENS } from './application/ports/auth-tokens.port';
import type { AuthTokens } from './application/ports/auth-tokens.port';
import { AUTH_UNIT_OF_WORK } from './application/ports/auth-unit-of-work.port';
import type { AuthUnitOfWork } from './application/ports/auth-unit-of-work.port';
import { PASSWORD_HASHER } from './application/ports/password-hasher.port';
import type { PasswordHasher } from './application/ports/password-hasher.port';
import { AuthenticateAccessUseCase } from './application/use-cases/authenticate-access.use-case';
import { LoginAccountUseCase } from './application/use-cases/login-account.use-case';
import { LoginWithGoogleUseCase } from './application/use-cases/login-with-google.use-case';
import { LogoutAccountUseCase } from './application/use-cases/logout-account.use-case';
import { RefreshTokenUseCase } from './application/use-cases/refresh-token.use-case';
import { RegisterAccountUseCase } from './application/use-cases/register-account.use-case';
import { UpdateProfileUseCase } from './application/use-cases/update-profile.use-case';
import { SaveUserPreferenceUseCase } from './application/use-cases/save-user-preference.use-case';
import { GetUserPreferenceUseCase } from './application/use-cases/get-user-preference.use-case';
import { GetActivityTagsUseCase } from './application/use-cases/get-activity-tags.use-case';
import { IssueSession } from './application/services/issue-session.service';
import { Argon2PasswordHasher } from './infrastructure/adapters/argon2-password-hasher';
import { authEntities } from './infrastructure/persistence/typeorm/entities/auth.entities';
import { TypeOrmAuthUnitOfWork } from './infrastructure/persistence/typeorm/typeorm-auth-unit-of-work';

@Module({
  imports: [
    TypeOrmModule.forFeature(authEntities),
    JwtModule.register({}),
    PassportModule.register({ defaultStrategy: 'jwt' }),
    ThrottlerModule.forRoot([{ ttl: 60000, limit: 10 }]),
  ],
  controllers: [AuthController],
  providers: [
    { provide: AUTH_UNIT_OF_WORK, useClass: TypeOrmAuthUnitOfWork },
    { provide: PASSWORD_HASHER, useClass: Argon2PasswordHasher },
    { provide: AUTH_TOKENS, useClass: JwtTokens },
    {
      provide: IssueSession,
      useFactory: (tokens: AuthTokens) => new IssueSession(tokens),
      inject: [AUTH_TOKENS],
    },
    {
      provide: RegisterAccountUseCase,
      useFactory: (
        uow: AuthUnitOfWork,
        passwords: PasswordHasher,
        tokens: AuthTokens,
        sessions: IssueSession,
      ) => new RegisterAccountUseCase(uow, passwords, tokens, sessions),
      inject: [AUTH_UNIT_OF_WORK, PASSWORD_HASHER, AUTH_TOKENS, IssueSession],
    },
    {
      provide: LoginAccountUseCase,
      useFactory: (
        uow: AuthUnitOfWork,
        passwords: PasswordHasher,
        sessions: IssueSession,
      ) => new LoginAccountUseCase(uow, passwords, sessions),
      inject: [AUTH_UNIT_OF_WORK, PASSWORD_HASHER, IssueSession],
    },
    {
      provide: LoginWithGoogleUseCase,
      useFactory: (
        uow: AuthUnitOfWork,
        tokens: AuthTokens,
        sessions: IssueSession,
      ) => new LoginWithGoogleUseCase(uow, tokens, sessions),
      inject: [AUTH_UNIT_OF_WORK, AUTH_TOKENS, IssueSession],
    },
    {
      provide: RefreshTokenUseCase,
      useFactory: (
        uow: AuthUnitOfWork,
        tokens: AuthTokens,
        sessions: IssueSession,
      ) => new RefreshTokenUseCase(uow, tokens, sessions),
      inject: [AUTH_UNIT_OF_WORK, AUTH_TOKENS, IssueSession],
    },
    {
      provide: LogoutAccountUseCase,
      useFactory: (uow: AuthUnitOfWork, tokens: AuthTokens) =>
        new LogoutAccountUseCase(uow, tokens),
      inject: [AUTH_UNIT_OF_WORK, AUTH_TOKENS],
    },
    {
      provide: AuthenticateAccessUseCase,
      useFactory: (uow: AuthUnitOfWork) => new AuthenticateAccessUseCase(uow),
      inject: [AUTH_UNIT_OF_WORK],
    },
    {
      provide: SaveUserPreferenceUseCase,
      useFactory: (uow: AuthUnitOfWork) => new SaveUserPreferenceUseCase(uow),
      inject: [AUTH_UNIT_OF_WORK],
    },
    {
      provide: GetUserPreferenceUseCase,
      useFactory: (uow: AuthUnitOfWork) => new GetUserPreferenceUseCase(uow),
      inject: [AUTH_UNIT_OF_WORK],
    },
    {
      provide: GetActivityTagsUseCase,
      useFactory: (uow: AuthUnitOfWork) => new GetActivityTagsUseCase(uow),
      inject: [AUTH_UNIT_OF_WORK],
    },
    {
      provide: UpdateProfileUseCase,
      useFactory: (uow: AuthUnitOfWork, savePrefs: SaveUserPreferenceUseCase) =>
        new UpdateProfileUseCase(uow, savePrefs),
      inject: [AUTH_UNIT_OF_WORK, SaveUserPreferenceUseCase],
    },
    AccessTokenStrategy,
    GoogleStrategy,
    AccessTokenGuard,
  ],
  exports: [
    AccessTokenGuard,
    AuthenticateAccessUseCase,
    PassportModule,
    UpdateProfileUseCase,
    SaveUserPreferenceUseCase,
    GetUserPreferenceUseCase,
    GetActivityTagsUseCase,
  ],
})
export class AuthModule {}
