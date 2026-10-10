import { Friendship } from '../../../../domain/aggregates/friendship.aggregate';
import { FriendshipEntity } from '../entities/friendship.typeorm-entity';

export class FriendshipTypeOrmMapper {
  static toDomain(row: FriendshipEntity): Friendship {
    return Friendship.restore({
      id: row.id,
      userAId: row.userAId,
      userBId: row.userBId,
      requestedById: row.requestedById,
      status: row.status,
      requestedAt: row.requestedAt,
      respondedAt: row.respondedAt,
      updatedAt: row.updatedAt,
    });
  }

  static toPersistence(friendship: Friendship): FriendshipEntity {
    return Object.assign(new FriendshipEntity(), friendship.snapshot());
  }
}
