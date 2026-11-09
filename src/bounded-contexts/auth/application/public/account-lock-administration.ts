export const ACCOUNT_LOCK_ADMINISTRATION = Symbol(
  'ACCOUNT_LOCK_ADMINISTRATION',
);

export interface AccountLockAdministration {
  execute(input: {
    actorId: string;
    accountId: string;
    locked: boolean;
    reason?: string;
  }): Promise<{ id: string; locked: boolean; updatedAt: Date }>;
}
