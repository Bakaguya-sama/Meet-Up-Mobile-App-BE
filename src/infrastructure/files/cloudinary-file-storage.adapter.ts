import { Injectable, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { v2 as cloudinary } from 'cloudinary';
import { extname } from 'node:path';
import type { FileStoragePort, StoredFile } from './file-storage.port';

@Injectable()
export class CloudinaryFileStorageAdapter implements FileStoragePort {
  private readonly enabled: boolean;
  private readonly rootFolder: string;

  constructor(config: ConfigService) {
    this.enabled = config.get<boolean>('cloudinary.enabled') ?? false;
    this.rootFolder = config
      .getOrThrow<string>('files.rootFolder')
      .replace(/^\/+|\/+$/g, '');
    if (this.enabled)
      cloudinary.config({
        cloud_name: config.getOrThrow<string>('cloudinary.cloudName'),
        api_key: config.getOrThrow<string>('cloudinary.apiKey'),
        api_secret: config.getOrThrow<string>('cloudinary.apiSecret'),
        secure: true,
      });
  }
  async upload(input: {
    buffer: Buffer;
    fileName: string;
    resourceType: 'image' | 'raw';
    key: string;
  }): Promise<StoredFile> {
    this.assertEnabled();
    const semanticKey =
      input.resourceType === 'raw'
        ? `${input.key}${extname(input.fileName).toLowerCase()}`
        : input.key;
    const publicId = `${this.rootFolder}/${semanticKey.replace(/^\/+/, '')}`;
    const response = await new Promise<{
      public_id: string;
      format: string;
      bytes: number;
    }>((resolve, reject) => {
      const stream = cloudinary.uploader.upload_stream(
        {
          public_id: publicId,
          resource_type: input.resourceType,
          type: 'authenticated',
          filename_override: input.fileName,
          use_filename: false,
          unique_filename: false,
          overwrite: true,
        },
        (error, value) =>
          error
            ? reject(new Error('Cloudinary upload failed'))
            : value
              ? resolve(value)
              : reject(new Error('Cloudinary returned no asset')),
      );
      stream.end(input.buffer);
    });
    return {
      provider: 'cloudinary',
      key: response.public_id,
      resourceType: input.resourceType,
      format: response.format,
      bytes: response.bytes,
    };
  }
  async createPrivateDownloadUrl(
    input: StoredFile,
    expiresAt: Date,
  ): Promise<string> {
    this.assertEnabled();
    return cloudinary.utils.private_download_url(input.key, input.format, {
      resource_type: input.resourceType,
      type: 'authenticated',
      expires_at: Math.floor(expiresAt.getTime() / 1000),
      attachment: input.resourceType === 'raw',
    });
  }
  async delete(input: StoredFile): Promise<void> {
    if (this.enabled)
      await cloudinary.uploader.destroy(input.key, {
        resource_type: input.resourceType,
        type: 'authenticated',
        invalidate: true,
      });
  }
  private assertEnabled(): void {
    if (!this.enabled)
      throw new ServiceUnavailableException('File storage is not configured');
  }
}
