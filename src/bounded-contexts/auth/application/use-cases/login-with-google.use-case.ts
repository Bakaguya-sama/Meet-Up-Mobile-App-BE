import { AuthError } from '../../domain/errors/auth.error';
import { UserAccount } from '../../domain/aggregates/user-account.aggregate';
import type { AuthTokens } from '../ports/auth-tokens.port';
import type { AuthUnitOfWork } from '../ports/auth-unit-of-work.port';
import type { AuthResultDto } from '../dto/auth-response.dto';
import { IssueSession } from '../services/issue-session.service';

export interface LoginWithGoogleInput {
  email: string;
  displayName: string;
  avatarUrl?: string;
  deviceName?: string;
}

export class LoginWithGoogleUseCase {
  constructor(
    private readonly uow: AuthUnitOfWork,
    private readonly tokens: AuthTokens,
    private readonly sessions: IssueSession,
  ) {}

  async execute(input: LoginWithGoogleInput): Promise<AuthResultDto> {
    return this.uow.run(async (store) => {
      const email = input.email.trim().toLowerCase();
      let account = await store.accounts.findAccountByEmail(email);
      const now = new Date();

      if (!account) {
        account = new UserAccount({
          id: this.tokens.newId(),
          email,
          passwordHash: null,
          displayName: input.displayName.trim(),
          avatarUrl: input.avatarUrl || null,
          isLocked: false,
          lockedReason: null,
          lastLoginAt: null,
          createdAt: now,
          updatedAt: now,
          deletedAt: null,
        });
        await store.accounts.saveAccount(account);
      } else if (account.snapshot().deletedAt) {
        throw new AuthError('INVALID_CREDENTIALS', 'Account is deleted');
      }

      const current = await store.accounts.lockAccount(account.snapshot().id);
      if (!current) {
        throw new AuthError('INVALID_CREDENTIALS', 'Account is deleted');
      }

      return this.sessions.execute(store, current, input.deviceName);
    });
  }
}
