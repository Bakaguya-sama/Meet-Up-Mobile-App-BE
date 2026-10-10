import { AuthError } from '../../domain/errors/auth.error';
import { UserAccount } from '../../domain/aggregates/user-account.aggregate';
import type { AuthTokens } from '../ports/auth-tokens.port';
import type { AuthUnitOfWork } from '../ports/auth-unit-of-work.port';
import type { PasswordHasher } from '../ports/password-hasher.port';
import type { AuthResultDto } from '../dto/auth-response.dto';
import { IssueSession } from '../services/issue-session.service';

export interface RegisterAccountInput {
  email: string;
  password: string;
  displayName: string;
  deviceName?: string;
}

export class RegisterAccountUseCase {
  constructor(
    private readonly uow: AuthUnitOfWork,
    private readonly passwords: PasswordHasher,
    private readonly tokens: AuthTokens,
    private readonly sessions: IssueSession,
  ) {}

  async execute(input: RegisterAccountInput): Promise<AuthResultDto> {
    const email = input.email.trim().toLowerCase();
    const passwordHash = await this.passwords.hash(input.password);
    return this.uow.run(async (store) => {
      if (await store.accounts.findAccountByEmail(email)) {
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
      await store.accounts.saveAccount(account);
      return this.sessions.execute(store, account, input.deviceName);
    });
  }
}
