import { AuthError } from '../errors/auth.error';

export interface AccountState {
  id: string;
  email: string;
  passwordHash: string | null;
  displayName: string;
  avatarUrl: string | null;
  isLocked: boolean;
  lockedReason: string | null;
  lastLoginAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
  deletedAt: Date | null;
}

export class UserAccount {
  constructor(private readonly state: AccountState) {}

  assertCanAuthenticate(): void {
    if (this.state.deletedAt) {
      throw new AuthError('INVALID_CREDENTIALS', 'Invalid credentials');
    }
    if (this.state.isLocked) {
      throw new AuthError('ACCOUNT_LOCKED', 'This account is locked');
    }
  }

  recordLogin(now: Date): void {
    this.assertCanAuthenticate();
    this.state.lastLoginAt = now;
    this.state.updatedAt = now;
  }

  updateProfile(
    input: { displayName?: string; avatarUrl?: string | null },
    now: Date,
  ): void {
    this.assertCanAuthenticate();
    if (input.displayName !== undefined) {
      const trimmed = input.displayName.trim();
      if (!trimmed || trimmed.length > 100) {
        throw new AuthError(
          'INVALID_INPUT',
          'Display name must be between 1 and 100 characters',
        );
      }
      this.state.displayName = trimmed;
    }
    if (input.avatarUrl !== undefined) {
      if (input.avatarUrl && input.avatarUrl.length > 1000) {
        throw new AuthError(
          'INVALID_INPUT',
          'Avatar URL cannot exceed 1000 characters',
        );
      }
      this.state.avatarUrl = input.avatarUrl;
    }
    this.state.updatedAt = now;
  }

  snapshot(): AccountState {
    return { ...this.state };
  }

  publicProfile() {
    const { id, email, displayName, avatarUrl } = this.state;
    return { id, email, displayName, avatarUrl };
  }
}
