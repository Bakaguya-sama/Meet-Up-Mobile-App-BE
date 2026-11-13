import { FriendshipReader } from '../../../friends/application/public/friendship-reader';
import type {
  DirectChatMessage,
  DirectChatStore,
} from '../ports/direct-chat-store.port';
import { ChatAttachmentService } from '../services/chat-attachment.service';
import { SendDirectChatMessageUseCase } from './send-direct-chat-message.use-case';

describe('SendDirectChatMessageUseCase', () => {
  const actorId = '00000000-0000-4000-8000-000000000001';
  const peerId = '00000000-0000-4000-8000-000000000002';
  const clientMessageId = '00000000-0000-4000-8000-000000000005';
  let friendships: jest.Mocked<Pick<FriendshipReader, 'areAccepted'>>;
  let store: jest.Mocked<DirectChatStore>;
  let attachments: jest.Mocked<
    Pick<ChatAttachmentService, 'upload' | 'createViews' | 'delete'>
  >;
  let useCase: SendDirectChatMessageUseCase;

  beforeEach(() => {
    friendships = { areAccepted: jest.fn().mockResolvedValue(true) };
    const message: DirectChatMessage = {
      id: '00000000-0000-4000-8000-000000000003',
      conversationId: '00000000-0000-4000-8000-000000000004',
      senderUserId: actorId,
      recipientUserId: peerId,
      clientMessageId,
      textContent: 'hello',
      sentAt: new Date('2026-01-01T00:00:00Z'),
      attachments: [],
    };
    store = {
      append: jest.fn().mockResolvedValue(message),
      findByClientMessageId: jest.fn().mockResolvedValue(null),
      list: jest.fn(),
      hasConversation: jest.fn(),
    };
    attachments = {
      upload: jest.fn().mockResolvedValue([]),
      createViews: jest.fn().mockResolvedValue([]),
      delete: jest.fn().mockResolvedValue(undefined),
    };
    useCase = new SendDirectChatMessageUseCase(
      store,
      friendships as FriendshipReader,
      attachments as ChatAttachmentService,
    );
  });

  it('persists an outbox-ready message for accepted friends', async () => {
    await useCase.execute({ actorId, peerId, clientMessageId, text: 'hello' });
    expect(store.append.mock.calls).toHaveLength(1);
  });

  it('rejects before reading or writing when the friendship is not accepted', async () => {
    friendships.areAccepted.mockResolvedValue(false);
    await expect(
      useCase.execute({ actorId, peerId, clientMessageId, text: 'hello' }),
    ).rejects.toMatchObject({ code: 'DIRECT_CHAT_FORBIDDEN' });
    expect(store.append.mock.calls).toHaveLength(0);
  });

  it('returns the existing message without checking friendship or uploading again', async () => {
    store.findByClientMessageId.mockResolvedValue({
      id: '00000000-0000-4000-8000-000000000003',
      conversationId: '00000000-0000-4000-8000-000000000004',
      senderUserId: actorId,
      recipientUserId: peerId,
      clientMessageId,
      textContent: 'hello',
      sentAt: new Date('2026-01-01T00:00:00Z'),
      attachments: [],
    });
    await useCase.execute({
      actorId,
      peerId,
      clientMessageId,
      text: 'changed',
    });
    expect(friendships.areAccepted).not.toHaveBeenCalled();
    expect(attachments.upload).not.toHaveBeenCalled();
    expect(store.append.mock.calls).toHaveLength(0);
  });
});
