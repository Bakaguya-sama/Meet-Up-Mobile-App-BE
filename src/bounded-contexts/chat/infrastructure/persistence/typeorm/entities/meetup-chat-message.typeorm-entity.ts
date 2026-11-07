import { Check, Column, Entity, Index, PrimaryColumn } from 'typeorm';

@Entity('meetup_chat_messages')
@Index('idx_meetup_chat_messages_meetup_sent', ['meetupId', 'sentAt', 'id'])
@Check(
  'chk_meetup_chat_message_text',
  'length(trim(text_content)) BETWEEN 1 AND 2000',
)
export class MeetupChatMessageEntity {
  @PrimaryColumn('uuid') id: string;
  @Column('uuid', { name: 'meetup_id' }) meetupId: string;
  @Column('uuid', { name: 'sender_user_id' }) senderUserId: string;
  @Column('varchar', { name: 'text_content', length: 2000 })
  textContent: string;
  @Column('timestamptz', { name: 'sent_at' }) sentAt: Date;
}
