import { Column, Entity, Index, PrimaryColumn } from 'typeorm';
import type { ChatMediaResourceType } from '../../../../application/ports/chat-media-storage.port';

@Entity('chat_message_attachments')
@Index('uq_chat_message_attachments_order', ['messageId', 'sortOrder'], {
  unique: true,
})
@Index(
  'uq_chat_message_attachments_storage',
  ['storageProvider', 'storageKey'],
  { unique: true },
)
export class ChatMessageAttachmentEntity {
  @PrimaryColumn('uuid') id: string;
  @Column('uuid', { name: 'message_id' }) messageId: string;
  @Column('varchar', { name: 'storage_provider', length: 30 })
  storageProvider: 'cloudinary';
  @Column('varchar', { name: 'storage_key', length: 500 }) storageKey: string;
  @Column('varchar', { name: 'resource_type', length: 20 })
  resourceType: ChatMediaResourceType;
  @Column('varchar', { length: 30 }) format: string;
  @Column('varchar', { name: 'original_file_name', length: 180 })
  fileName: string;
  @Column('varchar', { name: 'mime_type', length: 150 }) mimeType: string;
  @Column('bigint', {
    transformer: {
      from: (value: string) => Number(value),
      to: (value: number) => value,
    },
  })
  bytes: number;
  @Column('smallint', { name: 'sort_order' }) sortOrder: number;
  @Column('timestamptz', { name: 'created_at' }) createdAt: Date;
}
