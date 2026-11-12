import { Injectable } from '@nestjs/common';
import { DataSource, QueryFailedError } from 'typeorm';
import { TypeOrmTransactionalOutbox } from '../../../../../infrastructure/outbox/persistence/typeorm-outbox.port';
import { ChatError } from '../../../domain/errors/chat.error';
import type {
  MeetupChatMessage,
  MeetupChatStore,
  MeetupChatMessageView,
} from '../../../application/ports/meetup-chat-store.port';
import { MeetupChatMessageEntity } from './entities/meetup-chat-message.typeorm-entity';

@Injectable()
export class TypeOrmMeetupChatStore implements MeetupChatStore {
  constructor(private readonly dataSource: DataSource) {}

  async append(
    message: MeetupChatMessage,
    delivery: MeetupChatMessageView,
    recipientIds: string[],
  ): Promise<void> {
    try {
      await this.dataSource.transaction(async (manager) => {
        await manager.getRepository(MeetupChatMessageEntity).insert(message);
        await new TypeOrmTransactionalOutbox(manager).add(
          {
            eventId: message.id,
            eventName: 'MeetupChatMessageCreated.v1',
            occurredAt: message.sentAt.toISOString(),
            meetupId: message.meetupId,
            messageId: message.id,
            senderUserId: message.senderUserId,
            textContent: message.textContent,
            attachments: delivery.attachments,
            sentAt: message.sentAt.toISOString(),
          },
          { destination: 'realtime', recipientIds },
        );
      });
    } catch (error) {
      if (
        error instanceof QueryFailedError &&
        (error.driverError as { code?: string; message?: string }).code ===
          'P0001' &&
        (error.driverError as { code?: string; message?: string }).message ===
          'CHAT_SENDER_NOT_ACTIVE'
      ) {
        throw new ChatError(
          'CHAT_FORBIDDEN',
          'Only accepted members of an active meetup can use chat',
        );
      }
      throw error;
    }
  }

  async list(input: {
    meetupId: string;
    before?: Date;
    beforeId?: string;
    historyVisibleUntil?: Date;
    limit: number;
  }) {
    const query = this.dataSource
      .getRepository(MeetupChatMessageEntity)
      .createQueryBuilder('message')
      .where('message.meetupId = :meetupId', { meetupId: input.meetupId });
    if (input.historyVisibleUntil) {
      query.andWhere('message.sentAt <= :historyVisibleUntil', {
        historyVisibleUntil: input.historyVisibleUntil,
      });
    }
    if (input.before && input.beforeId) {
      query.andWhere(
        '(message.sentAt < :before OR (message.sentAt = :before AND message.id < :beforeId))',
        { before: input.before, beforeId: input.beforeId },
      );
    }
    const rows = await query
      .orderBy('message.sentAt', 'DESC')
      .addOrderBy('message.id', 'DESC')
      .take(input.limit)
      .getMany();
    return rows.reverse();
  }
}
