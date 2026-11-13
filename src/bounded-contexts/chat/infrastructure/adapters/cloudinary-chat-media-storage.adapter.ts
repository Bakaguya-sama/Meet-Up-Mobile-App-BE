import { Injectable, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { v2 as cloudinary } from 'cloudinary';
import { extname } from 'node:path';
import type {
  ChatAttachmentMetadata,
  ChatMediaStoragePort,
} from '../../application/ports/chat-media-storage.port';

@Injectable()
export class CloudinaryChatMediaStorageAdapter implements ChatMediaStoragePort {
  private readonly enabled: boolean;

  constructor(config: ConfigService) {
    this.enabled = config.get<boolean>('cloudinary.enabled') ?? false;
    if (this.enabled) {
      cloudinary.config({
        cloud_name: config.getOrThrow<string>('cloudinary.cloudName'),
        api_key: config.getOrThrow<string>('cloudinary.apiKey'),
        api_secret: config.getOrThrow<string>('cloudinary.apiSecret'),
        secure: true,
      });
    }
  }

  async upload(input: {
    buffer: Buffer;
    fileName: string;
    mimeType: string;
    resourceType: 'image' | 'raw';
    storageKey: string;
  }): Promise<ChatAttachmentMetadata> {
    this.assertEnabled();
    const cloudinaryPublicId =
      input.resourceType === 'raw'
        ? `${input.storageKey}${extname(input.fileName).toLowerCase()}`
        : input.storageKey;
    const result = await new Promise<{
      public_id: string;
      format: string;
      bytes: number;
    }>((resolve, reject) => {
      const upload = cloudinary.uploader.upload_stream(
        {
          public_id: cloudinaryPublicId,
          resource_type: input.resourceType,
          type: 'authenticated',
          filename_override: input.fileName,
          use_filename: false,
          unique_filename: false,
          overwrite: true,
        },
        (error, response) => {
          if (error) {
            return reject(new Error('Cloudinary upload failed'));
          }
          if (!response)
            return reject(new Error('Cloudinary returned no asset'));
          resolve(response);
        },
      );
      upload.end(input.buffer);
    });

    return {
      storageProvider: 'cloudinary',
      storageKey: result.public_id,
      resourceType: input.resourceType,
      format: result.format,
      fileName: input.fileName,
      mimeType: input.mimeType,
      bytes: result.bytes,
    };
  }

  createDownloadUrl(
    attachment: ChatAttachmentMetadata,
    expiresAt: Date,
  ): Promise<string> {
    this.assertEnabled();
    return Promise.resolve(
      cloudinary.utils.private_download_url(
        attachment.storageKey,
        attachment.format,
        {
          resource_type: attachment.resourceType,
          type: 'authenticated',
          expires_at: Math.floor(expiresAt.getTime() / 1000),
          attachment: attachment.resourceType === 'raw',
        },
      ),
    );
  }

  async delete(attachment: ChatAttachmentMetadata): Promise<void> {
    if (!this.enabled) return;
    await cloudinary.uploader.destroy(attachment.storageKey, {
      resource_type: attachment.resourceType,
      type: 'authenticated',
      invalidate: true,
    });
  }

  private assertEnabled(): void {
    if (!this.enabled) {
      throw new ServiceUnavailableException(
        'Chat file storage is not configured',
      );
    }
  }
}
