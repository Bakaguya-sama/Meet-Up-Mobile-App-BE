import { ChatError } from '../../domain/errors/chat.error';
import type { DirectChatStore } from '../ports/direct-chat-store.port';
import type { FriendshipReader } from '../../../friends/application/public/friendship-reader';
import type { ChatAttachmentService } from '../services/chat-attachment.service';
import { ListDirectChatMessagesQuery } from './list-direct-chat-messages.query';

describe('ListDirectChatMessagesQuery', () => {
  const store = {
    hasConversation: jest.fn(),
    list: jest.fn(),
  } as unknown as jest.Mocked<DirectChatStore>;
  const friendships = {
    areAccepted: jest.fn(),
  } as unknown as jest.Mocked<FriendshipReader>;
  const attachments = {
    createViews: jest.fn(),
  } as unknown as jest.Mocked<ChatAttachmentService>;
  const query = new ListDirectChatMessagesQuery(
    store,
    friendships,
    attachments,
  );

  beforeEach(() => jest.resetAllMocks());

  it('retains read-only history after a relationship is no longer accepted', async () => {
    friendships.areAccepted.mockResolvedValue(false);
    store.hasConversation.mockResolvedValue(true);
    store.list.mockResolvedValue([]);
    await expect(
      query.execute({ actorId: 'a', peerId: 'b', limit: 20 }),
    ).resolves.toEqual([]);
  });

  it('does not disclose whether a stranger has a conversation', async () => {
    friendships.areAccepted.mockResolvedValue(false);
    store.hasConversation.mockResolvedValue(false);
    await expect(
      query.execute({ actorId: 'a', peerId: 'b', limit: 20 }),
    ).rejects.toBeInstanceOf(ChatError);
    expect(store.list.mock.calls).toHaveLength(0);
  });
});
