import { Column, Entity, JoinColumn, ManyToOne, PrimaryColumn } from 'typeorm';
import { UserPreferenceEntity } from './user-preference.typeorm-entity';
import { ActivityTagEntity } from './activity-tag.typeorm-entity';

@Entity('user_preference_tags')
export class UserPreferenceTagEntity {
  @PrimaryColumn('uuid', { name: 'user_preference_id' })
  userPreferenceId: string;

  @PrimaryColumn('smallint', { name: 'activity_tag_id' })
  activityTagId: number;

  @Column({
    type: 'enum',
    enum: ['high', 'normal', 'avoid'],
    enumName: 'preference_level',
    default: 'normal',
  })
  level: 'high' | 'normal' | 'avoid';

  @Column('timestamptz', { name: 'created_at' })
  createdAt: Date;

  @ManyToOne(() => UserPreferenceEntity, (pref) => pref.tags, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'user_preference_id' })
  userPreference?: UserPreferenceEntity;

  @ManyToOne(() => ActivityTagEntity, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'activity_tag_id' })
  activityTag?: ActivityTagEntity;
}
