export type ChatMediaResourceType = 'image' | 'raw';

export interface ChatAttachmentMetadata {
  storageProvider: 'cloudinary';
  storageKey: string;
  resourceType: ChatMediaResourceType;
  format: string;
  fileName: string;
  mimeType: string;
  bytes: number;
}

export interface ChatAttachmentView {
  fileName: string;
  mimeType: string;
  bytes: number;
  downloadUrl: string;
  expiresAt: string;
}

export interface ChatMediaStoragePort {
  upload(input: {
    buffer: Buffer;
    fileName: string;
    mimeType: string;
    resourceType: ChatMediaResourceType;
    storageKey: string;
  }): Promise<ChatAttachmentMetadata>;
  createDownloadUrl(
    attachment: ChatAttachmentMetadata,
    expiresAt: Date,
  ): Promise<string>;
  delete(attachment: ChatAttachmentMetadata): Promise<void>;
}

export const CHAT_MEDIA_STORAGE = Symbol('CHAT_MEDIA_STORAGE');
