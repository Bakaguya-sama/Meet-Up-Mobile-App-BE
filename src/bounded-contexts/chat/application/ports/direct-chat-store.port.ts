import type {
  ChatAttachmentMetadata,
  ChatAttachmentView,
} from './chat-media-storage.port';

export interface DirectChatMessage {
  id: string;
  conversationId: string;
  senderUserId: string;
  recipientUserId: string;
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
  list(input: {
    actorId: string;
    peerId: string;
    before?: Date;
    beforeId?: string;
    limit: number;
  }): Promise<DirectChatMessage[]>;
}

export const DIRECT_CHAT_STORE = Symbol('DIRECT_CHAT_STORE');
