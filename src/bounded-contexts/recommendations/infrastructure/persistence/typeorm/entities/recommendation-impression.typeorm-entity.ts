import { Column, Entity, Index, PrimaryColumn } from 'typeorm';

@Entity('recommendation_impressions')
@Index(
  'uq_recommendation_impression_run_participant_candidate',
  ['runId', 'meetupParticipantId', 'canonicalCandidateKey'],
  { unique: true },
)
@Index('idx_recommendation_impressions_run_participant', [
  'runId',
  'meetupParticipantId',
])
export class RecommendationImpressionEntity {
  @PrimaryColumn('uuid', { name: 'event_id' }) eventId: string;
  @Column('uuid', { name: 'run_id' }) runId: string;
  @Column('uuid', { name: 'meetup_participant_id' })
  meetupParticipantId: string;
  @Column('varchar', { name: 'canonical_candidate_key', length: 300 })
  canonicalCandidateKey: string;
  @Column('smallint') rank: number;
  @Column('char', { name: 'payload_hash', length: 64 }) payloadHash: string;
  @Column('timestamptz', { name: 'shown_at' }) shownAt: Date;
  @Column('timestamptz', { name: 'created_at' }) createdAt: Date;
}
