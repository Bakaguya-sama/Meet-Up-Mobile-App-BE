import { Column, Entity, Index, PrimaryColumn } from 'typeorm';

@Entity('chat_messages')
@Index('idx_chat_messages_conversation_sent', [
  'conversationId',
  'sentAt',
  'id',
])
@Index(
  'uq_chat_messages_sender_client',
  ['conversationId', 'senderUserId', 'clientMessageId'],
  { unique: true },
)
export class ChatMessageEntity {
  @PrimaryColumn('uuid') id: string;
  @Column('uuid', { name: 'conversation_id' }) conversationId: string;
  @Column('uuid', { name: 'sender_user_id' }) senderUserId: string;
  @Column('uuid', { name: 'client_message_id' }) clientMessageId: string;
  @Column('varchar', { name: 'text_content', length: 2000, default: '' })
  textContent: string;
  @Column('timestamptz', { name: 'sent_at' }) sentAt: Date;
}
