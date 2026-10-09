import { UserAccount } from '../../domain/aggregates/user-account.aggregate';
import { UserSession } from '../../domain/aggregates/user-session.aggregate';
import type { AuthTransaction } from '../ports/auth-unit-of-work.port';
import type { AuthTokens } from '../ports/auth-tokens.port';
import type { AuthResultDto } from '../dto/auth-response.dto';

export class IssueSession {
  constructor(private readonly tokens: AuthTokens) {}

  async execute(
    store: AuthTransaction,
    account: UserAccount,
    deviceName?: string,
    parent?: UserSession,
  ): Promise<AuthResultDto> {
    account.assertCanAuthenticate();
    const now = new Date();
    const id = this.tokens.newId();
    const pair = await this.tokens.issue(account.snapshot().id, id);
    const claims = await this.tokens.verifyRefresh(pair.refreshToken);
    const previous = parent?.snapshot();
    const session = new UserSession({
      id,
      userAccountId: account.snapshot().id,
      refreshTokenHash: this.tokens.hashRefresh(pair.refreshToken),
      refreshTokenFamilyId:
        previous?.refreshTokenFamilyId ?? this.tokens.newId(),
      parentSessionId: previous?.id ?? null,
      replacedBySessionId: null,
      deviceName: deviceName ?? previous?.deviceName ?? null,
      expiresAt: new Date(claims.exp * 1000),
      revokedAt: null,
      reuseDetectedAt: null,
      createdAt: now,
    });
    await store.sessions.saveSession(session);
    if (parent) {
      parent.replaceWith(id, now);
      await store.sessions.saveSession(parent);
    } else {
      account.recordLogin(now);
      await store.accounts.saveAccount(account);
    }
    return { ...pair, user: account.publicProfile() };
  }
}
