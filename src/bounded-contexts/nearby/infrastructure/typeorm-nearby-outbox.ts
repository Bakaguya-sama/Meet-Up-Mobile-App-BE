import { Injectable } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { TypeOrmTransactionalOutbox } from '../../../infrastructure/outbox/persistence/typeorm-outbox.port';
import type { NearbyOutboxPort } from '../application/nearby-detector';

@Injectable()
export class TypeOrmNearbyOutbox implements NearbyOutboxPort {
  constructor(private readonly dataSource: DataSource) {}
  enqueue(input: {
    eventIdA: string;
    eventIdB: string;
    userAId: string;
    userBId: string;
    occurredAt: Date;
  }) {
    return this.dataSource.transaction(async (manager) => {
      const outbox = new TypeOrmTransactionalOutbox(manager);
      await outbox.add(
        {
          eventId: input.eventIdA,
          eventName: 'NearbyFriendDetected.v1',
          occurredAt: input.occurredAt.toISOString(),
          friendId: input.userBId,
        },
        { destination: 'push', recipientIds: [input.userAId] },
      );
      await outbox.add(
        {
          eventId: input.eventIdB,
          eventName: 'NearbyFriendDetected.v1',
          occurredAt: input.occurredAt.toISOString(),
          friendId: input.userAId,
        },
        { destination: 'push', recipientIds: [input.userBId] },
      );
    });
  }
}
