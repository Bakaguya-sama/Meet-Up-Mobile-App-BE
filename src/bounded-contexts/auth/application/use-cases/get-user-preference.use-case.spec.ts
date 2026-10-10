import { GetUserPreferenceUseCase } from './get-user-preference.use-case';
import { UserAccount } from '../../domain/aggregates/user-account.aggregate';
import { UserPreference } from '../../domain/aggregates/user-preference.aggregate';
import type {
  AuthTransaction,
  AuthUnitOfWork,
} from '../ports/auth-unit-of-work.port';

describe('GetUserPreferenceUseCase', () => {
  let mockAccount: UserAccount;
  let mockUow: AuthUnitOfWork;

  const activeTags = [
    { id: 1, code: 'food', displayName: 'Ăn uống', isActive: true },
    { id: 2, code: 'coffee', displayName: 'Cà phê', isActive: true },
  ];

  beforeEach(() => {
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
  });

  it('returns default normal levels when user has no saved preference yet', async () => {
    mockUow = {
      run: jest.fn((work) => {
        const tx: AuthTransaction = {
          accounts: {
            findAccountById: jest.fn(() => Promise.resolve(mockAccount)),
            findAccountByEmail: jest.fn(() => Promise.resolve(null)),
            lockAccount: jest.fn(() => Promise.resolve(null)),
            saveAccount: jest.fn(() => Promise.resolve()),
          },
          sessions: {} as unknown as AuthTransaction['sessions'],
          preferences: {
            findActiveActivityTags: jest.fn(() => Promise.resolve(activeTags)),
            findByUserId: jest.fn(() => Promise.resolve(null)),
            savePreference: jest.fn(() => Promise.resolve()),
          },
        };
        return work(tx);
      }),
    };

    const useCase = new GetUserPreferenceUseCase(mockUow);
    const result = await useCase.execute('user-123');

    expect(result.id).toBeNull();
    expect(result.userId).toBe('user-123');
    expect(result.tags).toHaveLength(2);
    expect(result.tags[0].level).toBe('normal');
    expect(result.tags[1].level).toBe('normal');
  });

  it('returns saved preferences when user has preferences configured', async () => {
    const existingPref = new UserPreference({
      id: 'pref-999',
      userId: 'user-123',
      updatedAt: new Date(),
      tags: [
        {
          activityTagId: 1,
          level: 'high',
          createdAt: new Date(),
          tagCode: 'food',
          displayName: 'Ăn uống',
        },
      ],
    });

    mockUow = {
      run: jest.fn((work) => {
        const tx: AuthTransaction = {
          accounts: {
            findAccountById: jest.fn(() => Promise.resolve(mockAccount)),
            findAccountByEmail: jest.fn(() => Promise.resolve(null)),
            lockAccount: jest.fn(() => Promise.resolve(null)),
            saveAccount: jest.fn(() => Promise.resolve()),
          },
          sessions: {} as unknown as AuthTransaction['sessions'],
          preferences: {
            findActiveActivityTags: jest.fn(() => Promise.resolve(activeTags)),
            findByUserId: jest.fn(() => Promise.resolve(existingPref)),
            savePreference: jest.fn(() => Promise.resolve()),
          },
        };
        return work(tx);
      }),
    };

    const useCase = new GetUserPreferenceUseCase(mockUow);
    const result = await useCase.execute('user-123');

    expect(result.id).toBe('pref-999');
    expect(result.tags[0].level).toBe('high');
    expect(result.tags[1].level).toBe('normal'); // fallback for tag 2
  });
});
