import {
  Check,
  Column,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  OneToMany,
  PrimaryColumn,
  Unique,
} from 'typeorm';
import { UserAccountEntity } from '../../../../../auth/infrastructure/persistence/typeorm/entities/user-account.typeorm-entity';
import { MeetupEntity } from '../../../../../meetups/infrastructure/persistence/typeorm/entities/meetup.typeorm-entity';
import type { RecommendationRunStatus } from '../../../../domain/recommendation-run';
import { RecommendationCandidateEntity } from './recommendation-candidate.typeorm-entity';

@Entity('recommendation_runs')
@Unique('uq_recommendation_runs_request', ['meetupId', 'requestId'])
@Index('idx_recommendation_runs_meetup_created', ['meetupId', 'createdAt'])
@Check('chk_recommendation_runs_requested_k', 'requested_k > 0')
@Check(
  'chk_recommendation_runs_status',
  "status IN ('RUNNING','COMPLETED','FAILED')",
)
@Check(
  'chk_recommendation_runs_effective_k',
  'effective_k IS NULL OR (effective_k > 0 AND effective_k <= requested_k)',
)
@Check(
  'chk_recommendation_runs_route_counts',
  '(route_batch_count IS NULL OR route_batch_count >= 0) AND (route_element_count IS NULL OR route_element_count >= 0)',
)
export class RecommendationRunEntity {
  @PrimaryColumn('uuid') id: string;
  @Column('uuid', { name: 'meetup_id' }) meetupId: string;
  @Column('uuid', { name: 'request_id' }) requestId: string;
  @Column('char', { name: 'payload_hash', length: 64 }) payloadHash: string;
  @Column('uuid', { name: 'requested_by_id' }) requestedById: string;
  @Column('smallint', { name: 'requested_k' }) requestedK: number;
  @Column('varchar', { length: 20 }) status: RecommendationRunStatus;
  @Column('varchar', { name: 'failure_code', length: 100, nullable: true })
  failureCode: string | null;
  @Column('varchar', { name: 'ranking_strategy', length: 50 })
  rankingStrategy: 'fair-pareto-v1';
  @Column('varchar', { name: 'algorithm_version', length: 100 })
  algorithmVersion: string;
  @Column('varchar', { name: 'config_version', length: 100 })
  configVersion: string;
  @Column('varchar', { name: 'feature_schema_version', length: 100 })
  featureSchemaVersion: string;
  @Column('varchar', { name: 'provider_mapping_version', length: 100 })
  providerMappingVersion: string;
  @Column('timestamptz', { name: 'created_at' }) createdAt: Date;
  @Column('timestamptz', { name: 'completed_at', nullable: true })
  completedAt: Date | null;
  @Column('smallint', { name: 'effective_k', nullable: true })
  effectiveK: number | null;
  @Column('jsonb', { default: () => "'[]'::jsonb" })
  warnings: string[];
  @Column('varchar', { name: 'random_seed', length: 100, nullable: true })
  randomSeed: string | null;
  @Column('integer', { name: 'route_batch_count', nullable: true })
  routeBatchCount: number | null;
  @Column('integer', { name: 'route_element_count', nullable: true })
  routeElementCount: number | null;
  @OneToMany(() => RecommendationCandidateEntity, (candidate) => candidate.run)
  candidates?: RecommendationCandidateEntity[];
  @ManyToOne(() => MeetupEntity, { nullable: false })
  @JoinColumn({
    name: 'meetup_id',
    foreignKeyConstraintName: 'recommendation_runs_meetup_id_fkey',
  })
  meetup?: MeetupEntity;
  @ManyToOne(() => UserAccountEntity, { nullable: false })
  @JoinColumn({
    name: 'requested_by_id',
    foreignKeyConstraintName: 'recommendation_runs_requested_by_id_fkey',
  })
  requestedBy?: UserAccountEntity;
}
