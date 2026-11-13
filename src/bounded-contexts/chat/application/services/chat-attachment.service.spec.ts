import { ChatError } from '../../domain/errors/chat.error';
import type {
  ChatAttachmentMetadata,
  ChatMediaStoragePort,
} from '../ports/chat-media-storage.port';
import { ChatAttachmentService } from './chat-attachment.service';

describe('ChatAttachmentService', () => {
  const uploaded: ChatAttachmentMetadata = {
    storageProvider: 'cloudinary',
    storageKey: 'chat/meetup/test/message/0.pdf',
    resourceType: 'raw',
    format: 'pdf',
    fileName: 'agenda.pdf',
    mimeType: 'application/pdf',
    bytes: 5,
  };
  let storage: jest.Mocked<ChatMediaStoragePort>;
  let service: ChatAttachmentService;

  beforeEach(() => {
    storage = {
      upload: jest.fn().mockResolvedValue(uploaded),
      createDownloadUrl: jest
        .fn()
        .mockResolvedValue('https://files.example/signed'),
      delete: jest.fn().mockResolvedValue(undefined),
    };
    service = new ChatAttachmentService(storage);
  });

  it('accepts a supported PDF and returns private expiring view data', async () => {
    const [attachment] = await service.upload(
      [
        {
          buffer: Buffer.from('%PDF-'),
          originalName: 'agenda.pdf',
          mimeType: 'application/pdf',
          size: 5,
        },
      ],
      { scope: 'meetup/test', clientMessageId: 'message' },
    );

    const [view] = await service.createViews([attachment]);
    expect(view).toMatchObject({
      fileName: 'agenda.pdf',
      mimeType: 'application/pdf',
      downloadUrl: 'https://files.example/signed',
    });
    expect(new Date(view.expiresAt).getTime()).toBeGreaterThan(Date.now());
  });

  it('rejects a disguised executable before storage is called', async () => {
    await expect(
      service.upload(
        [
          {
            buffer: Buffer.from('MZ executable'),
            originalName: 'notes.pdf',
            mimeType: 'application/pdf',
            size: 13,
          },
        ],
        { scope: 'meetup/test', clientMessageId: 'message' },
      ),
    ).rejects.toBeInstanceOf(ChatError);
    expect(storage.upload.mock.calls).toHaveLength(0);
  });

  it('cleans up already uploaded files when a later upload fails', async () => {
    storage.upload
      .mockResolvedValueOnce(uploaded)
      .mockRejectedValueOnce(new Error('storage unavailable'));

    await expect(
      service.upload(
        [
          {
            buffer: Buffer.from('%PDF-'),
            originalName: 'one.pdf',
            mimeType: 'application/pdf',
            size: 5,
          },
          {
            buffer: Buffer.from('%PDF-'),
            originalName: 'two.pdf',
            mimeType: 'application/pdf',
            size: 5,
          },
        ],
        { scope: 'meetup/test', clientMessageId: 'message' },
      ),
    ).rejects.toThrow('storage unavailable');
    expect(storage.delete.mock.calls).toContainEqual([uploaded]);
  });

  it('uses a deterministic storage key for idempotent retries', async () => {
    await service.upload(
      [
        {
          buffer: Buffer.from('%PDF-'),
          originalName: 'agenda.pdf',
          mimeType: 'application/pdf',
          size: 5,
        },
      ],
      { scope: 'direct/a/b', clientMessageId: 'client-id' },
    );
    expect(storage.upload.mock.calls[0]?.[0].storageKey).toMatch(
      /^chat\/direct\/a\/b\/client-id\/0-[0-9a-f]{24}$/,
    );
  });
});
