import { AuthError } from '../../domain/errors/auth.error';
import type { AuthUnitOfWork } from '../ports/auth-unit-of-work.port';

export class DisablePublicHandleUseCase {
  constructor(private readonly uow: AuthUnitOfWork) {}

  async execute(userId: string): Promise<void> {
    await this.uow.run(async (store) => {
      const account = await store.accounts.lockAccount(userId);
      if (!account) {
        throw new AuthError('ACCOUNT_NOT_FOUND', 'User account not found');
      }
      account.disablePublicHandle(new Date());
      await store.accounts.saveAccount(account);
    });
  }
}
