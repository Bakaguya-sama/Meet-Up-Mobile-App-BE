import type {
  ChatAttachmentMetadata,
  ChatAttachmentView,
} from './chat-media-storage.port';

export interface DirectChatMessage {
  id: string;
  conversationId: string;
  senderUserId: string;
  recipientUserId: string;
  clientMessageId: string;
  textContent: string;
  sentAt: Date;
  attachments: ChatAttachmentMetadata[];
}

export interface DirectChatMessageView extends Omit<
  DirectChatMessage,
  'attachments'
> {
  attachments: ChatAttachmentView[];
}

export interface DirectChatStore {
  append(
    message: Omit<DirectChatMessage, 'conversationId'>,
  ): Promise<DirectChatMessage>;
  findByClientMessageId(input: {
    actorId: string;
    peerId: string;
    clientMessageId: string;
  }): Promise<DirectChatMessage | null>;
  list(input: {
    actorId: string;
    peerId: string;
    before?: Date;
    beforeId?: string;
    limit: number;
  }): Promise<DirectChatMessage[]>;
  /** History remains readable after an unfriend/block, but only for an existing pair. */
  hasConversation(actorId: string, peerId: string): Promise<boolean>;
}

export const DIRECT_CHAT_STORE = Symbol('DIRECT_CHAT_STORE');
