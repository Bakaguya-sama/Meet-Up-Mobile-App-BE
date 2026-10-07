import { AuthError } from '../../domain/auth.error';
import { UserAccount } from '../../domain/user-account';
import { UserSession } from '../../domain/user-session';
import type {
  AuthStore,
  AuthTokens,
  AuthUnitOfWork,
  PasswordHasher,
  TokenClaims,
  TokenPair,
} from '../ports/auth.ports';

export interface LoginInput {
  email: string;
  password: string;
  deviceName?: string;
}

export interface RegisterInput extends LoginInput {
  displayName: string;
}

export interface AuthOutput extends TokenPair {
  user: ReturnType<UserAccount['publicProfile']>;
}

export class IssueSession {
  constructor(private readonly tokens: AuthTokens) {}

  async execute(
    store: AuthStore,
    account: UserAccount,
    deviceName?: string,
    parent?: UserSession,
  ): Promise<AuthOutput> {
    account.assertCanAuthenticate();
    const now = new Date();
    const id = this.tokens.newId();
    const pair = await this.tokens.issue(account.snapshot().id, id);
    const claims = await this.tokens.verifyRefresh(pair.refreshToken);
    const previous = parent?.snapshot();
    const session = new UserSession({
      id,
      userAccountId: account.snapshot().id,
      refreshTokenHash: this.tokens.hashRefresh(pair.refreshToken),
      refreshTokenFamilyId:
        previous?.refreshTokenFamilyId ?? this.tokens.newId(),
      parentSessionId: previous?.id ?? null,
      replacedBySessionId: null,
      deviceName: deviceName ?? previous?.deviceName ?? null,
      expiresAt: new Date(claims.exp * 1000),
      revokedAt: null,
      reuseDetectedAt: null,
      createdAt: now,
    });
    await store.saveSession(session);
    if (parent) {
      parent.replaceWith(id, now);
      await store.saveSession(parent);
    } else {
      account.recordLogin(now);
      await store.saveAccount(account);
    }
    return { ...pair, user: account.publicProfile() };
  }
}

export class RegisterUseCase {
  constructor(
    private readonly uow: AuthUnitOfWork,
    private readonly passwords: PasswordHasher,
    private readonly tokens: AuthTokens,
    private readonly sessions: IssueSession,
  ) {}

  async execute(input: RegisterInput): Promise<AuthOutput> {
    const email = input.email.trim().toLowerCase();
    const passwordHash = await this.passwords.hash(input.password);
    return this.uow.run(async (store) => {
      if (await store.findAccountByEmail(email)) {
        throw new AuthError(
          'EMAIL_ALREADY_EXISTS',
          'Email is already registered',
        );
      }
      const now = new Date();
      const account = new UserAccount({
        id: this.tokens.newId(),
        email,
        passwordHash,
        displayName: input.displayName.trim(),
        avatarUrl: null,
        isLocked: false,
        lockedReason: null,
        lastLoginAt: null,
        createdAt: now,
        updatedAt: now,
        deletedAt: null,
      });
      await store.saveAccount(account);
      return this.sessions.execute(store, account, input.deviceName);
    });
  }
}

export class LoginUseCase {
  constructor(
    private readonly uow: AuthUnitOfWork,
    private readonly passwords: PasswordHasher,
    private readonly sessions: IssueSession,
  ) {}

  async execute(input: LoginInput): Promise<AuthOutput> {
    const account = await this.uow.run((store) =>
      store.findAccountByEmail(input.email.trim().toLowerCase()),
    );
    const valid = await this.passwords.verify(
      account?.snapshot().passwordHash ?? null,
      input.password,
    );
    if (!account || !valid) {
      throw new AuthError('INVALID_CREDENTIALS', 'Invalid email or password');
    }
    return this.uow.run(async (store) => {
      const current = await store.lockAccount(account.snapshot().id);
      if (
        !current ||
        current.snapshot().passwordHash !== account.snapshot().passwordHash
      ) {
        throw new AuthError('INVALID_CREDENTIALS', 'Invalid email or password');
      }
      return this.sessions.execute(store, current, input.deviceName);
    });
  }
}

export class RefreshTokenUseCase {
  constructor(
    private readonly uow: AuthUnitOfWork,
    private readonly tokens: AuthTokens,
    private readonly sessions: IssueSession,
  ) {}

  async execute(refreshToken: string): Promise<AuthOutput> {
    const claims = await this.tokens.verifyRefresh(refreshToken);
    const result = await this.uow.run(async (store) => {
      const account = await store.lockAccount(claims.sub);
      const session = await store.findSession(claims.sid);
      if (
        !account ||
        !session ||
        session.snapshot().userAccountId !== claims.sub ||
        session.snapshot().refreshTokenHash !==
          this.tokens.hashRefresh(refreshToken)
      ) {
        throw new AuthError('INVALID_TOKEN', 'Invalid refresh token');
      }
      account.assertCanAuthenticate();
      const now = new Date();
      if (session.wasRevoked()) {
        session.detectReuse(now);
        await store.saveSession(session);
        await store.revokeFamily(session.snapshot().refreshTokenFamilyId, now);
        // Commit revocation before reporting the error, otherwise it rolls back.
        return null;
      }
      if (!session.isActive(now))
        throw new AuthError('INVALID_TOKEN', 'Refresh token expired');
      return this.sessions.execute(store, account, undefined, session);
    });
    if (!result)
      throw new AuthError(
        'INVALID_TOKEN',
        'Refresh token reuse detected; sign in again',
      );
    return result;
  }
}

export class LogoutUseCase {
  constructor(
    private readonly uow: AuthUnitOfWork,
    private readonly tokens: AuthTokens,
  ) {}

  async execute(refreshToken: string): Promise<void> {
    const claims = await this.tokens.verifyRefresh(refreshToken);
    await this.uow.run(async (store) => {
      await store.lockAccount(claims.sub);
      const session = await store.findSession(claims.sid);
      if (
        !session ||
        session.snapshot().userAccountId !== claims.sub ||
        session.snapshot().refreshTokenHash !==
          this.tokens.hashRefresh(refreshToken)
      ) {
        throw new AuthError('INVALID_TOKEN', 'Invalid refresh token');
      }
      await store.revokeFamily(
        session.snapshot().refreshTokenFamilyId,
        new Date(),
      );
    });
  }
}

export class AuthenticateAccessUseCase {
  constructor(private readonly uow: AuthUnitOfWork) {}

  execute(claims: TokenClaims) {
    return this.uow.run(async (store) => {
      const account = await store.findAccountById(claims.sub);
      const session = await store.findSession(claims.sid);
      if (
        !account ||
        !session ||
        session.snapshot().userAccountId !== claims.sub ||
        !session.isActive(new Date())
      ) {
        throw new AuthError('INVALID_TOKEN', 'Session is no longer active');
      }
      account.assertCanAuthenticate();
      return { ...account.publicProfile(), sessionId: claims.sid };
    });
  }
}
