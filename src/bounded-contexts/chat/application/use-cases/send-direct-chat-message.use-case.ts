import { randomUUID } from 'node:crypto';
import { FriendshipReader } from '../../../friends/application/public/friendship-reader';
import { ChatError } from '../../domain/errors/chat.error';
import type {
  DirectChatMessage,
  DirectChatStore,
} from '../ports/direct-chat-store.port';
import { ChatAttachmentService } from '../services/chat-attachment.service';
import type { IncomingChatFile } from '../services/chat-attachment.service';

export class SendDirectChatMessageUseCase {
  constructor(
    private readonly store: DirectChatStore,
    private readonly friendships: FriendshipReader,
    private readonly attachments: ChatAttachmentService,
  ) {}

  async execute(input: {
    actorId: string;
    peerId: string;
    clientMessageId: string;
    text?: string;
    files?: IncomingChatFile[];
  }) {
    const actorId = input.actorId.toLowerCase();
    const peerId = input.peerId.toLowerCase();
    const existing = await this.store.findByClientMessageId({
      actorId,
      peerId,
      clientMessageId: input.clientMessageId,
    });
    if (existing) {
      return {
        ...existing,
        attachments: await this.attachments.createViews(existing.attachments),
      };
    }
    if (!(await this.friendships.areAccepted(actorId, peerId))) {
      throw new ChatError(
        'DIRECT_CHAT_FORBIDDEN',
        'Direct chat is available only between accepted friends',
      );
    }
    const text = input.text?.trim() ?? '';
    const files = input.files ?? [];
    if ((!text && !files.length) || text.length > 2000) {
      throw new ChatError(
        'INVALID_INPUT',
        'Message must contain text or at least one attachment; text is limited to 2000 characters',
      );
    }

    const [userAId, userBId] = [actorId, peerId].sort();
    const uploaded = files.length
      ? await this.attachments.upload(files, {
          scope: `direct/${userAId}/${userBId}`,
          clientMessageId: input.clientMessageId,
        })
      : [];
    const message = {
      id: randomUUID(),
      senderUserId: actorId,
      recipientUserId: peerId,
      clientMessageId: input.clientMessageId,
      textContent: text,
      sentAt: new Date(),
      attachments: uploaded,
    };
    let persisted: DirectChatMessage;
    try {
      persisted = await this.store.append(message);
    } catch (error) {
      await this.attachments.delete(uploaded);
      throw error;
    }
    if (persisted.id !== message.id) {
      await this.attachments.delete(
        uploaded.filter(
          (attachment) =>
            !persisted.attachments.some(
              (stored) => stored.storageKey === attachment.storageKey,
            ),
        ),
      );
    }
    return {
      ...persisted,
      attachments: await this.attachments.createViews(persisted.attachments),
    };
  }
}
