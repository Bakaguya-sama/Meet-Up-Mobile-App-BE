import { randomUUID } from 'node:crypto';
import { FriendshipReader } from '../../../friends/application/public/friendship-reader';
import { ChatError } from '../../domain/errors/chat.error';
import type { DirectChatMessagePublisherPort } from '../ports/direct-chat-message-publisher.port';
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
    private readonly publisher: DirectChatMessagePublisherPort,
    private readonly attachments: ChatAttachmentService,
  ) {}

  async execute(input: {
    actorId: string;
    peerId: string;
    text?: string;
    files?: IncomingChatFile[];
  }) {
    const actorId = input.actorId.toLowerCase();
    const peerId = input.peerId.toLowerCase();
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

    const uploaded = files.length ? await this.attachments.upload(files) : [];
    let attachmentViews;
    try {
      attachmentViews = await this.attachments.createViews(uploaded);
    } catch (error) {
      await this.attachments.delete(uploaded);
      throw error;
    }

    const message = {
      id: randomUUID(),
      senderUserId: actorId,
      recipientUserId: peerId,
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
    const view = { ...persisted, attachments: attachmentViews };
    await this.publisher.publish(view);
    return view;
  }
}
