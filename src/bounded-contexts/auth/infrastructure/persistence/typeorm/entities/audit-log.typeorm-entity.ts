import { Column, Entity, Index, PrimaryColumn } from 'typeorm';

@Entity('audit_logs')
@Index('idx_audit_logs_subject_created', [
  'subjectType',
  'subjectId',
  'createdAt',
])
export class AuditLogEntity {
  @PrimaryColumn('uuid') id: string;
  @Column('uuid', { name: 'actor_id' }) actorId: string;
  @Column('varchar', { length: 100 }) action: string;
  @Column('varchar', { name: 'subject_type', length: 100 }) subjectType: string;
  @Column('uuid', { name: 'subject_id' }) subjectId: string;
  @Column('jsonb', { name: 'metadata_json', default: () => "'{}'::jsonb" })
  metadataJson: Record<string, string | boolean>;
  @Column('timestamptz', { name: 'created_at' }) createdAt: Date;
}
