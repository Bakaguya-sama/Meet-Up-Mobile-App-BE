import { AuthError } from '../errors/auth.error';
import { PublicHandle } from '../values/public-handle';

export interface AccountState {
  id: string;
  role?: 'user' | 'admin';
  publicHandle?: string | null;
  publicHandleDisabledAt?: Date | null;
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

  rotatePublicHandle(handle: PublicHandle, now: Date): void {
    this.assertCanAuthenticate();
    this.state.publicHandle = handle.value;
    this.state.publicHandleDisabledAt = null;
    this.state.updatedAt = now;
  }

  disablePublicHandle(now: Date): void {
    this.assertCanAuthenticate();
    if (!this.state.publicHandle || this.state.publicHandleDisabledAt) return;
    this.state.publicHandleDisabledAt = now;
    this.state.updatedAt = now;
  }

  snapshot(): AccountState {
    return { ...this.state };
  }

  publicProfile() {
    const { id, email, displayName, avatarUrl } = this.state;
    return { id, email, displayName, avatarUrl };
  }

  getRole(): 'user' | 'admin' {
    return this.state.role ?? 'user';
  }

  lock(reason: string | null, now: Date): void {
    this.state.isLocked = true;
    this.state.lockedReason = reason?.trim().slice(0, 500) || null;
    this.state.updatedAt = now;
  }

  unlock(now: Date): void {
    this.state.isLocked = false;
    this.state.lockedReason = null;
    this.state.updatedAt = now;
  }
}
