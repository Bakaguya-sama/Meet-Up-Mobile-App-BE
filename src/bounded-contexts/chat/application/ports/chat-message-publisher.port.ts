import type { MeetupChatMessage } from './meetup-chat-store.port';

export const CHAT_MESSAGE_PUBLISHER = Symbol('CHAT_MESSAGE_PUBLISHER');

export interface ChatMessagePublisherPort {
  publish(message: MeetupChatMessage): Promise<void>;
}
