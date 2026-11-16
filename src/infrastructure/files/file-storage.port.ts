export type FileResourceType = 'image' | 'raw';

export interface StoredFile {
  provider: 'cloudinary';
  key: string;
  resourceType: FileResourceType;
  format: string;
  bytes: number;
}

export interface FileStoragePort {
  upload(input: {
    buffer: Buffer;
    fileName: string;
    resourceType: FileResourceType;
    key: string;
  }): Promise<StoredFile>;
  createPrivateDownloadUrl(input: StoredFile, expiresAt: Date): Promise<string>;
  delete(input: StoredFile): Promise<void>;
}

export const FILE_STORAGE = Symbol('FILE_STORAGE');
