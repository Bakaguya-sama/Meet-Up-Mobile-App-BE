import type { DirectChatMessageView } from './direct-chat-store.port';

export interface DirectChatMessagePublisherPort {
  publish(message: DirectChatMessageView): Promise<void>;
}

export const DIRECT_CHAT_MESSAGE_PUBLISHER = Symbol(
  'DIRECT_CHAT_MESSAGE_PUBLISHER',
);
