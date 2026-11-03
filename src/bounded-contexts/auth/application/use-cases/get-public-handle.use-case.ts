import { AuthError } from '../../domain/errors/auth.error';
import type { AuthUnitOfWork } from '../ports/auth-unit-of-work.port';

export class GetPublicHandleUseCase {
  constructor(private readonly uow: AuthUnitOfWork) {}

  async execute(userId: string): Promise<{ publicHandle: string | null }> {
    return this.uow.run(async (store) => {
      const account = await store.accounts.findAccountById(userId);
      if (!account) {
        throw new AuthError('ACCOUNT_NOT_FOUND', 'User account not found');
      }
      account.assertCanAuthenticate();
      const state = account.snapshot();
      return {
        publicHandle: state.publicHandleDisabledAt
          ? null
          : (state.publicHandle ?? null),
      };
    });
  }
}
