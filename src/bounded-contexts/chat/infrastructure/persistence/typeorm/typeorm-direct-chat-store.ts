import { Injectable } from '@nestjs/common';
import { DataSource, QueryFailedError } from 'typeorm';
import { ChatError } from '../../../domain/errors/chat.error';
import type {
  DirectChatMessage,
  DirectChatStore,
} from '../../../application/ports/direct-chat-store.port';
import { DirectChatConversationEntity } from './entities/direct-chat-conversation.typeorm-entity';
import { DirectChatMessageEntity } from './entities/direct-chat-message.typeorm-entity';
import { randomUUID } from 'node:crypto';

@Injectable()
export class TypeOrmDirectChatStore implements DirectChatStore {
  constructor(private readonly dataSource: DataSource) {}

  async append(
    message: Omit<DirectChatMessage, 'conversationId'>,
  ): Promise<DirectChatMessage> {
    const [userAId, userBId] = [
      message.senderUserId,
      message.recipientUserId,
    ].sort();
    try {
      return await this.dataSource.transaction(async (manager) => {
        await manager
          .createQueryBuilder()
          .insert()
          .into(DirectChatConversationEntity)
          .values({ id: randomUUID(), userAId, userBId, createdAt: new Date() })
          .orIgnore()
          .execute();
        const conversation = await manager
          .getRepository(DirectChatConversationEntity)
          .findOneByOrFail({ userAId, userBId });
        const persisted: DirectChatMessage = {
          ...message,
          conversationId: conversation.id,
        };
        await manager.getRepository(DirectChatMessageEntity).insert(persisted);
        return persisted;
      });
    } catch (error) {
      if (isDirectChatForbidden(error)) {
        throw new ChatError(
          'DIRECT_CHAT_FORBIDDEN',
          'Direct chat is available only between accepted friends',
        );
      }
      throw error;
    }
  }

  async list(input: {
    actorId: string;
    peerId: string;
    before?: Date;
    beforeId?: string;
    limit: number;
  }): Promise<DirectChatMessage[]> {
    const [userAId, userBId] = [input.actorId, input.peerId].sort();
    const conversation = await this.dataSource
      .getRepository(DirectChatConversationEntity)
      .findOne({ where: { userAId, userBId } });
    if (!conversation) return [];

    const query = this.dataSource
      .getRepository(DirectChatMessageEntity)
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
    return rows.reverse().map((message) => ({
      ...message,
      recipientUserId:
        message.senderUserId === input.actorId ? input.peerId : input.actorId,
    }));
  }
}

function isDirectChatForbidden(error: unknown): boolean {
  return (
    error instanceof QueryFailedError &&
    (error.driverError as { code?: string; message?: string }).code ===
      'P0001' &&
    (error.driverError as { code?: string; message?: string }).message ===
      'DIRECT_CHAT_FORBIDDEN'
  );
}
