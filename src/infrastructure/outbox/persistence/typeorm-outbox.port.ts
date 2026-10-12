import { EntityManager } from 'typeorm';
import type { IntegrationEvent } from '../../../shared-kernel/application/integration-event.contract';
import type {
  OutboxDestination,
  OutboxPort,
} from '../../../shared-kernel/application/outbox.port';
import { OutboxEventTypeOrmEntity } from './outbox-event.typeorm-entity';

/**
 * Construct this adapter with the EntityManager from the business transaction.
 * The event row therefore commits or rolls back with the aggregate mutation.
 */
export class TypeOrmTransactionalOutbox implements OutboxPort {
  constructor(private readonly manager: EntityManager) {}

  async add(
    event: IntegrationEvent,
    delivery: { destination: OutboxDestination; recipientIds?: string[] },
  ): Promise<void> {
    const outboxEvent = new OutboxEventTypeOrmEntity();
    outboxEvent.id = event.eventId;
    outboxEvent.eventName = event.eventName;
    outboxEvent.destination = delivery.destination;
    outboxEvent.recipientIds = delivery.recipientIds ?? [];
    outboxEvent.payload = event;
    outboxEvent.occurredAt = new Date(event.occurredAt);
    outboxEvent.status = 'pending';
    outboxEvent.attemptCount = 0;
    outboxEvent.lastError = null;
    outboxEvent.deliveredAt = null;
    outboxEvent.createdAt = new Date();

    await this.manager
      .getRepository(OutboxEventTypeOrmEntity)
      .save(outboxEvent);
  }
}
