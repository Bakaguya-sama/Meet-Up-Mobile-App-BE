import { AdminError } from '../../domain/errors/admin.error';
import type { AccountLockAdministration } from '../../../auth/application/public/account-lock-administration';

export class ManageAccountLockUseCase {
  constructor(private readonly accountLocks: AccountLockAdministration) {}

  execute(input: {
    actorId: string;
    accountId: string;
    locked: boolean;
    reason?: string;
  }) {
    if (
      input.locked &&
      input.actorId.toLowerCase() === input.accountId.toLowerCase()
    ) {
      throw new AdminError(
        'ADMIN_SELF_LOCK',
        'Administrators cannot lock their own account',
      );
    }
    return this.accountLocks.execute(input);
  }
}
