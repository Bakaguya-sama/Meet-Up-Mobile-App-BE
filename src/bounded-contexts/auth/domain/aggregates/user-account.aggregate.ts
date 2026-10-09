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

  snapshot(): AccountState {
    return { ...this.state };
  }

  publicProfile() {
    const { id, email, displayName, avatarUrl } = this.state;
    return { id, email, displayName, avatarUrl };
  }
}
