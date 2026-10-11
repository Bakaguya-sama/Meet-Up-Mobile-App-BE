export const PASSWORD_HASHER = Symbol('PASSWORD_HASHER');

export interface PasswordHasher {
  hash(password: string): Promise<string>;
  verify(hash: string | null, password: string): Promise<boolean>;
}
