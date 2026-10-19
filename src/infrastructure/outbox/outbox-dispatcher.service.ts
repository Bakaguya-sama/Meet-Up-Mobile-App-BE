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
      if (
        [
          'MeetupCreated.v1',
          'MeetupUpdated.v1',
          'MeetupCancelled.v1',
          'MeetupFinished.v1',
          'MeetupMemberChanged.v1',
          'PreferenceUpdated.v1',
        ].includes(event.eventName) &&
        recipientIds.length > 0
      ) {
        // Invited users have personal rooms, but cannot join the accepted-only meetup room.
        // Explicit recipients also avoid broadcasting to sockets left in an old meetup room.
        for (const recipientId of new Set(recipientIds)) {
          await this.realtime.publish({
            room: realtimeRooms.user(recipientId),
            eventName: event.eventName,
            eventId: event.eventId,
            payload: event,
          });
        }
        return;
      }
      const room = roomForEvent(event);
      await this.realtime.publish({
        room,
        eventName: event.eventName,
        eventId: event.eventId,
        payload: event,
      });
      return;
    }

    const notification = pushContent(event);

    await Promise.all(
      recipientIds.map((recipientId) =>
        this.push.send({
          recipientId,
          ...notification,
          eventId: event.eventId,
        }),
      ),
    );
  }
}

function pushContent(event: IntegrationEvent) {
  switch (event.eventName) {
    case 'MeetupFinalized.v1':
      return {
        title: 'Meetup finalized',
        body: 'A place has been finalized for your meetup.',
        data: {
          type: 'meetup.finalized',
          meetupId: event.meetupId,
          placeId: event.placeId,
        },
      };
    case 'MeetupCreated.v1':
      return {
        title: 'Meetup invitation',
        body: 'You have been invited to a meetup.',
        data: { type: 'meetup.invited', meetupId: event.meetupId },
      };
    case 'MeetupMemberChanged.v1':
      if (event.membershipStatus === 'invited')
        return {
          title: 'Meetup invitation',
          body: 'You have been invited to a meetup.',
          data: { type: 'meetup.invited', meetupId: event.meetupId },
        };
      break;
    case 'MeetupUpdated.v1':
      return {
        title: 'Meetup updated',
        body: 'Your meetup details have changed.',
        data: { type: 'meetup.updated', meetupId: event.meetupId },
      };
    case 'MeetupCancelled.v1':
      return {
        title: 'Meetup cancelled',
        body: 'Your meetup has been cancelled.',
        data: { type: 'meetup.cancelled', meetupId: event.meetupId },
      };
  }
  throw new Error(`Push delivery is not configured for ${event.eventName}`);
}

function roomForEvent(event: IntegrationEvent): string {
  if (event.eventName === 'LocationUpdated.v1') {
    return event.meetupId
      ? realtimeRooms.meetup(event.meetupId)
      : realtimeRooms.user(event.ownerId);
  }

  return realtimeRooms.meetup(event.meetupId);
}
