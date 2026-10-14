import type { IntegrationEvent } from './integration-event.contract';

export const OUTBOX = Symbol('OUTBOX');

export type OutboxDestination = 'realtime' | 'push';

export interface OutboxPort {
  add(
    event: IntegrationEvent,
    delivery: { destination: OutboxDestination; recipientIds?: string[] },
  ): Promise<void>;
}
