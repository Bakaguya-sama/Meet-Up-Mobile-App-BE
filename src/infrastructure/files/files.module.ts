import { Global, Module } from '@nestjs/common';
import { CloudinaryFileStorageAdapter } from './cloudinary-file-storage.adapter';
import { FILE_STORAGE } from './file-storage.port';
@Global()
@Module({
  providers: [
    CloudinaryFileStorageAdapter,
    { provide: FILE_STORAGE, useExisting: CloudinaryFileStorageAdapter },
  ],
  exports: [FILE_STORAGE],
})
export class FilesModule {}
