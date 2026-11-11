import { extname, basename } from 'node:path';
import { ChatError } from '../../domain/errors/chat.error';
import type {
  ChatAttachmentMetadata,
  ChatAttachmentView,
  ChatMediaResourceType,
  ChatMediaStoragePort,
} from '../ports/chat-media-storage.port';

export const MAX_CHAT_ATTACHMENT_COUNT = 5;
export const MAX_CHAT_ATTACHMENT_BYTES = 10 * 1024 * 1024;
export const MAX_CHAT_MESSAGE_ATTACHMENT_BYTES = 25 * 1024 * 1024;
export const CHAT_ATTACHMENT_URL_TTL_SECONDS = 15 * 60;

export interface IncomingChatFile {
  buffer: Buffer;
  originalName: string;
  mimeType: string;
  size: number;
}

const allowedMimeTypesByExtension: Record<string, string[]> = {
  '.jpg': ['image/jpeg'],
  '.jpeg': ['image/jpeg'],
  '.png': ['image/png'],
  '.gif': ['image/gif'],
  '.webp': ['image/webp'],
  '.pdf': ['application/pdf'],
  '.doc': ['application/msword'],
  '.docx': [
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  ],
  '.xls': ['application/vnd.ms-excel'],
  '.xlsx': [
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  ],
  '.ppt': ['application/vnd.ms-powerpoint'],
  '.pptx': [
    'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  ],
  '.txt': ['text/plain'],
  '.csv': ['text/csv', 'application/csv', 'text/plain'],
  '.md': ['text/markdown', 'text/plain'],
  '.zip': ['application/zip', 'application/x-zip-compressed'],
  '.rar': ['application/vnd.rar', 'application/x-rar-compressed'],
  '.7z': ['application/x-7z-compressed'],
  '.tar': ['application/x-tar'],
  '.gz': ['application/gzip', 'application/x-gzip'],
};

export class ChatAttachmentService {
  constructor(private readonly storage: ChatMediaStoragePort) {}

  async upload(files: IncomingChatFile[]): Promise<ChatAttachmentMetadata[]> {
    this.validateFiles(files);
    const uploaded: ChatAttachmentMetadata[] = [];
    try {
      for (const file of files) {
        const fileName = sanitizeFileName(file.originalName);
        uploaded.push(
          await this.storage.upload({
            buffer: file.buffer,
            fileName,
            mimeType: file.mimeType,
            resourceType: resourceTypeFor(file.mimeType),
          }),
        );
      }
      return uploaded;
    } catch (error) {
      await Promise.allSettled(
        uploaded.map((attachment) => this.storage.delete(attachment)),
      );
      throw error;
    }
  }

  async createViews(
    attachments: ChatAttachmentMetadata[],
  ): Promise<ChatAttachmentView[]> {
    const expiresAt = new Date(
      Date.now() + CHAT_ATTACHMENT_URL_TTL_SECONDS * 1000,
    );
    return Promise.all(
      attachments.map(async (attachment) => ({
        fileName: attachment.fileName,
        mimeType: attachment.mimeType,
        bytes: attachment.bytes,
        downloadUrl: await this.storage.createDownloadUrl(
          attachment,
          expiresAt,
        ),
        expiresAt: expiresAt.toISOString(),
      })),
    );
  }

  async delete(attachments: ChatAttachmentMetadata[]): Promise<void> {
    await Promise.allSettled(
      attachments.map((attachment) => this.storage.delete(attachment)),
    );
  }

  private validateFiles(files: IncomingChatFile[]): void {
    if (files.length > MAX_CHAT_ATTACHMENT_COUNT) {
      throw new ChatError(
        'INVALID_INPUT',
        `A message can contain at most ${MAX_CHAT_ATTACHMENT_COUNT} files`,
      );
    }
    const totalBytes = files.reduce((total, file) => total + file.size, 0);
    if (totalBytes > MAX_CHAT_MESSAGE_ATTACHMENT_BYTES) {
      throw new ChatError('INVALID_INPUT', 'Message attachments exceed 25 MB');
    }
    for (const file of files) validateFile(file);
  }
}

function validateFile(file: IncomingChatFile): void {
  if (!file.size || file.size > MAX_CHAT_ATTACHMENT_BYTES) {
    throw new ChatError(
      'INVALID_INPUT',
      'Each file must be between 1 byte and 10 MB',
    );
  }
  if (file.buffer.length !== file.size) {
    throw new ChatError('INVALID_INPUT', 'Uploaded file size is inconsistent');
  }
  const extension = extname(file.originalName).toLowerCase();
  const allowedMimeTypes = allowedMimeTypesByExtension[extension];
  if (!allowedMimeTypes || !allowedMimeTypes.includes(file.mimeType)) {
    throw new ChatError(
      'INVALID_INPUT',
      'File type is not allowed or does not match its extension',
    );
  }
  if (!matchesSignature(file.buffer, extension)) {
    throw new ChatError(
      'INVALID_INPUT',
      'File contents do not match the declared file type',
    );
  }
}

function matchesSignature(buffer: Buffer, extension: string): boolean {
  if (['.jpg', '.jpeg'].includes(extension)) {
    return (
      buffer.length >= 3 &&
      buffer[0] === 0xff &&
      buffer[1] === 0xd8 &&
      buffer[2] === 0xff
    );
  }
  if (extension === '.png')
    return buffer
      .subarray(0, 8)
      .equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]));
  if (extension === '.gif')
    return ['GIF87a', 'GIF89a'].includes(buffer.toString('ascii', 0, 6));
  if (extension === '.webp')
    return (
      buffer.toString('ascii', 0, 4) === 'RIFF' &&
      buffer.toString('ascii', 8, 12) === 'WEBP'
    );
  if (extension === '.pdf') return buffer.toString('ascii', 0, 5) === '%PDF-';
  if (['.doc', '.xls', '.ppt'].includes(extension))
    return buffer
      .subarray(0, 8)
      .equals(Buffer.from([0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1]));
  if (['.docx', '.xlsx', '.pptx', '.zip'].includes(extension))
    return buffer[0] === 0x50 && buffer[1] === 0x4b;
  if (extension === '.rar') return buffer.toString('ascii', 0, 4) === 'Rar!';
  if (extension === '.7z')
    return buffer
      .subarray(0, 6)
      .equals(Buffer.from([0x37, 0x7a, 0xbc, 0xaf, 0x27, 0x1c]));
  if (extension === '.gz') return buffer[0] === 0x1f && buffer[1] === 0x8b;
  if (extension === '.tar')
    return buffer.toString('ascii', 257, 262) === 'ustar';
  return isUtf8Text(buffer);
}

function isUtf8Text(buffer: Buffer): boolean {
  if (buffer.includes(0)) return false;
  const text = buffer.toString('utf8');
  return !text.includes('\uFFFD');
}

function resourceTypeFor(mimeType: string): ChatMediaResourceType {
  return mimeType.startsWith('image/') ? 'image' : 'raw';
}

function sanitizeFileName(value: string): string {
  const name = basename(value.replace(/\\/g, '/'))
    .replace(/\p{Cc}/gu, '')
    .trim();
  if (!name || name.length > 180) {
    throw new ChatError(
      'INVALID_INPUT',
      'File name must be 1 to 180 characters',
    );
  }
  return name;
}
