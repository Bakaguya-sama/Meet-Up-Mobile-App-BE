import { Check, Column, Entity, Index, PrimaryColumn } from 'typeorm';
import type { ChatAttachmentMetadata } from '../../../../application/ports/chat-media-storage.port';

@Entity('direct_chat_messages')
@Index('idx_direct_chat_messages_conversation_sent', [
  'conversationId',
  'sentAt',
  'id',
])
@Check(
  'chk_direct_chat_message_content',
  '(length(trim(text_content)) BETWEEN 1 AND 2000) OR (length(trim(text_content)) = 0 AND jsonb_array_length(attachments) > 0)',
)
export class DirectChatMessageEntity {
  @PrimaryColumn('uuid') id: string;
  @Column('uuid', { name: 'conversation_id' }) conversationId: string;
  @Column('uuid', { name: 'sender_user_id' }) senderUserId: string;
  @Column('varchar', { name: 'text_content', length: 2000 })
  textContent: string;
  @Column('timestamptz', { name: 'sent_at' }) sentAt: Date;
  @Column('jsonb', { default: () => "'[]'::jsonb" })
  attachments: ChatAttachmentMetadata[];
}
