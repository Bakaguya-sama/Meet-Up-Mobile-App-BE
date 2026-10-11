import type { UserAccount } from '../../../domain/aggregates/user-account.aggregate';

export interface UserAccountStorePort {
  findAccountByEmail(email: string): Promise<UserAccount | null>;
  findAccountById(id: string): Promise<UserAccount | null>;
  // Serialize all session mutations for an account, including family revocation.
  lockAccount(id: string): Promise<UserAccount | null>;
  saveAccount(account: UserAccount): Promise<void>;
}
