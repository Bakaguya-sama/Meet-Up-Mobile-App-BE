import { AuthError } from '../../domain/errors/auth.error';
import { PublicHandle } from '../../domain/values/public-handle';
import type { AuthUnitOfWork } from '../ports/auth-unit-of-work.port';

export class ManagePublicHandleUseCase {
  constructor(private readonly uow: AuthUnitOfWork) {}

  async rotate(userId: string): Promise<{ publicHandle: string }> {
    return this.uow.run(async (store) => {
      const account = await store.accounts.lockAccount(userId);
      if (!account) {
        throw new AuthError('ACCOUNT_NOT_FOUND', 'User account not found');
      }
      const handle = PublicHandle.generate();
      account.rotatePublicHandle(handle, new Date());
      await store.accounts.saveAccount(account);
      return { publicHandle: handle.value };
    });
  }

  async disable(userId: string): Promise<void> {
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
