import { UserAccount } from '../../domain/user-account';
import { UserSession } from '../../domain/user-session';

export const AUTH_UNIT_OF_WORK = Symbol('AUTH_UNIT_OF_WORK');
export const PASSWORD_HASHER = Symbol('PASSWORD_HASHER');
export const AUTH_TOKENS = Symbol('AUTH_TOKENS');

export interface AuthStore {
  findAccountByEmail(email: string): Promise<UserAccount | null>;
  findAccountById(id: string): Promise<UserAccount | null>;
  // Serialize all session mutations for an account, including family revocation.
  lockAccount(id: string): Promise<UserAccount | null>;
  saveAccount(account: UserAccount): Promise<void>;
  findSession(id: string): Promise<UserSession | null>;
  saveSession(session: UserSession): Promise<void>;
  revokeFamily(familyId: string, now: Date): Promise<void>;
}

export interface AuthUnitOfWork {
  run<T>(work: (store: AuthStore) => Promise<T>): Promise<T>;
}

export interface PasswordHasher {
  hash(password: string): Promise<string>;
  verify(hash: string | null, password: string): Promise<boolean>;
}

export interface TokenClaims {
  sub: string;
  sid: string;
  type: 'access' | 'refresh';
  exp: number;
}

export interface TokenPair {
  accessToken: string;
  refreshToken: string;
  tokenType: 'Bearer';
  expiresIn: number;
  refreshExpiresIn: number;
}

export interface AuthTokens {
  newId(): string;
  issue(userId: string, sessionId: string): Promise<TokenPair>;
  verifyRefresh(token: string): Promise<TokenClaims>;
  hashRefresh(token: string): string;
}
