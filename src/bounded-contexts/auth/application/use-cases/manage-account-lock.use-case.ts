import { randomUUID } from 'node:crypto';
import { AuthError } from '../../domain/errors/auth.error';
import type { AuthUnitOfWork } from '../ports/auth-unit-of-work.port';

export class ManageAccountLockUseCase {
  constructor(private readonly uow: AuthUnitOfWork) {}

  execute(input: {
    actorId: string;
    accountId: string;
    locked: boolean;
    reason?: string;
  }) {
    return this.uow.run(async (transaction) => {
      const account = await transaction.accounts.lockAccount(input.accountId);
      if (!account) {
        throw new AuthError('ACCOUNT_NOT_FOUND', 'Account not found');
      }
      const now = new Date();
      if (input.locked) {
        account.lock(input.reason ?? null, now);
        await transaction.sessions.revokeAllForAccount(input.accountId, now);
      } else {
        account.unlock(now);
      }
      await transaction.accounts.saveAccount(account);
      await transaction.auditLogs.record({
        id: randomUUID(),
        actorId: input.actorId,
        action: input.locked ? 'account.locked' : 'account.unlocked',
        subjectType: 'user_account',
        subjectId: input.accountId,
        // Do not put free-form reasons, location data, or other sensitive data in the audit trail.
        metadataJson: { locked: input.locked },
        createdAt: now,
      });
      return {
        id: input.accountId,
        locked: input.locked,
        updatedAt: now,
      };
    });
  }
}
