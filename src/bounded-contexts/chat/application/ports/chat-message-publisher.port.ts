import type { MeetupChatMessageView } from './meetup-chat-store.port';

export const CHAT_MESSAGE_PUBLISHER = Symbol('CHAT_MESSAGE_PUBLISHER');

export interface ChatMessagePublisherPort {
  publish(message: MeetupChatMessageView): Promise<void>;
}
