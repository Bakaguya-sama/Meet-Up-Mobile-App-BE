import type { UserAccountStorePort } from './persistence/user-account-store.port';
import type { UserSessionStorePort } from './persistence/user-session-store.port';
import type { UserPreferenceStorePort } from './persistence/user-preference-store.port';
import type { OAuthIdentityStorePort } from './persistence/oauth-identity-store.port';
import type { AuditLogStorePort } from './persistence/audit-log-store.port';

export const AUTH_UNIT_OF_WORK = Symbol('AUTH_UNIT_OF_WORK');

export interface AuthTransaction {
  accounts: UserAccountStorePort;
  sessions: UserSessionStorePort;
  preferences: UserPreferenceStorePort;
  oauthIdentities: OAuthIdentityStorePort;
  auditLogs: AuditLogStorePort;
}

export interface AuthUnitOfWork {
  run<T>(work: (transaction: AuthTransaction) => Promise<T>): Promise<T>;
}
