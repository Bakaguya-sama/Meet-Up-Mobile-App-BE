import { SaveUserPreferenceUseCase } from './save-user-preference.use-case';
import { UserAccount } from '../../domain/aggregates/user-account.aggregate';
import { UserPreference } from '../../domain/aggregates/user-preference.aggregate';
import { AuthError } from '../../domain/errors/auth.error';
import type {
  AuthTransaction,
  AuthUnitOfWork,
} from '../ports/auth-unit-of-work.port';

describe('SaveUserPreferenceUseCase', () => {
  let mockAccount: UserAccount;
  let savedPref: UserPreference | null;
  let mockUow: AuthUnitOfWork;

  const activeTags = [
    { id: 1, code: 'food', displayName: 'Ăn uống', isActive: true },
    { id: 2, code: 'coffee', displayName: 'Cà phê', isActive: true },
    { id: 3, code: 'movie', displayName: 'Xem phim', isActive: true },
  ];

  beforeEach(() => {
    savedPref = null;
    mockAccount = new UserAccount({
      id: 'user-123',
      email: 'test@example.com',
      passwordHash: 'hash',
      displayName: 'User',
      avatarUrl: null,
      isLocked: false,
      lockedReason: null,
      lastLoginAt: null,
      createdAt: new Date(),
      updatedAt: new Date(),
      deletedAt: null,
    });

    mockUow = {
      run: jest.fn((work) => {
        const tx: AuthTransaction = {
          accounts: {
            findAccountById: jest.fn((id: string) =>
              Promise.resolve(id === 'user-123' ? mockAccount : null),
            ),
            findAccountByEmail: jest.fn(() => Promise.resolve(null)),
            lockAccount: jest.fn(() => Promise.resolve(null)),
            saveAccount: jest.fn(() => Promise.resolve()),
          },
          sessions: {} as unknown as AuthTransaction['sessions'],
          preferences: {
            findActiveActivityTags: jest.fn(() => Promise.resolve(activeTags)),
            findByUserId: jest.fn(() => Promise.resolve(null)),
            savePreference: jest.fn((pref: UserPreference) => {
              savedPref = pref;
              return Promise.resolve();
            }),
          },
        };
        return work(tx);
      }),
    };
  });

  it('saves preferences with tags by code or id', async () => {
    const useCase = new SaveUserPreferenceUseCase(mockUow);
    const result = await useCase.execute({
      userId: 'user-123',
      tags: [
        { tagCode: 'food', level: 'high' },
        { activityTagId: 2, level: 'avoid' },
      ],
    });

    expect(savedPref).not.toBeNull();
    expect(result.userId).toBe('user-123');
    expect(result.tags).toHaveLength(3); // returns all active tags with configured levels and default normal for unconfigured

    const foodTag = result.tags.find((t) => t.tagCode === 'food');
    const coffeeTag = result.tags.find((t) => t.tagCode === 'coffee');
    const movieTag = result.tags.find((t) => t.tagCode === 'movie');

    expect(foodTag?.level).toBe('high');
    expect(coffeeTag?.level).toBe('avoid');
    expect(movieTag?.level).toBe('normal');
  });

  it('throws AuthError when unknown tag is supplied', async () => {
    const useCase = new SaveUserPreferenceUseCase(mockUow);
    await expect(
      useCase.execute({
        userId: 'user-123',
        tags: [{ tagCode: 'unknown_tag', level: 'high' }],
      }),
    ).rejects.toThrow(AuthError);
  });
});
