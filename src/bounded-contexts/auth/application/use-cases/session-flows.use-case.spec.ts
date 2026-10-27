import { UserAccount } from '../../domain/aggregates/user-account.aggregate';
import { IssueSession } from '../services/issue-session.service';
import { LoginAccountUseCase } from './login-account.use-case';
import { RefreshTokenUseCase } from './refresh-token.use-case';
import type { AuthTransaction } from '../ports/auth-unit-of-work.port';

const accountState = {
  id: 'user-1',
  email: 'user@example.com',
  passwordHash: 'hash',
  displayName: 'User',
  avatarUrl: null,
  isLocked: false,
  lockedReason: null,
  lastLoginAt: null,
  createdAt: new Date('2026-10-27T00:00:00.000Z'),
  updatedAt: new Date('2026-10-27T00:00:00.000Z'),
  deletedAt: null,
};

describe('BE-01 session flows', () => {
  const tokens = {
    newId: jest.fn(() => 'new-session'),
    issue: jest.fn().mockResolvedValue({
      accessToken: 'access',
      refreshToken: 'refresh-new',
      tokenType: 'Bearer' as const,
      expiresIn: 900,
      refreshExpiresIn: 86400,
    }),
    verifyRefresh: jest.fn(),
    hashRefresh: jest.fn((token: string) => `hash:${token}`),
  };
  const makeUow = (account: UserAccount, session?: object) => {
    const store = {
      accounts: {
        findAccountByEmail: jest.fn().mockResolvedValue(account),
        lockAccount: jest.fn().mockResolvedValue(account),
        saveAccount: jest.fn().mockResolvedValue(undefined),
      },
      sessions: {
        findSession: jest.fn().mockResolvedValue(session ?? null),
        saveSession: jest.fn().mockResolvedValue(undefined),
        revokeFamily: jest.fn().mockResolvedValue(undefined),
      },
      preferences: {},
      oauthIdentities: {},
    };
    const run = jest.fn(
      <T>(work: (transaction: AuthTransaction) => Promise<T>) =>
        work(store as unknown as AuthTransaction),
    );
    return { run, store };
  };

  beforeEach(() => jest.clearAllMocks());

  it('issues access and refresh tokens only for an unlocked account', async () => {
    const account = new UserAccount({ ...accountState });
    const { run, store } = makeUow(account);
    tokens.verifyRefresh.mockResolvedValue({
      sub: 'user-1',
      sid: 'new-session',
      exp: 1793059200,
    });
    const useCase = new LoginAccountUseCase(
      { run },
      { verify: jest.fn().mockResolvedValue(true) },
      new IssueSession(tokens),
    );

    await expect(
      useCase.execute({ email: ' USER@example.com ', password: 'password' }),
    ).resolves.toMatchObject({
      accessToken: 'access',
      refreshToken: 'refresh-new',
    });
    expect(store.accounts.lockAccount).toHaveBeenCalledWith('user-1');

    const locked = new UserAccount({ ...accountState, isLocked: true });
    const lockedUow = makeUow(locked);
    const lockedUseCase = new LoginAccountUseCase(
      { run: lockedUow.run },
      { verify: jest.fn().mockResolvedValue(true) },
      new IssueSession(tokens),
    );
    await expect(
      lockedUseCase.execute({
        email: 'user@example.com',
        password: 'password',
      }),
    ).rejects.toMatchObject({ code: 'ACCOUNT_LOCKED' });
  });

  it('revokes a session family when a replaced refresh token is reused', async () => {
    const account = new UserAccount({ ...accountState });
    const session = {
      snapshot: jest.fn(() => ({
        userAccountId: 'user-1',
        refreshTokenHash: 'hash:old-refresh',
        refreshTokenFamilyId: 'family-1',
      })),
      wasRevoked: jest.fn(() => true),
      detectReuse: jest.fn(),
      isActive: jest.fn(),
    };
    const { run, store } = makeUow(account, session);
    tokens.verifyRefresh.mockResolvedValue({ sub: 'user-1', sid: 'session-1' });
    const useCase = new RefreshTokenUseCase(
      { run },
      tokens,
      new IssueSession(tokens),
    );

    await expect(useCase.execute('old-refresh')).rejects.toMatchObject({
      code: 'INVALID_TOKEN',
    });
    expect(session.detectReuse).toHaveBeenCalledWith(expect.any(Date));
    expect(store.sessions.revokeFamily).toHaveBeenCalledWith(
      'family-1',
      expect.any(Date),
    );
  });
});
