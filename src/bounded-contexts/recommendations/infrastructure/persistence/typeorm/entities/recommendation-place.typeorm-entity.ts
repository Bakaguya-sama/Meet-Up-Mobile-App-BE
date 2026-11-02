import {
  Check,
  Column,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  OneToOne,
  PrimaryColumn,
  Unique,
} from 'typeorm';
import type {
  RecommendationExplanation,
  RecommendationPlaceSnapshot,
} from '../../../../domain/recommendation-run';
import type {
  ScheduledOpeningEvidence,
  ScheduledOpeningStatus,
} from '../../../../domain/temporal-context';
import { RecommendationCandidateEntity } from './recommendation-candidate.typeorm-entity';
import { RecommendationRunEntity } from './recommendation-run.typeorm-entity';

@Entity('recommendation_places')
@Unique('uq_recommendation_places_candidate', ['runId', 'candidateId'])
@Index('uq_recommendation_places_run_rank', ['runId', 'rank'], {
  unique: true,
})
@Check(
  'chk_recommendation_places_metrics',
  'rank > 0 AND group_utility BETWEEN 0 AND 1 AND candidate_least_misery_utility BETWEEN 0 AND 1 AND pareto_level > 0 AND (inclusion_probability IS NULL OR inclusion_probability BETWEEN 0 AND 1) AND avg_eta_seconds >= 0 AND max_eta_seconds >= 0 AND eta_range_seconds >= 0',
)
@Check(
  'chk_recommendation_places_scheduled_opening',
  "scheduled_opening_status IS NULL OR scheduled_opening_status IN ('OPEN','CLOSED','UNKNOWN')",
)
export class RecommendationPlaceEntity implements RecommendationPlaceSnapshot {
  @PrimaryColumn('uuid') id: string;
  @Column('uuid', { name: 'run_id' }) runId: string;
  @Column('uuid', { name: 'candidate_id' }) candidateId: string;
  @Column('varchar', { name: 'canonical_candidate_key', length: 300 })
  canonicalCandidateKey: string;
  @Column('smallint') rank: number;
  @Column('double precision', { name: 'group_utility' })
  groupUtility: number;
  @Column('double precision', { name: 'candidate_least_misery_utility' })
  candidateLeastMiseryUtility: number;
  @Column('integer', { name: 'pareto_level' }) paretoLevel: number;
  @Column('double precision', {
    name: 'inclusion_probability',
    nullable: true,
  })
  inclusionProbability: number | null;
  @Column('double precision', { name: 'avg_eta_seconds' })
  avgEtaSeconds: number;
  @Column('double precision', { name: 'max_eta_seconds' })
  maxEtaSeconds: number;
  @Column('double precision', { name: 'eta_range_seconds' })
  etaRangeSeconds: number;
  @Column('varchar', {
    name: 'scheduled_opening_status',
    length: 20,
    nullable: true,
  })
  scheduledOpeningStatus: ScheduledOpeningStatus | null;
  @Column('jsonb', { name: 'opening_evidence', nullable: true })
  openingEvidence: ScheduledOpeningEvidence | null;
  @Column('jsonb') explanation: RecommendationExplanation;
  @Column('timestamptz', { name: 'created_at' }) createdAt: Date;

  @ManyToOne(() => RecommendationRunEntity, (run) => run.places, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({
    name: 'run_id',
    foreignKeyConstraintName: 'recommendation_places_run_id_fkey',
  })
  run?: RecommendationRunEntity;

  @OneToOne(() => RecommendationCandidateEntity, { onDelete: 'CASCADE' })
  @JoinColumn({
    name: 'candidate_id',
    foreignKeyConstraintName: 'recommendation_places_candidate_id_fkey',
  })
  candidate?: RecommendationCandidateEntity;
}
