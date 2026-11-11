import { Inject, Injectable, Logger } from '@nestjs/common';
import {
  REALTIME_PUBLISHER,
  realtimeRooms,
} from '../../../../shared-kernel/application/realtime-publisher.port';
import type { RealtimePublisherPort } from '../../../../shared-kernel/application/realtime-publisher.port';
import type { DirectChatMessagePublisherPort } from '../../application/ports/direct-chat-message-publisher.port';
import type { DirectChatMessageView } from '../../application/ports/direct-chat-store.port';

@Injectable()
export class RealtimeDirectChatMessagePublisherAdapter implements DirectChatMessagePublisherPort {
  private readonly logger = new Logger(
    RealtimeDirectChatMessagePublisherAdapter.name,
  );

  constructor(
    @Inject(REALTIME_PUBLISHER)
    private readonly publisher: RealtimePublisherPort,
  ) {}

  async publish(message: DirectChatMessageView): Promise<void> {
    const payload = {
      id: message.id,
      conversationId: message.conversationId,
      senderUserId: message.senderUserId,
      recipientUserId: message.recipientUserId,
      textContent: message.textContent,
      attachments: message.attachments,
      sentAt: message.sentAt.toISOString(),
    };
    const recipients = [
      ...new Set([message.senderUserId, message.recipientUserId]),
    ];
    const deliveries = await Promise.allSettled(
      recipients.map((recipientId) =>
        this.publisher.publish({
          room: realtimeRooms.user(recipientId),
          eventName: 'direct:chat-message',
          eventId: message.id,
          payload,
        }),
      ),
    );
    if (deliveries.some((delivery) => delivery.status === 'rejected')) {
      this.logger.warn(
        `Direct chat message ${message.id} was stored but one or more realtime deliveries failed`,
      );
    }
  }
}
