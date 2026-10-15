import { randomUUID } from 'node:crypto';
import type { IntegrationEvent } from '../../../../../shared-kernel/application/integration-event.contract';
import type { OutboxPort } from '../../../../../shared-kernel/application/outbox.port';
import type { Meetup } from '../../../domain/aggregates/meetup.aggregate';

export async function writeMeetupEvents(
  meetup: Meetup,
  outbox: OutboxPort,
): Promise<void> {
  const state = meetup.snapshot();
  for (const event of meetup.pendingEvents()) {
    const metadata = {
      eventId: randomUUID(),
      meetupId: event.meetupId,
      occurredAt: event.occurredAt.toISOString(),
    };
    let integration: IntegrationEvent;
    switch (event.name) {
      case 'MeetupCreated':
        integration = {
          ...metadata,
          eventName: 'MeetupCreated.v1',
          organizerId: state.organizerId,
          inviteeIds: event.recipientIds,
        };
        break;
      case 'MeetupMemberChanged':
        integration = {
          ...metadata,
          eventName: 'MeetupMemberChanged.v1',
          userId: event.userId!,
          membershipStatus: event.membershipStatus!,
        };
        break;
      default:
        integration = { ...metadata, eventName: `${event.name}.v1` };
    }
    await outbox.add(integration, {
      destination: 'realtime',
      recipientIds: event.recipientIds,
    });
    if (
      event.name === 'MeetupCreated' ||
      event.name === 'MeetupUpdated' ||
      event.name === 'MeetupCancelled' ||
      (event.name === 'MeetupMemberChanged' &&
        event.membershipStatus === 'invited')
    ) {
      // Outbox uses eventId as its row PK, so each destination has its own delivery ID.
      await outbox.add(
        { ...integration, eventId: randomUUID() },
        {
          destination: 'push',
          recipientIds:
            event.name === 'MeetupMemberChanged'
              ? [event.userId!]
              : event.recipientIds.filter((id) => id !== state.organizerId),
        },
      );
    }
  }
}
