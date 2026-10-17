import { Check, Column, Entity, Index, PrimaryColumn } from 'typeorm';
import { PARTICIPANT_STATUSES } from '../../../../domain/aggregates/meetup.aggregate';
import type {
  ParticipantState,
  ParticipantStatus,
} from '../../../../domain/aggregates/meetup.aggregate';

@Entity('meetup_participants')
@Index('uq_meetup_participants_user', ['meetupId', 'userId'], { unique: true })
@Index('idx_meetup_participants_user_status', ['userId', 'status'])
@Check(
  'chk_participants_dates',
  "(status <> 'invited' OR (responded_at IS NULL AND joined_at IS NULL AND left_at IS NULL)) AND (status <> 'accepted' OR (responded_at IS NOT NULL AND joined_at IS NOT NULL AND left_at IS NULL)) AND (status <> 'declined' OR (responded_at IS NOT NULL AND joined_at IS NULL AND left_at IS NULL)) AND (status NOT IN ('left','removed') OR left_at IS NOT NULL) AND (status <> 'left' OR joined_at IS NOT NULL)",
)
export class ParticipantEntity implements ParticipantState {
  @PrimaryColumn('uuid') id: string;
  @Column('uuid', { name: 'meetup_id' }) meetupId: string;
  @Column('uuid', { name: 'user_id' }) userId: string;
  @Column('enum', {
    enum: [...PARTICIPANT_STATUSES],
    enumName: 'meetup_member_status',
    default: 'invited',
  })
  status: ParticipantStatus;
  @Column('uuid', { name: 'invited_by_id' }) invitedById: string;
  @Column('timestamptz', { name: 'responded_at', nullable: true })
  respondedAt: Date | null;
  @Column('timestamptz', { name: 'joined_at', nullable: true })
  joinedAt: Date | null;
  @Column('timestamptz', { name: 'left_at', nullable: true })
  leftAt: Date | null;
}
