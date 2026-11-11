import { FriendshipReader } from '../../../friends/application/public/friendship-reader';
import { ChatError } from '../../domain/errors/chat.error';
import type { DirectChatStore } from '../ports/direct-chat-store.port';
import { ChatAttachmentService } from '../services/chat-attachment.service';

export class ListDirectChatMessagesQuery {
  constructor(
    private readonly store: DirectChatStore,
    private readonly friendships: FriendshipReader,
    private readonly attachments: ChatAttachmentService,
  ) {}

  async execute(input: {
    actorId: string;
    peerId: string;
    before?: Date;
    beforeId?: string;
    limit: number;
  }) {
    if (!!input.before !== !!input.beforeId) {
      throw new ChatError(
        'INVALID_INPUT',
        'before and beforeId must be provided together',
      );
    }
    const actorId = input.actorId.toLowerCase();
    const peerId = input.peerId.toLowerCase();
    if (!(await this.friendships.areAccepted(actorId, peerId))) {
      throw new ChatError(
        'DIRECT_CHAT_FORBIDDEN',
        'Direct chat is available only between accepted friends',
      );
    }
    const messages = await this.store.list({
      actorId,
      peerId,
      before: input.before,
      beforeId: input.beforeId,
      limit: Math.min(Math.max(input.limit, 1), 100),
    });
    return Promise.all(
      messages.map(async (message) => ({
        ...message,
        attachments: await this.attachments.createViews(message.attachments),
      })),
    );
  }
}
