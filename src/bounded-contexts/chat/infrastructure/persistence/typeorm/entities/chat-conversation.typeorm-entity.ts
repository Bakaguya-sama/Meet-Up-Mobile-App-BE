import { Column, Entity, Index, PrimaryColumn } from 'typeorm';

export type ChatConversationType = 'direct' | 'meetup';

@Entity('chat_conversations')
@Index('uq_chat_conversations_meetup', ['meetupId'], {
  unique: true,
  where: "type = 'meetup'",
})
@Index(
  'uq_chat_conversations_direct_pair',
  ['directUserAId', 'directUserBId'],
  { unique: true, where: "type = 'direct'" },
)
export class ChatConversationEntity {
  @PrimaryColumn('uuid') id: string;
  @Column('varchar', { length: 20 }) type: ChatConversationType;
  @Column('uuid', { name: 'meetup_id', nullable: true }) meetupId:
    string | null;
  @Column('uuid', { name: 'direct_user_a_id', nullable: true })
  directUserAId: string | null;
  @Column('uuid', { name: 'direct_user_b_id', nullable: true })
  directUserBId: string | null;
  @Column('uuid', { name: 'last_message_id', nullable: true })
  lastMessageId: string | null;
  @Column('timestamptz', { name: 'last_message_at', nullable: true })
  lastMessageAt: Date | null;
  @Column('timestamptz', { name: 'created_at' }) createdAt: Date;
}
