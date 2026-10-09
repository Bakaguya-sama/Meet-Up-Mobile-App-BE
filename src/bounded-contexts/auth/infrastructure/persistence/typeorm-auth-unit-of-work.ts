import { Injectable } from '@nestjs/common';
import { DataSource, EntityManager, IsNull, QueryFailedError } from 'typeorm';
import type {
  AuthStore,
  AuthUnitOfWork,
} from '../../application/ports/auth.ports';
import { AuthError } from '../../domain/auth.error';
import { UserAccount } from '../../domain/user-account';
import { UserSession } from '../../domain/user-session';
import { UserAccountEntity, UserSessionEntity } from './auth.typeorm-entity';

class TypeOrmAuthStore implements AuthStore {
  constructor(private readonly manager: EntityManager) {}

  async findAccountByEmail(email: string) {
    const row = await this.manager.findOneBy(UserAccountEntity, { email });
    return row ? new UserAccount(row) : null;
  }

  async findAccountById(id: string) {
    const row = await this.manager.findOneBy(UserAccountEntity, { id });
    return row ? new UserAccount(row) : null;
  }

  async lockAccount(id: string) {
    const row = await this.manager.findOne(UserAccountEntity, {
      where: { id },
      lock: { mode: 'pessimistic_write' },
    });
    return row ? new UserAccount(row) : null;
  }

  async saveAccount(account: UserAccount) {
    await this.manager.save(UserAccountEntity, account.snapshot());
  }

  async findSession(id: string) {
    const row = await this.manager.findOneBy(UserSessionEntity, { id });
    return row ? new UserSession(row) : null;
  }

  async saveSession(session: UserSession) {
    await this.manager.save(UserSessionEntity, session.snapshot());
  }

  async revokeFamily(familyId: string, now: Date) {
    await this.manager.update(
      UserSessionEntity,
      { refreshTokenFamilyId: familyId, revokedAt: IsNull() },
      { revokedAt: now },
    );
  }
}

@Injectable()
export class TypeOrmAuthUnitOfWork implements AuthUnitOfWork {
  constructor(private readonly dataSource: DataSource) {}

  async run<T>(work: (store: AuthStore) => Promise<T>): Promise<T> {
    try {
      return await this.dataSource.transaction((manager) =>
        work(new TypeOrmAuthStore(manager)),
      );
    } catch (error) {
      if (error instanceof QueryFailedError) {
        const driver = error.driverError as {
          code?: string;
          constraint?: string;
        };
        if (
          driver.code === '23505' &&
          driver.constraint === 'uq_user_accounts_email'
        ) {
          throw new AuthError(
            'EMAIL_ALREADY_EXISTS',
            'Email is already registered',
          );
        }
      }
      throw error;
    }
  }
}
