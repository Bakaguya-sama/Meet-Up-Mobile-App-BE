import type {
  ChatAttachmentMetadata,
  ChatAttachmentView,
} from './chat-media-storage.port';

export interface MeetupChatMessage {
  id: string;
  conversationId: string;
  meetupId: string;
  senderUserId: string;
  clientMessageId: string;
  textContent: string;
  sentAt: Date;
  attachments?: ChatAttachmentMetadata[];
}

export interface MeetupChatMessageView extends Omit<
  MeetupChatMessage,
  'attachments'
> {
  attachments: ChatAttachmentView[];
}

export const MEETUP_CHAT_STORE = Symbol('MEETUP_CHAT_STORE');
export interface MeetupChatStore {
  append(
    input: Omit<MeetupChatMessage, 'conversationId'>,
  ): Promise<MeetupChatMessage>;
  findByClientMessageId(input: {
    meetupId: string;
    actorId: string;
    clientMessageId: string;
  }): Promise<MeetupChatMessage | null>;
  list(input: {
    meetupId: string;
    before?: Date;
    beforeId?: string;
    historyVisibleUntil?: Date;
    limit: number;
  }): Promise<MeetupChatMessage[]>;
}
