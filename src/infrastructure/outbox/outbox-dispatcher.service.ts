import { Inject, Injectable } from '@nestjs/common';
import type { IntegrationEvent } from '../../shared-kernel/application/integration-event.contract';
import {
  PUSH_NOTIFICATION,
  type PushNotificationPort,
} from '../../bounded-contexts/notifications/application/ports/push-notification.port';
import {
  REALTIME_PUBLISHER,
  type RealtimePublisherPort,
  realtimeRooms,
} from '../../shared-kernel/application/realtime-publisher.port';
import type { OutboxDestination } from '../../shared-kernel/application/outbox.port';

@Injectable()
export class OutboxDispatcher {
  constructor(
    @Inject(REALTIME_PUBLISHER)
    private readonly realtime: RealtimePublisherPort,
    @Inject(PUSH_NOTIFICATION)
    private readonly push: PushNotificationPort,
  ) {}

  async dispatch(
    event: IntegrationEvent,
    destination: OutboxDestination,
    recipientIds: string[],
  ): Promise<void> {
    if (destination === 'realtime') {
      const room = roomForEvent(event);
      await this.realtime.publish({
        room,
        eventName: event.eventName,
        eventId: event.eventId,
        payload: event,
      });
      return;
    }

    if (event.eventName !== 'MeetupFinalized.v1') {
      throw new Error(`Push delivery is not configured for ${event.eventName}`);
    }

    await Promise.all(
      recipientIds.map((recipientId) =>
        this.push.send({
          recipientId,
          title: 'Meetup finalized',
          body: 'A place has been finalized for your meetup.',
          data: {
            type: 'meetup.finalized',
            meetupId: event.meetupId,
            placeId: event.placeId,
          },
          eventId: event.eventId,
        }),
      ),
    );
  }
}

function roomForEvent(event: IntegrationEvent): string {
  if (event.eventName === 'LocationUpdated.v1') {
    return event.meetupId
      ? realtimeRooms.meetup(event.meetupId)
      : realtimeRooms.user(event.ownerId);
  }

  return realtimeRooms.meetup(event.meetupId);
}
