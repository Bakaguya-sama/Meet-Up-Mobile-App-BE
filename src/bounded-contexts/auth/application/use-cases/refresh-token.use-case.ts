import { AuthError } from '../../domain/errors/auth.error';
import type { AuthTokens } from '../ports/auth-tokens.port';
import type { AuthUnitOfWork } from '../ports/auth-unit-of-work.port';
import type { AuthResultDto } from '../dto/auth-response.dto';
import { IssueSession } from '../services/issue-session.service';

export class RefreshTokenUseCase {
  constructor(
    private readonly uow: AuthUnitOfWork,
    private readonly tokens: AuthTokens,
    private readonly sessions: IssueSession,
  ) {}

  async execute(refreshToken: string): Promise<AuthResultDto> {
    const claims = await this.tokens.verifyRefresh(refreshToken);
    const result = await this.uow.run(async (store) => {
      const account = await store.accounts.lockAccount(claims.sub);
      const session = await store.sessions.findSession(claims.sid);
      if (
        !account ||
        !session ||
        session.snapshot().userAccountId !== claims.sub ||
        session.snapshot().refreshTokenHash !==
          this.tokens.hashRefresh(refreshToken)
      ) {
        throw new AuthError('INVALID_TOKEN', 'Invalid refresh token');
      }
      account.assertCanAuthenticate();
      const now = new Date();
      if (session.wasRevoked()) {
        session.detectReuse(now);
        await store.sessions.saveSession(session);
        await store.sessions.revokeFamily(
          session.snapshot().refreshTokenFamilyId,
          now,
        );
        // Commit revocation before reporting the error, otherwise it rolls back.
        return null;
      }
      if (!session.isActive(now))
        throw new AuthError('INVALID_TOKEN', 'Refresh token expired');
      return this.sessions.execute(store, account, undefined, session);
    });
    if (!result)
      throw new AuthError(
        'INVALID_TOKEN',
        'Refresh token reuse detected; sign in again',
      );
    return result;
  }
}
