import { AuthError } from '../../domain/errors/auth.error';
import type { AuthTokens } from '../ports/auth-tokens.port';
import type { AuthUnitOfWork } from '../ports/auth-unit-of-work.port';

export class LogoutAccountUseCase {
  constructor(
    private readonly uow: AuthUnitOfWork,
    private readonly tokens: AuthTokens,
  ) {}

  async execute(refreshToken: string): Promise<void> {
    const claims = await this.tokens.verifyRefresh(refreshToken);
    await this.uow.run(async (store) => {
      await store.accounts.lockAccount(claims.sub);
      const session = await store.sessions.findSession(claims.sid);
      if (
        !session ||
        session.snapshot().userAccountId !== claims.sub ||
        session.snapshot().refreshTokenHash !==
          this.tokens.hashRefresh(refreshToken)
      ) {
        throw new AuthError('INVALID_TOKEN', 'Invalid refresh token');
      }
      await store.sessions.revokeFamily(
        session.snapshot().refreshTokenFamilyId,
        new Date(),
      );
    });
  }
}
