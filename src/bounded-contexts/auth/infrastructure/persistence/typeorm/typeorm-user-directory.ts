import { Injectable } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { UserDirectory } from '../../../application/public/user-directory';
import { UserAccountEntity } from './entities/user-account.typeorm-entity';

@Injectable()
export class TypeOrmUserDirectory extends UserDirectory {
  constructor(private readonly dataSource: DataSource) {
    super();
  }

  private activeQuery() {
    return this.dataSource
      .getRepository(UserAccountEntity)
      .createQueryBuilder('account')
      .select(['account.id', 'account.displayName', 'account.avatarUrl'])
      .where('account.isLocked = false')
      .andWhere('account.deletedAt IS NULL');
  }

  async search(input: {
    actorId: string;
    query: string;
    offset: number;
    limit: number;
  }) {
    // Treat LIKE metacharacters literally; all input remains parameterized.
    const pattern = `%${input.query.replace(/[\\%_]/g, '\\$&')}%`;
    const [rows, total] = await this.activeQuery()
      .andWhere('account.id <> :actorId', { actorId: input.actorId })
      .andWhere(
        '(account.displayName ILIKE :pattern OR account.email ILIKE :pattern)',
        { pattern },
      )
      .orderBy('account.displayName', 'ASC')
      .addOrderBy('account.id', 'ASC')
      .skip(input.offset)
      .take(input.limit)
      .getManyAndCount();
    return { items: rows.map(toProfile), total };
  }

  async findActiveByIds(ids: string[]) {
    if (!ids.length) return [];
    const rows = await this.activeQuery()
      .andWhere('account.id IN (:...ids)', { ids })
      .getMany();
    return rows.map(toProfile);
  }
}

function toProfile(row: UserAccountEntity) {
  return { id: row.id, displayName: row.displayName, avatarUrl: row.avatarUrl };
}
