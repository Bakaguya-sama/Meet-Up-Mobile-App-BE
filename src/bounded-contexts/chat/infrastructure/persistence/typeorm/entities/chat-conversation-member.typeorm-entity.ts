import { Column, Entity, Index, PrimaryColumn } from 'typeorm';

@Entity('chat_conversation_members')
@Index('idx_chat_conversation_members_user', [
  'userId',
  'leftAt',
  'conversationId',
])
export class ChatConversationMemberEntity {
  @PrimaryColumn('uuid', { name: 'conversation_id' }) conversationId: string;
  @PrimaryColumn('uuid', { name: 'user_id' }) userId: string;
  @Column('timestamptz', { name: 'joined_at' }) joinedAt: Date;
  @Column('timestamptz', { name: 'left_at', nullable: true })
  leftAt: Date | null;
  @Column('timestamptz', { name: 'history_visible_until', nullable: true })
  historyVisibleUntil: Date | null;
  @Column('uuid', { name: 'last_read_message_id', nullable: true })
  lastReadMessageId: string | null;
  @Column('timestamptz', { name: 'last_read_at', nullable: true })
  lastReadAt: Date | null;
}
