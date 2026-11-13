import { Injectable } from '@nestjs/common';
import { DataSource, QueryFailedError } from 'typeorm';
import { TypeOrmTransactionalOutbox } from '../../../../../infrastructure/outbox/persistence/typeorm-outbox.port';
import type {
  MeetupChatMessage,
  MeetupChatStore,
} from '../../../application/ports/meetup-chat-store.port';
import { ChatError } from '../../../domain/errors/chat.error';
import { ChatConversationEntity } from './entities/chat-conversation.typeorm-entity';
import { ChatConversationMemberEntity } from './entities/chat-conversation-member.typeorm-entity';
import { ChatMessageEntity } from './entities/chat-message.typeorm-entity';
import {
  insertAttachments,
  loadAttachments,
} from './typeorm-direct-chat-store';

@Injectable()
export class TypeOrmMeetupChatStore implements MeetupChatStore {
  constructor(private readonly dataSource: DataSource) {}

  async append(
    message: Omit<MeetupChatMessage, 'conversationId'>,
  ): Promise<MeetupChatMessage> {
    const existing = await this.findByClientMessageId({
      meetupId: message.meetupId,
      actorId: message.senderUserId,
      clientMessageId: message.clientMessageId,
    });
    if (existing) return existing;
    try {
      return await this.dataSource.transaction(async (manager) => {
        const conversation = await manager
          .getRepository(ChatConversationEntity)
          .findOneByOrFail({ type: 'meetup', meetupId: message.meetupId });
        await manager.getRepository(ChatMessageEntity).insert({
          id: message.id,
          conversationId: conversation.id,
          senderUserId: message.senderUserId,
          clientMessageId: message.clientMessageId,
          textContent: message.textContent,
          sentAt: message.sentAt,
        });
        await insertAttachments(manager, message.id, message.attachments ?? []);
        await manager
          .getRepository(ChatConversationEntity)
          .update(
            { id: conversation.id },
            { lastMessageId: message.id, lastMessageAt: message.sentAt },
          );
        const recipients = await manager
          .getRepository(ChatConversationMemberEntity)
          .createQueryBuilder('member')
          .setLock('pessimistic_read')
          .select('member.userId')
          .where('member.conversationId = :conversationId', {
            conversationId: conversation.id,
          })
          .andWhere('member.leftAt IS NULL')
          .orderBy('member.userId', 'ASC')
          .getMany();
        await new TypeOrmTransactionalOutbox(manager).add(
          {
            eventId: message.id,
            eventName: 'MeetupChatMessageCreated.v1',
            occurredAt: message.sentAt.toISOString(),
            conversationId: conversation.id,
            messageId: message.id,
            meetupId: message.meetupId,
            senderUserId: message.senderUserId,
          },
          {
            destination: 'realtime',
            recipientIds: recipients.map((recipient) => recipient.userId),
          },
        );
        return { ...message, conversationId: conversation.id };
      });
    } catch (error) {
      if (isDuplicateClientMessage(error)) {
        const duplicate = await this.findByClientMessageId({
          meetupId: message.meetupId,
          actorId: message.senderUserId,
          clientMessageId: message.clientMessageId,
        });
        if (duplicate) return duplicate;
      }
      if (isMeetupChatForbidden(error)) {
        throw new ChatError(
          'CHAT_FORBIDDEN',
          'Only accepted members of an active meetup can use chat',
        );
      }
      throw error;
    }
  }

  async findByClientMessageId(input: {
    meetupId: string;
    actorId: string;
    clientMessageId: string;
  }): Promise<MeetupChatMessage | null> {
    const conversation = await this.findConversation(input.meetupId);
    if (!conversation) return null;
    const row = await this.dataSource.getRepository(ChatMessageEntity).findOne({
      where: {
        conversationId: conversation.id,
        senderUserId: input.actorId,
        clientMessageId: input.clientMessageId,
      },
    });
    if (!row) return null;
    const [message] = await this.hydrate(
      [row],
      conversation.id,
      input.meetupId,
    );
    return message;
  }

  async list(input: {
    meetupId: string;
    before?: Date;
    beforeId?: string;
    historyVisibleUntil?: Date;
    limit: number;
  }): Promise<MeetupChatMessage[]> {
    const conversation = await this.findConversation(input.meetupId);
    if (!conversation) return [];
    const query = this.dataSource
      .getRepository(ChatMessageEntity)
      .createQueryBuilder('message')
      .where('message.conversationId = :conversationId', {
        conversationId: conversation.id,
      });
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
    return this.hydrate(rows.reverse(), conversation.id, input.meetupId);
  }

  private findConversation(meetupId: string) {
    return this.dataSource.getRepository(ChatConversationEntity).findOne({
      where: { type: 'meetup', meetupId },
    });
  }

  private async hydrate(
    rows: ChatMessageEntity[],
    conversationId: string,
    meetupId: string,
  ): Promise<MeetupChatMessage[]> {
    const attachments = await loadAttachments(
      this.dataSource,
      rows.map((row) => row.id),
    );
    return rows.map((row) => ({
      ...row,
      conversationId,
      meetupId,
      attachments: attachments.get(row.id) ?? [],
    }));
  }
}

function isDuplicateClientMessage(error: unknown): boolean {
  return (
    error instanceof QueryFailedError &&
    (error.driverError as { code?: string; constraint?: string }).code ===
      '23505' &&
    (error.driverError as { constraint?: string }).constraint ===
      'uq_chat_messages_sender_client'
  );
}

function isMeetupChatForbidden(error: unknown): boolean {
  if (!(error instanceof QueryFailedError)) return false;
  const driver = error.driverError as { code?: string; message?: string };
  return (
    driver.code === 'P0001' &&
    ['CHAT_FORBIDDEN', 'CHAT_SENDER_NOT_ACTIVE'].includes(driver.message ?? '')
  );
}
