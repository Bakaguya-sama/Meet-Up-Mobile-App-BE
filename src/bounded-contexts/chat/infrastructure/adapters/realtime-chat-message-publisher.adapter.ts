import { Inject, Injectable, Logger } from '@nestjs/common';
import {
  REALTIME_PUBLISHER,
  realtimeRooms,
} from '../../../../shared-kernel/application/realtime-publisher.port';
import type { RealtimePublisherPort } from '../../../../shared-kernel/application/realtime-publisher.port';
import type { ChatMessagePublisherPort } from '../../application/ports/chat-message-publisher.port';
import type { MeetupChatMessage } from '../../application/ports/meetup-chat-store.port';

@Injectable()
export class RealtimeChatMessagePublisherAdapter
  implements ChatMessagePublisherPort
{
  private readonly logger = new Logger(
    RealtimeChatMessagePublisherAdapter.name,
  );

  constructor(
    @Inject(REALTIME_PUBLISHER)
    private readonly publisher: RealtimePublisherPort,
  ) {}

  async publish(message: MeetupChatMessage): Promise<void> {
    try {
      await this.publisher.publish({
        room: realtimeRooms.meetup(message.meetupId),
        eventName: 'meetup:chat-message',
        eventId: message.id,
        payload: message,
      });
    } catch {
      this.logger.warn(
        `Chat message ${message.id} was stored but realtime publish failed`,
      );
    }
  }
}
