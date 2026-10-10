import { AuthError } from '../../domain/errors/auth.error';
import type { AuthUnitOfWork } from '../ports/auth-unit-of-work.port';
import type { PasswordHasher } from '../ports/password-hasher.port';
import type { AuthResultDto } from '../dto/auth-response.dto';
import { IssueSession } from '../services/issue-session.service';

export interface LoginAccountInput {
  email: string;
  password: string;
  deviceName?: string;
}

export class LoginAccountUseCase {
  constructor(
    private readonly uow: AuthUnitOfWork,
    private readonly passwords: PasswordHasher,
    private readonly sessions: IssueSession,
  ) {}

  async execute(input: LoginAccountInput): Promise<AuthResultDto> {
    const account = await this.uow.run((store) =>
      store.accounts.findAccountByEmail(input.email.trim().toLowerCase()),
    );
    const valid = await this.passwords.verify(
      account?.snapshot().passwordHash ?? null,
      input.password,
    );
    if (!account || !valid) {
      throw new AuthError('INVALID_CREDENTIALS', 'Invalid email or password');
    }
    return this.uow.run(async (store) => {
      const current = await store.accounts.lockAccount(account.snapshot().id);
      if (
        !current ||
        current.snapshot().passwordHash !== account.snapshot().passwordHash
      ) {
        throw new AuthError('INVALID_CREDENTIALS', 'Invalid email or password');
      }
      return this.sessions.execute(store, current, input.deviceName);
    });
  }
}
