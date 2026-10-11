import { UserAccount } from './user-account.aggregate';
import { AuthError } from '../errors/auth.error';

describe('UserAccount aggregate', () => {
  const createAccount = () =>
    new UserAccount({
      id: '11111111-1111-1111-1111-111111111111',
      email: 'test@example.com',
      passwordHash: 'hash',
      displayName: 'Old Name',
      avatarUrl: null,
      isLocked: false,
      lockedReason: null,
      lastLoginAt: null,
      createdAt: new Date('2026-01-01'),
      updatedAt: new Date('2026-01-01'),
      deletedAt: null,
    });

  it('updates display name and avatar url successfully', () => {
    const account = createAccount();
    const now = new Date('2026-02-01');

    account.updateProfile(
      {
        displayName: 'New Name',
        avatarUrl: 'https://example.com/avatar.jpg',
      },
      now,
    );

    const snapshot = account.snapshot();
    expect(snapshot.displayName).toBe('New Name');
    expect(snapshot.avatarUrl).toBe('https://example.com/avatar.jpg');
    expect(snapshot.updatedAt).toEqual(now);
  });

  it('trims whitespace from display name', () => {
    const account = createAccount();
    account.updateProfile({ displayName: '   Trimmed Name   ' }, new Date());
    expect(account.snapshot().displayName).toBe('Trimmed Name');
  });

  it('throws AuthError when display name is empty', () => {
    const account = createAccount();
    expect(() =>
      account.updateProfile({ displayName: '   ' }, new Date()),
    ).toThrow(AuthError);
  });

  it('throws AuthError when avatar url exceeds 1000 characters', () => {
    const account = createAccount();
    const longUrl = 'https://example.com/' + 'a'.repeat(1000);
    expect(() =>
      account.updateProfile({ avatarUrl: longUrl }, new Date()),
    ).toThrow(AuthError);
  });

  it('throws AuthError when account is locked', () => {
    const account = new UserAccount({
      id: '11111111-1111-1111-1111-111111111111',
      email: 'locked@example.com',
      passwordHash: 'hash',
      displayName: 'Locked',
      avatarUrl: null,
      isLocked: true,
      lockedReason: 'Violation',
      lastLoginAt: null,
      createdAt: new Date(),
      updatedAt: new Date(),
      deletedAt: null,
    });

    expect(() =>
      account.updateProfile({ displayName: 'Test' }, new Date()),
    ).toThrow(AuthError);
  });
});
