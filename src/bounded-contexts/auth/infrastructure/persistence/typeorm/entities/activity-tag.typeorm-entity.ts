import { Column, Entity, PrimaryColumn } from 'typeorm';

@Entity('activity_tags')
export class ActivityTagEntity {
  @PrimaryColumn('smallint')
  id: number;

  @Column('varchar', { length: 50, unique: true })
  code: string;

  @Column('varchar', { name: 'display_name', length: 100 })
  displayName: string;

  @Column('boolean', { name: 'is_active', default: true })
  isActive: boolean;
}
