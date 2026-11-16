import { Injectable, Inject } from '@nestjs/common';
import {
  FILE_STORAGE,
  type FileStoragePort,
} from '../../../../infrastructure/files/file-storage.port';
import type {
  ChatAttachmentMetadata,
  ChatMediaStoragePort,
} from '../../application/ports/chat-media-storage.port';
@Injectable()
export class ChatFileStorageAdapter implements ChatMediaStoragePort {
  constructor(@Inject(FILE_STORAGE) private readonly files: FileStoragePort) {}
  async upload(input: {
    buffer: Buffer;
    fileName: string;
    mimeType: string;
    resourceType: 'image' | 'raw';
    storageKey: string;
  }): Promise<ChatAttachmentMetadata> {
    const file = await this.files.upload({
      buffer: input.buffer,
      fileName: input.fileName,
      resourceType: input.resourceType,
      key: input.storageKey,
    });
    return {
      storageProvider: file.provider,
      storageKey: file.key,
      resourceType: file.resourceType,
      format: file.format,
      fileName: input.fileName,
      mimeType: input.mimeType,
      bytes: file.bytes,
    };
  }
  createDownloadUrl(
    attachment: ChatAttachmentMetadata,
    expiresAt: Date,
  ): Promise<string> {
    return this.files.createPrivateDownloadUrl(
      {
        provider: attachment.storageProvider,
        key: attachment.storageKey,
        resourceType: attachment.resourceType,
        format: attachment.format,
        bytes: attachment.bytes,
      },
      expiresAt,
    );
  }
  delete(attachment: ChatAttachmentMetadata): Promise<void> {
    return this.files.delete({
      provider: attachment.storageProvider,
      key: attachment.storageKey,
      resourceType: attachment.resourceType,
      format: attachment.format,
      bytes: attachment.bytes,
    });
  }
}
