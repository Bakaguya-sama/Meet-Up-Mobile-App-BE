import { EntityManager } from 'typeorm';
import type { UserAccountStorePort } from '../../../application/ports/persistence/user-account-store.port';
import { UserAccount } from '../../../domain/aggregates/user-account.aggregate';
import { UserAccountEntity } from './entities/user-account.typeorm-entity';
import { UserAccountTypeOrmMapper } from './mappers/user-account.typeorm-mapper';

export class TypeOrmUserAccountRepository implements UserAccountStorePort {
  constructor(private readonly manager: EntityManager) {}

  async findAccountByEmail(email: string) {
    const row = await this.manager.findOneBy(UserAccountEntity, { email });
    return row ? UserAccountTypeOrmMapper.toDomain(row) : null;
  }

  async findAccountById(id: string) {
    const row = await this.manager.findOneBy(UserAccountEntity, { id });
    return row ? UserAccountTypeOrmMapper.toDomain(row) : null;
  }

  async lockAccount(id: string) {
    const row = await this.manager.findOne(UserAccountEntity, {
      where: { id },
      lock: { mode: 'pessimistic_write' },
    });
    return row ? UserAccountTypeOrmMapper.toDomain(row) : null;
  }

  async saveAccount(account: UserAccount) {
    await this.manager.save(
      UserAccountEntity,
      UserAccountTypeOrmMapper.toPersistence(account),
    );
  }
}
