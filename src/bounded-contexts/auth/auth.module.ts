import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { ThrottlerModule } from '@nestjs/throttler';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuthController } from '../../presentation/http/controllers/auth/auth.controller';
import { AccessTokenGuard } from '../../presentation/http/guards/access-token.guard';
import { AccessTokenStrategy } from '../../infrastructure/jwt/access-token.strategy';
import { GoogleStrategy } from '../../infrastructure/oauth2/google.strategy';
import { JwtTokens } from '../../infrastructure/jwt/jwt-tokens';
import {
  AUTH_TOKENS,
  AUTH_UNIT_OF_WORK,
  PASSWORD_HASHER,
} from './application/ports/auth.ports';
import type {
  AuthTokens,
  AuthUnitOfWork,
  PasswordHasher,
} from './application/ports/auth.ports';
import {
  AuthenticateAccessUseCase,
  IssueSession,
  LoginUseCase,
  GoogleLoginUseCase,
  LogoutUseCase,
  RefreshTokenUseCase,
  RegisterUseCase,
} from './application/use-cases/auth.use-cases';
import { Argon2PasswordHasher } from './infrastructure/adapters/argon2-password-hasher';
import { authEntities } from './infrastructure/persistence/auth.typeorm-entity';
import { TypeOrmAuthUnitOfWork } from './infrastructure/persistence/typeorm-auth-unit-of-work';

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
      provide: RegisterUseCase,
      useFactory: (
        uow: AuthUnitOfWork,
        passwords: PasswordHasher,
        tokens: AuthTokens,
        sessions: IssueSession,
      ) => new RegisterUseCase(uow, passwords, tokens, sessions),
      inject: [AUTH_UNIT_OF_WORK, PASSWORD_HASHER, AUTH_TOKENS, IssueSession],
    },
    {
      provide: LoginUseCase,
      useFactory: (
        uow: AuthUnitOfWork,
        passwords: PasswordHasher,
        sessions: IssueSession,
      ) => new LoginUseCase(uow, passwords, sessions),
      inject: [AUTH_UNIT_OF_WORK, PASSWORD_HASHER, IssueSession],
    },
    {
      provide: GoogleLoginUseCase,
      useFactory: (
        uow: AuthUnitOfWork,
        tokens: AuthTokens,
        sessions: IssueSession,
      ) => new GoogleLoginUseCase(uow, tokens, sessions),
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
      provide: LogoutUseCase,
      useFactory: (uow: AuthUnitOfWork, tokens: AuthTokens) =>
        new LogoutUseCase(uow, tokens),
      inject: [AUTH_UNIT_OF_WORK, AUTH_TOKENS],
    },
    {
      provide: AuthenticateAccessUseCase,
      useFactory: (uow: AuthUnitOfWork) => new AuthenticateAccessUseCase(uow),
      inject: [AUTH_UNIT_OF_WORK],
    },
    AccessTokenStrategy,
    GoogleStrategy,
    AccessTokenGuard,
  ],
  exports: [AccessTokenGuard, AuthenticateAccessUseCase, PassportModule],
})
export class AuthModule {}
