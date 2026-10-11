import { UpdateProfileUseCase } from './update-profile.use-case';
import { UserAccount } from '../../domain/aggregates/user-account.aggregate';
import { AuthError } from '../../domain/errors/auth.error';
import type {
  AuthTransaction,
  AuthUnitOfWork,
} from '../ports/auth-unit-of-work.port';

describe('UpdateProfileUseCase', () => {
  let mockAccount: UserAccount;
  let savedAccount: UserAccount | null;
  let mockUow: AuthUnitOfWork;

  beforeEach(() => {
    savedAccount = null;
    mockAccount = new UserAccount({
      id: 'user-123',
      email: 'test@example.com',
      passwordHash: 'hash',
      displayName: 'Old Name',
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
            saveAccount: jest.fn((acc: UserAccount) => {
              savedAccount = acc;
              return Promise.resolve();
            }),
          },
          sessions: {} as unknown as AuthTransaction['sessions'],
          preferences: {} as unknown as AuthTransaction['preferences'],
        };
        return work(tx);
      }),
    };
  });

  it('successfully updates display name and avatar', async () => {
    const useCase = new UpdateProfileUseCase(mockUow);
    const result = await useCase.execute({
      userId: 'user-123',
      displayName: 'New Name',
      avatarUrl: 'https://img.com/avatar.png',
    });

    expect(result.displayName).toBe('New Name');
    expect(result.avatarUrl).toBe('https://img.com/avatar.png');
    expect(savedAccount).not.toBeNull();
    expect(savedAccount?.snapshot().displayName).toBe('New Name');
  });

  it('throws AuthError when account is not found', async () => {
    const useCase = new UpdateProfileUseCase(mockUow);
    await expect(
      useCase.execute({
        userId: 'non-existing',
        displayName: 'New Name',
      }),
    ).rejects.toThrow(AuthError);
  });
});
