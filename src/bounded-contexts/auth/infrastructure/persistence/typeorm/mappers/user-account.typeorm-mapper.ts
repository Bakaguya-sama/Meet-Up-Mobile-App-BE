import { UserAccount } from '../../../../domain/aggregates/user-account.aggregate';
import { UserAccountEntity } from '../entities/user-account.typeorm-entity';

export class UserAccountTypeOrmMapper {
  static toDomain(row: UserAccountEntity): UserAccount {
    return new UserAccount({
      id: row.id,
      email: row.email,
      passwordHash: row.passwordHash,
      displayName: row.displayName,
      avatarUrl: row.avatarUrl,
      isLocked: row.isLocked,
      lockedReason: row.lockedReason,
      lastLoginAt: row.lastLoginAt,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
      deletedAt: row.deletedAt,
    });
  }

  static toPersistence(account: UserAccount) {
    return account.snapshot();
  }
}
