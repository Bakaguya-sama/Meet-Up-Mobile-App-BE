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
import type {
  ScheduledOpeningEvidence,
  ScheduledOpeningStatus,
} from '../../../../domain/temporal-context';
import { RecommendationRunEntity } from './recommendation-run.typeorm-entity';
import type { WeatherEvidence } from '../../../../domain/recommendation-run';

@Entity('recommendation_candidates')
@Unique('uq_recommendation_candidate', ['runId', 'canonicalCandidateKey'])
@Index('idx_recommendation_candidates_run_status', ['runId', 'filterStatus'])
@Index('uq_recommendation_candidates_run_rank', ['runId', 'finalRank'], {
  unique: true,
  where: 'final_rank IS NOT NULL',
})
@Check('chk_recommendation_candidates_latitude', 'latitude BETWEEN -90 AND 90')
@Check(
  'chk_recommendation_candidates_longitude',
  'longitude BETWEEN -180 AND 180',
)
@Check(
  'chk_recommendation_candidates_filter_status',
  "filter_status IN ('ELIGIBLE','FILTERED')",
)
@Check(
  'chk_recommendation_candidates_rating',
  'rating_0_to_5 IS NULL OR rating_0_to_5 BETWEEN 0 AND 5',
)
@Check(
  'chk_recommendation_candidates_review_count',
  'user_rating_count IS NULL OR user_rating_count >= 0',
)
@Check(
  'chk_recommendation_candidates_ranking',
  '(final_rank IS NULL OR final_rank > 0) AND (group_utility IS NULL OR group_utility BETWEEN 0 AND 1) AND (candidate_least_misery_utility IS NULL OR candidate_least_misery_utility BETWEEN 0 AND 1) AND (pareto_level IS NULL OR pareto_level > 0) AND (inclusion_probability IS NULL OR inclusion_probability BETWEEN 0 AND 1) AND (avg_eta_seconds IS NULL OR avg_eta_seconds >= 0) AND (max_eta_seconds IS NULL OR max_eta_seconds >= 0) AND (eta_range_seconds IS NULL OR eta_range_seconds >= 0)',
)
@Check(
  'chk_recommendation_candidates_scheduled_opening',
  "scheduled_opening_status IS NULL OR scheduled_opening_status IN ('OPEN','CLOSED','UNKNOWN')",
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
  @Column('jsonb', { name: 'normalized_tags', default: () => "'[]'::jsonb" })
  normalizedTags: string[];
  @Column('double precision', { name: 'rating_0_to_5', nullable: true })
  rating0To5: number | null;
  @Column('integer', { name: 'user_rating_count', nullable: true })
  userRatingCount: number | null;
  @Column('smallint', { name: 'final_rank', nullable: true })
  finalRank: number | null;
  @Column('double precision', { name: 'group_utility', nullable: true })
  groupUtility: number | null;
  @Column('double precision', {
    name: 'candidate_least_misery_utility',
    nullable: true,
  })
  candidateLeastMiseryUtility: number | null;
  @Column('integer', { name: 'pareto_level', nullable: true })
  paretoLevel: number | null;
  @Column('double precision', {
    name: 'inclusion_probability',
    nullable: true,
  })
  inclusionProbability: number | null;
  @Column('double precision', { name: 'avg_eta_seconds', nullable: true })
  avgEtaSeconds: number | null;
  @Column('double precision', { name: 'max_eta_seconds', nullable: true })
  maxEtaSeconds: number | null;
  @Column('double precision', { name: 'eta_range_seconds', nullable: true })
  etaRangeSeconds: number | null;
  @Column('varchar', {
    name: 'scheduled_opening_status',
    length: 20,
    nullable: true,
  })
  scheduledOpeningStatus: ScheduledOpeningStatus | null;
  @Column('jsonb', { name: 'opening_evidence', nullable: true })
  openingEvidence: ScheduledOpeningEvidence | null;
  @Column('jsonb', { name: 'weather_evidence', nullable: true })
  weatherEvidence: WeatherEvidence | null;
  @ManyToOne(() => RecommendationRunEntity, (run) => run.candidates, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({
    name: 'run_id',
    foreignKeyConstraintName: 'recommendation_candidates_run_id_fkey',
  })
  run?: RecommendationRunEntity;
}
