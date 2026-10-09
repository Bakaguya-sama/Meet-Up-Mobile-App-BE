import { AuthError } from '../../domain/errors/auth.error';
import type { AuthUnitOfWork } from '../ports/auth-unit-of-work.port';
import type { TokenClaims } from '../ports/auth-tokens.port';

export class AuthenticateAccessUseCase {
  constructor(private readonly uow: AuthUnitOfWork) {}

  execute(claims: TokenClaims) {
    return this.uow.run(async (store) => {
      const account = await store.accounts.findAccountById(claims.sub);
      const session = await store.sessions.findSession(claims.sid);
      if (
        !account ||
        !session ||
        session.snapshot().userAccountId !== claims.sub ||
        !session.isActive(new Date())
      ) {
        throw new AuthError('INVALID_TOKEN', 'Session is no longer active');
      }
      account.assertCanAuthenticate();
      return { ...account.publicProfile(), sessionId: claims.sid };
    });
  }
}
