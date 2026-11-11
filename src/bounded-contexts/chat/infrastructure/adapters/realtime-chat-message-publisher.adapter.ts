import { Inject, Injectable, Logger } from '@nestjs/common';
import {
  REALTIME_PUBLISHER,
  realtimeRooms,
} from '../../../../shared-kernel/application/realtime-publisher.port';
import type { RealtimePublisherPort } from '../../../../shared-kernel/application/realtime-publisher.port';
import type { ChatMessagePublisherPort } from '../../application/ports/chat-message-publisher.port';
import {
  MEETUP_CHAT_ACCESS,
  type MeetupChatAccessPort,
} from '../../application/ports/meetup-chat-access.port';
import type { MeetupChatMessage } from '../../application/ports/meetup-chat-store.port';

@Injectable()
export class RealtimeChatMessagePublisherAdapter implements ChatMessagePublisherPort {
  private readonly logger = new Logger(
    RealtimeChatMessagePublisherAdapter.name,
  );

  constructor(
    @Inject(REALTIME_PUBLISHER)
    private readonly publisher: RealtimePublisherPort,
    @Inject(MEETUP_CHAT_ACCESS)
    private readonly membership: MeetupChatAccessPort,
  ) {}

  async publish(message: MeetupChatMessage): Promise<void> {
    try {
      const recipientIds = [
        ...new Set(
          await this.membership.listActiveRecipientIds(message.meetupId),
        ),
      ];
      const payload = {
        id: message.id,
        meetupId: message.meetupId,
        senderUserId: message.senderUserId,
        textContent: message.textContent,
        sentAt: message.sentAt.toISOString(),
      };
      const deliveries = await Promise.allSettled(
        recipientIds.map((recipientId) =>
          this.publisher.publish({
            room: realtimeRooms.user(recipientId),
            eventName: 'meetup:chat-message',
            eventId: message.id,
            payload,
          }),
        ),
      );
      if (deliveries.some((delivery) => delivery.status === 'rejected')) {
        this.logger.warn(
          `Chat message ${message.id} was stored but one or more realtime deliveries failed`,
        );
      }
    } catch {
      this.logger.warn(
        `Chat message ${message.id} was stored but realtime recipient lookup failed`,
      );
    }
  }
}
