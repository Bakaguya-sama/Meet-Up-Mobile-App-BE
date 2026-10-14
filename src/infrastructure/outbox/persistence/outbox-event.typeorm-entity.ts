import { Column, Entity, Index, PrimaryColumn } from 'typeorm';
import type { OutboxDestination } from '../../../shared-kernel/application/outbox.port';
import type { IntegrationEventName } from '../../../shared-kernel/application/integration-event.contract';

export type OutboxStatus = 'pending' | 'delivered' | 'failed';

@Entity({ name: 'outbox_events' })
@Index('idx_outbox_events_pending', ['status', 'createdAt'])
export class OutboxEventTypeOrmEntity {
  @PrimaryColumn('uuid')
  id!: string;

  @Column({ name: 'event_name', type: 'varchar', length: 100 })
  eventName!: IntegrationEventName;

  @Column({ type: 'varchar', length: 20 })
  destination!: OutboxDestination;

  /** Internal delivery routing only; never copied into an integration-event payload. */
  @Column({
    name: 'recipient_ids',
    type: 'uuid',
    array: true,
    default: () => "'{}'",
  })
  recipientIds!: string[];

  @Column({ type: 'jsonb' })
  payload!: Record<string, unknown>;

  @Column({ name: 'occurred_at', type: 'timestamptz' })
  occurredAt!: Date;

  @Column({ type: 'varchar', length: 20, default: 'pending' })
  status!: OutboxStatus;

  @Column({ name: 'attempt_count', type: 'integer', default: 0 })
  attemptCount!: number;

  @Column({ name: 'last_error', type: 'varchar', length: 500, nullable: true })
  lastError!: string | null;

  @Column({ name: 'delivered_at', type: 'timestamptz', nullable: true })
  deliveredAt!: Date | null;

  @Column({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;
}
