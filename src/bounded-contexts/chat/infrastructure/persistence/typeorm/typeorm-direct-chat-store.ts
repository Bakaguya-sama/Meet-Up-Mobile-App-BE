import { Injectable } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { DataSource, In, QueryFailedError } from 'typeorm';
import { TypeOrmTransactionalOutbox } from '../../../../../infrastructure/outbox/persistence/typeorm-outbox.port';
import type { ChatAttachmentMetadata } from '../../../application/ports/chat-media-storage.port';
import type {
  DirectChatMessage,
  DirectChatStore,
} from '../../../application/ports/direct-chat-store.port';
import { ChatError } from '../../../domain/errors/chat.error';
import { ChatConversationMemberEntity } from './entities/chat-conversation-member.typeorm-entity';
import { ChatConversationEntity } from './entities/chat-conversation.typeorm-entity';
import { ChatMessageAttachmentEntity } from './entities/chat-message-attachment.typeorm-entity';
import { ChatMessageEntity } from './entities/chat-message.typeorm-entity';

@Injectable()
export class TypeOrmDirectChatStore implements DirectChatStore {
  constructor(private readonly dataSource: DataSource) {}

  async append(
    message: Omit<DirectChatMessage, 'conversationId'>,
  ): Promise<DirectChatMessage> {
    const existing = await this.findByClientMessageId({
      actorId: message.senderUserId,
      peerId: message.recipientUserId,
      clientMessageId: message.clientMessageId,
    });
    if (existing) return existing;

    const [userAId, userBId] = [
      message.senderUserId,
      message.recipientUserId,
    ].sort();
    try {
      return await this.dataSource.transaction(async (manager) => {
        await manager
          .createQueryBuilder()
          .insert()
          .into(ChatConversationEntity)
          .values({
            id: randomUUID(),
            type: 'direct',
            meetupId: null,
            directUserAId: userAId,
            directUserBId: userBId,
            lastMessageId: null,
            lastMessageAt: null,
            createdAt: new Date(),
          })
          .orIgnore()
          .execute();
        const conversation = await manager
          .getRepository(ChatConversationEntity)
          .findOneByOrFail({
            type: 'direct',
            directUserAId: userAId,
            directUserBId: userBId,
          });
        await manager
          .createQueryBuilder()
          .insert()
          .into(ChatConversationMemberEntity)
          .values(
            [userAId, userBId].map((userId) => ({
              conversationId: conversation.id,
              userId,
              joinedAt: conversation.createdAt,
              leftAt: null,
              historyVisibleUntil: null,
              lastReadMessageId: null,
              lastReadAt: null,
            })),
          )
          .orIgnore()
          .execute();
        const persisted: DirectChatMessage = {
          ...message,
          conversationId: conversation.id,
        };
        await manager.getRepository(ChatMessageEntity).insert({
          id: message.id,
          conversationId: conversation.id,
          senderUserId: message.senderUserId,
          clientMessageId: message.clientMessageId,
          textContent: message.textContent,
          sentAt: message.sentAt,
        });
        await insertAttachments(manager, message.id, message.attachments);
        await manager
          .getRepository(ChatConversationEntity)
          .update(
            { id: conversation.id },
            { lastMessageId: message.id, lastMessageAt: message.sentAt },
          );
        await new TypeOrmTransactionalOutbox(manager).add(
          {
            eventId: message.id,
            eventName: 'DirectChatMessageCreated.v1',
            occurredAt: message.sentAt.toISOString(),
            conversationId: conversation.id,
            messageId: message.id,
            senderUserId: message.senderUserId,
            recipientUserId: message.recipientUserId,
          },
          {
            destination: 'realtime',
            recipientIds: [message.senderUserId, message.recipientUserId],
          },
        );
        return persisted;
      });
    } catch (error) {
      if (isDuplicateClientMessage(error)) {
        const duplicate = await this.findByClientMessageId({
          actorId: message.senderUserId,
          peerId: message.recipientUserId,
          clientMessageId: message.clientMessageId,
        });
        if (duplicate) return duplicate;
      }
      if (isForbidden(error)) {
        throw new ChatError(
          'DIRECT_CHAT_FORBIDDEN',
          'Direct chat is available only between accepted friends',
        );
      }
      throw error;
    }
  }

  async findByClientMessageId(input: {
    actorId: string;
    peerId: string;
    clientMessageId: string;
  }): Promise<DirectChatMessage | null> {
    const conversation = await this.findConversation(
      input.actorId,
      input.peerId,
    );
    if (!conversation) return null;
    const row = await this.dataSource.getRepository(ChatMessageEntity).findOne({
      where: {
        conversationId: conversation.id,
        senderUserId: input.actorId,
        clientMessageId: input.clientMessageId,
      },
    });
    if (!row) return null;
    const [message] = await this.hydrate([row], input.actorId, input.peerId);
    return message;
  }

  async list(input: {
    actorId: string;
    peerId: string;
    before?: Date;
    beforeId?: string;
    limit: number;
  }): Promise<DirectChatMessage[]> {
    const conversation = await this.findConversation(
      input.actorId,
      input.peerId,
    );
    if (!conversation) return [];
    const query = this.dataSource
      .getRepository(ChatMessageEntity)
      .createQueryBuilder('message')
      .where('message.conversationId = :conversationId', {
        conversationId: conversation.id,
      });
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
    return this.hydrate(rows.reverse(), input.actorId, input.peerId);
  }

  async hasConversation(actorId: string, peerId: string): Promise<boolean> {
    return (await this.findConversation(actorId, peerId)) !== null;
  }

  private async findConversation(actorId: string, peerId: string) {
    const [directUserAId, directUserBId] = [
      actorId.toLowerCase(),
      peerId.toLowerCase(),
    ].sort();
    return this.dataSource.getRepository(ChatConversationEntity).findOne({
      where: { type: 'direct', directUserAId, directUserBId },
    });
  }

  private async hydrate(
    rows: ChatMessageEntity[],
    actorId: string,
    peerId: string,
  ): Promise<DirectChatMessage[]> {
    const attachments = await loadAttachments(
      this.dataSource,
      rows.map((row) => row.id),
    );
    return rows.map((row) => ({
      ...row,
      recipientUserId: row.senderUserId === actorId ? peerId : actorId,
      attachments: attachments.get(row.id) ?? [],
    }));
  }
}

async function insertAttachments(
  manager: import('typeorm').EntityManager,
  messageId: string,
  attachments: ChatAttachmentMetadata[],
): Promise<void> {
  if (!attachments.length) return;
  await manager.getRepository(ChatMessageAttachmentEntity).insert(
    attachments.map((attachment, sortOrder) => ({
      id: randomUUID(),
      messageId,
      ...attachment,
      sortOrder,
      createdAt: new Date(),
    })),
  );
}

async function loadAttachments(
  dataSource: DataSource,
  messageIds: string[],
): Promise<Map<string, ChatAttachmentMetadata[]>> {
  const result = new Map<string, ChatAttachmentMetadata[]>();
  if (!messageIds.length) return result;
  const rows = await dataSource
    .getRepository(ChatMessageAttachmentEntity)
    .find({
      where: { messageId: In(messageIds) },
      order: { messageId: 'ASC', sortOrder: 'ASC' },
    });
  for (const row of rows) {
    const values = result.get(row.messageId) ?? [];
    values.push({
      storageProvider: row.storageProvider,
      storageKey: row.storageKey,
      resourceType: row.resourceType,
      format: row.format,
      fileName: row.fileName,
      mimeType: row.mimeType,
      bytes: row.bytes,
    });
    result.set(row.messageId, values);
  }
  return result;
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

function isForbidden(error: unknown): boolean {
  if (!(error instanceof QueryFailedError)) return false;
  const driver = error.driverError as { code?: string; message?: string };
  return (
    driver.code === 'P0001' &&
    ['DIRECT_CHAT_FORBIDDEN', 'CHAT_FORBIDDEN'].includes(driver.message ?? '')
  );
}

export { insertAttachments, loadAttachments };
