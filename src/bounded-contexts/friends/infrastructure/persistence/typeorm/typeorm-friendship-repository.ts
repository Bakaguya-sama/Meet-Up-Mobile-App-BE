import { Injectable } from '@nestjs/common';
import { DataSource, QueryFailedError } from 'typeorm';
import type { FriendshipStorePort } from '../../../application/ports/persistence/friendship-store.port';
import { Friendship } from '../../../domain/aggregates/friendship.aggregate';
import { FriendshipError } from '../../../domain/errors/friendship.error';
import { FriendshipEntity } from './entities/friendship.typeorm-entity';
import { FriendshipTypeOrmMapper } from './mappers/friendship.typeorm-mapper';

@Injectable()
export class TypeOrmFriendshipRepository implements FriendshipStorePort {
  constructor(private readonly dataSource: DataSource) {}

  async insert(friendship: Friendship): Promise<void> {
    try {
      // A unique canonical pair protects same-direction AND crossed requests,
      // including requests handled by separate API processes.
      await this.dataSource
        .getRepository(FriendshipEntity)
        .insert(FriendshipTypeOrmMapper.toPersistence(friendship));
    } catch (error) {
      if (error instanceof QueryFailedError) {
        const driver = error.driverError as {
          code?: string;
          constraint?: string;
        };
        if (
          driver.code === '23505' &&
          driver.constraint === 'uq_friendships_pair'
        ) {
          throw new FriendshipError(
            'FRIENDSHIP_ALREADY_EXISTS',
            'A friendship or friend request already exists for this pair',
          );
        }
        if (driver.code === '23503') {
          throw new FriendshipError(
            'FRIEND_USER_NOT_FOUND',
            'User account not found',
          );
        }
      }
      throw error;
    }
  }

  updateLocked(id: string, change: (friendship: Friendship) => void) {
    return this.dataSource.transaction(async (manager) => {
      const row = await manager.findOne(FriendshipEntity, {
        where: { id },
        lock: { mode: 'pessimistic_write' },
      });
      if (!row)
        throw new FriendshipError(
          'FRIENDSHIP_NOT_FOUND',
          'Friend request not found',
        );
      const friendship = FriendshipTypeOrmMapper.toDomain(row);
      change(friendship);
      await manager.save(
        FriendshipEntity,
        FriendshipTypeOrmMapper.toPersistence(friendship),
      );
      return friendship.snapshot();
    });
  }

  async findForUsers(actorId: string, userIds: string[]) {
    if (!userIds.length) return [];
    const rows = await this.dataSource
      .getRepository(FriendshipEntity)
      .createQueryBuilder('friendship')
      .where(
        '(friendship.userAId = :actorId AND friendship.userBId IN (:...userIds)) OR (friendship.userBId = :actorId AND friendship.userAId IN (:...userIds))',
        { actorId, userIds },
      )
      .getMany();
    return rows.map((row) => FriendshipTypeOrmMapper.toDomain(row).snapshot());
  }

  async list(input: {
    actorId: string;
    kind: 'accepted' | 'received' | 'sent';
    offset: number;
    limit: number;
  }) {
    const query = this.dataSource
      .getRepository(FriendshipEntity)
      .createQueryBuilder('friendship')
      .where(
        '(friendship.userAId = :actorId OR friendship.userBId = :actorId)',
        { actorId: input.actorId },
      )
      .andWhere('friendship.status = :status', {
        status: input.kind === 'accepted' ? 'accepted' : 'pending',
      });
    if (input.kind !== 'accepted') {
      query.andWhere(
        `friendship.requestedById ${input.kind === 'sent' ? '=' : '<>'} :actorId`,
      );
    }
    const [rows, total] = await query
      .orderBy('friendship.updatedAt', 'DESC')
      .addOrderBy('friendship.id', 'DESC')
      .skip(input.offset)
      .take(input.limit)
      .getManyAndCount();
    return {
      items: rows.map((row) =>
        FriendshipTypeOrmMapper.toDomain(row).snapshot(),
      ),
      total,
    };
  }
}
