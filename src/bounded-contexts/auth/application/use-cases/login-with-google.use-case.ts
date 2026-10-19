import { AuthError } from '../../domain/errors/auth.error';
import { UserAccount } from '../../domain/aggregates/user-account.aggregate';
import { OAuthIdentity } from '../../domain/entities/oauth-identity.entity';
import type { AuthTokens } from '../ports/auth-tokens.port';
import type { AuthUnitOfWork } from '../ports/auth-unit-of-work.port';
import type { AuthResultDto } from '../dto/auth-response.dto';
import { IssueSession } from '../services/issue-session.service';

export interface LoginWithGoogleInput {
  email: string;
  providerAccountId: string;
  emailVerified: boolean;
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
      const now = new Date();
      const existingIdentity =
        await store.oauthIdentities.findByProviderAccount(
          'google',
          input.providerAccountId,
        );
      let account = existingIdentity
        ? await store.accounts.findAccountById(
            existingIdentity.snapshot().userAccountId,
          )
        : null;

      if (!account) {
        if (!input.emailVerified) {
          throw new AuthError(
            'INVALID_CREDENTIALS',
            'Google email is not verified',
          );
        }
        account = await store.accounts.findAccountByEmail(email);
      }

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
      }

      if (account.snapshot().deletedAt) {
        throw new AuthError('INVALID_CREDENTIALS', 'Account is deleted');
      }

      if (!existingIdentity) {
        await store.oauthIdentities.save(
          new OAuthIdentity({
            id: this.tokens.newId(),
            userAccountId: account.snapshot().id,
            provider: 'google',
            providerAccountId: input.providerAccountId,
            providerEmail: email,
            createdAt: now,
            updatedAt: now,
          }),
        );
      }

      const current = await store.accounts.lockAccount(account.snapshot().id);
      if (!current) {
        throw new AuthError('INVALID_CREDENTIALS', 'Account is deleted');
      }

      return this.sessions.execute(store, current, input.deviceName);
    });
  }
}
