import { Check, Column, Entity, Index, PrimaryColumn } from 'typeorm';
import { MEETUP_STATUSES } from '../../../../domain/aggregates/meetup.aggregate';
import type {
  MeetupState,
  MeetupStatus,
  RecommendationMode,
} from '../../../../domain/aggregates/meetup.aggregate';

@Entity('meetup_sessions')
@Index('idx_meetups_organizer_status', ['organizerId', 'status'])
@Index('idx_meetups_schedule_status', ['scheduledAt', 'status'])
@Check('chk_meetups_radius', 'search_radius_m BETWEEN 100 AND 50000')
@Check('chk_meetups_deadline', 'invitation_deadline_at <= scheduled_at')
@Check('chk_meetups_mode', "recommendation_mode = 'balanced'")
@Check(
  'chk_meetups_closed_at',
  "(status = 'cancelled') = (cancelled_at IS NOT NULL) AND (status = 'finished') = (finished_at IS NOT NULL)",
)
export class MeetupEntity implements Omit<MeetupState, 'participants'> {
  @PrimaryColumn('uuid') id: string;
  @Column('uuid', { name: 'organizer_id' }) organizerId: string;
  @Column('varchar', { length: 150 }) title: string;
  @Column('varchar', { length: 1000, nullable: true }) description:
    string | null;
  @Column('timestamptz', { name: 'scheduled_at' }) scheduledAt: Date;
  @Column('timestamptz', { name: 'invitation_deadline_at' })
  invitationDeadlineAt: Date;
  @Column('integer', { name: 'search_radius_m' }) searchRadiusM: number;
  @Column('varchar', { name: 'place_type', length: 100 }) placeType: string;
  @Column('varchar', {
    name: 'recommendation_mode',
    length: 30,
    default: 'balanced',
  })
  recommendationMode: RecommendationMode;
  @Column('enum', {
    enum: [...MEETUP_STATUSES],
    enumName: 'meetup_status',
    default: 'inviting',
  })
  status: MeetupStatus;
  @Column('timestamptz', { name: 'cancelled_at', nullable: true })
  cancelledAt: Date | null;
  @Column('timestamptz', { name: 'finished_at', nullable: true })
  finishedAt: Date | null;
  @Column('timestamptz', { name: 'created_at' }) createdAt: Date;
  @Column('timestamptz', { name: 'updated_at' }) updatedAt: Date;
}
