import { Column, Entity, Index, OneToMany, PrimaryColumn } from 'typeorm';
import { UserPreferenceTagEntity } from './user-preference-tag.typeorm-entity';

@Entity('user_preferences')
export class UserPreferenceEntity {
  @PrimaryColumn('uuid')
  id: string;

  @Column('uuid', { name: 'user_id' })
  @Index('uq_user_preferences_user_id', { unique: true })
  userId: string;

  @Column('timestamptz', { name: 'updated_at' })
  updatedAt: Date;

  @OneToMany(() => UserPreferenceTagEntity, (tag) => tag.userPreference, {
    cascade: true,
  })
  tags: UserPreferenceTagEntity[];
}
