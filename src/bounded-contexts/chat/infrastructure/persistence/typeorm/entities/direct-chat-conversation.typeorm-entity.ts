import { Check, Column, Entity, Index, PrimaryColumn } from 'typeorm';

@Entity('direct_chat_conversations')
@Check('chk_direct_chat_sorted_pair', 'user_a_id < user_b_id')
@Index('uq_direct_chat_conversations_pair', ['userAId', 'userBId'], {
  unique: true,
})
export class DirectChatConversationEntity {
  @PrimaryColumn('uuid') id: string;
  @Column('uuid', { name: 'user_a_id' }) userAId: string;
  @Column('uuid', { name: 'user_b_id' }) userBId: string;
  @Column('timestamptz', { name: 'created_at' }) createdAt: Date;
}
