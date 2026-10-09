import { Injectable } from '@nestjs/common';
import { DataSource, QueryFailedError } from 'typeorm';
import type {
  AuthTransaction,
  AuthUnitOfWork,
} from '../../../application/ports/auth-unit-of-work.port';
import { AuthError } from '../../../domain/errors/auth.error';
import { TypeOrmUserAccountRepository } from './typeorm-user-account-repository';
import { TypeOrmUserSessionRepository } from './typeorm-user-session-repository';

@Injectable()
export class TypeOrmAuthUnitOfWork implements AuthUnitOfWork {
  constructor(private readonly dataSource: DataSource) {}

  async run<T>(work: (transaction: AuthTransaction) => Promise<T>): Promise<T> {
    try {
      return await this.dataSource.transaction((manager) =>
        work({
          accounts: new TypeOrmUserAccountRepository(manager),
          sessions: new TypeOrmUserSessionRepository(manager),
        }),
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
