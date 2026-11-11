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
import { ParticipantEntity } from '../../../../../meetups/infrastructure/persistence/typeorm/entities/participant.typeorm-entity';
import { RecommendationCandidateEntity } from './recommendation-candidate.typeorm-entity';
import { RecommendationRunEntity } from './recommendation-run.typeorm-entity';

@Entity('recommendation_member_features')
@Unique('uq_recommendation_member_feature', [
  'runId',
  'participantId',
  'canonicalCandidateKey',
])
@Index('idx_recommendation_member_features_run_candidate', [
  'runId',
  'candidateId',
])
@Check('chk_recommendation_member_feature_route', "route_status = 'OK'")
@Check(
  'chk_recommendation_member_feature_numbers',
  'eta_seconds >= 0 AND distance_meters >= 0 AND travel_utility BETWEEN 0 AND 1 AND preference_utility BETWEEN 0 AND 1 AND place_quality_utility BETWEEN 0 AND 1 AND member_utility BETWEEN 0 AND 1',
)
export class RecommendationMemberFeatureEntity {
  @PrimaryColumn('uuid') id: string;
  @Column('uuid', { name: 'run_id' }) runId: string;
  @Column('uuid', { name: 'candidate_id' }) candidateId: string;
  @Column('uuid', { name: 'participant_id' }) participantId: string;
  @Column('varchar', { name: 'canonical_candidate_key', length: 300 })
  canonicalCandidateKey: string;
  @Column('double precision', { name: 'eta_seconds' }) etaSeconds: number;
  @Column('double precision', { name: 'distance_meters' })
  distanceMeters: number;
  @Column('double precision', {
    name: 'static_duration_seconds',
    nullable: true,
  })
  staticDurationSeconds: number | null;
  @Column('jsonb', { name: 'matched_tags' })
  matchedTags: Array<{
    tagCode: string;
    level: 'high' | 'normal' | 'avoid';
    weight: number;
  }>;
  @Column('jsonb', { name: 'missing_flags' }) missingFlags: string[];
  @Column('double precision', { name: 'travel_utility' })
  travelUtility: number;
  @Column('double precision', { name: 'preference_utility' })
  preferenceUtility: number;
  @Column('double precision', { name: 'place_quality_utility' })
  placeQualityUtility: number;
  @Column('double precision', { name: 'member_utility' })
  memberUtility: number;
  @Column('double precision', { name: 'ranking_utility' })
  rankingUtility: number;
  @Column('varchar', { name: 'route_status', length: 20 })
  routeStatus: 'OK';
  @Column('timestamptz', { name: 'created_at' }) createdAt: Date;

  @ManyToOne(() => RecommendationRunEntity, (run) => run.memberFeatures, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({
    name: 'run_id',
    foreignKeyConstraintName: 'recommendation_member_features_run_id_fkey',
  })
  run?: RecommendationRunEntity;

  @ManyToOne(() => RecommendationCandidateEntity, { onDelete: 'CASCADE' })
  @JoinColumn({
    name: 'candidate_id',
    foreignKeyConstraintName:
      'recommendation_member_features_candidate_id_fkey',
  })
  candidate?: RecommendationCandidateEntity;

  @ManyToOne(() => ParticipantEntity, { nullable: false })
  @JoinColumn({
    name: 'participant_id',
    foreignKeyConstraintName:
      'recommendation_member_features_participant_id_fkey',
  })
  participant?: ParticipantEntity;
}
