import {
  Check,
  Column,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryColumn,
  Unique,
} from 'typeorm';
import type { RecommendationCandidateFilterStatus } from '../../../../domain/recommendation-run';
import { RecommendationRunEntity } from './recommendation-run.typeorm-entity';

@Entity('recommendation_candidates')
@Unique('uq_recommendation_candidate', ['runId', 'canonicalCandidateKey'])
@Index('idx_recommendation_candidates_run_status', ['runId', 'filterStatus'])
@Check('chk_recommendation_candidates_latitude', 'latitude BETWEEN -90 AND 90')
@Check(
  'chk_recommendation_candidates_longitude',
  'longitude BETWEEN -180 AND 180',
)
@Check(
  'chk_recommendation_candidates_filter_status',
  "filter_status IN ('ELIGIBLE','FILTERED')",
)
export class RecommendationCandidateEntity {
  @PrimaryColumn('uuid') id: string;
  @Column('uuid', { name: 'run_id' }) runId: string;
  @Column('varchar', { name: 'canonical_candidate_key', length: 300 })
  canonicalCandidateKey: string;
  @Column('varchar', { length: 50 }) provider: string;
  @Column('varchar', { name: 'provider_place_id', length: 255 })
  providerPlaceId: string;
  @Column('varchar', { length: 255 }) name: string;
  @Column('double precision') latitude: number;
  @Column('double precision') longitude: number;
  @Column('jsonb', { name: 'provider_types' }) providerTypes: string[];
  @Column('jsonb', { name: 'source_categories' }) sourceCategories: string[];
  @Column('jsonb', { name: 'source_pages' }) sourcePages: number[];
  @Column('varchar', { name: 'filter_status', length: 20 })
  filterStatus: RecommendationCandidateFilterStatus;
  @Column('varchar', { name: 'filter_reason', length: 100, nullable: true })
  filterReason: string | null;
  @Column('timestamptz', { name: 'created_at' }) createdAt: Date;
  @ManyToOne(() => RecommendationRunEntity, (run) => run.candidates, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({
    name: 'run_id',
    foreignKeyConstraintName: 'recommendation_candidates_run_id_fkey',
  })
  run?: RecommendationRunEntity;
}
