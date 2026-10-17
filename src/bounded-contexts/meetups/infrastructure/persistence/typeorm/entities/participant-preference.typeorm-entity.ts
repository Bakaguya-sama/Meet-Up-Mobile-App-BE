import { Check, Column, Entity, Index, PrimaryColumn } from 'typeorm';
import type {
  PreferenceLevel,
  PreferenceSource,
} from '../../../../domain/aggregates/meetup.aggregate';

@Entity('meetup_participant_preferences')
@Index('idx_meetup_participant_preferences_participant_id', [
  'meetupParticipantId',
])
@Check(
  'chk_preference_source',
  "source IN ('meetup_input', 'profile_fallback')",
)
export class ParticipantPreferenceEntity {
  @PrimaryColumn('uuid', { name: 'meetup_participant_id' })
  meetupParticipantId: string;

  @PrimaryColumn('smallint', { name: 'activity_tag_id' })
  activityTagId: number;

  @Column({
    type: 'enum',
    enum: ['high', 'normal', 'avoid'],
    enumName: 'preference_level',
    default: 'normal',
  })
  level: PreferenceLevel;

  @Column('varchar', { length: 30, default: 'meetup_input' })
  source: PreferenceSource;

  @Column('timestamptz', { name: 'updated_at' })
  updatedAt: Date;
}
