import type { UserAccountStorePort } from './persistence/user-account-store.port';
import type { UserSessionStorePort } from './persistence/user-session-store.port';
import type { UserPreferenceStorePort } from './persistence/user-preference-store.port';

export const AUTH_UNIT_OF_WORK = Symbol('AUTH_UNIT_OF_WORK');

export interface AuthTransaction {
  accounts: UserAccountStorePort;
  sessions: UserSessionStorePort;
  preferences: UserPreferenceStorePort;
}

export interface AuthUnitOfWork {
  run<T>(work: (transaction: AuthTransaction) => Promise<T>): Promise<T>;
}
