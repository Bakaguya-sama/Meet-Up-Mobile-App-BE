import { Column, Entity, Index, PrimaryColumn } from 'typeorm';

export type RecommendationFeedbackEventType =
  | 'PLACE_VOTED'
  | 'VOTE_CHANGED'
  | 'MEETUP_PLACE_SELECTED'
  | 'NAVIGATION_OPENED'
  | 'FAVORITE_ADDED'
  | 'MEETUP_COMPLETED';

@Entity('recommendation_feedback_events')
@Index('idx_recommendation_feedback_run_participant', [
  'runId',
  'meetupParticipantId',
  'occurredAt',
])
@Index('idx_recommendation_feedback_run_type', [
  'runId',
  'eventType',
  'occurredAt',
])
export class RecommendationFeedbackEventEntity {
  @PrimaryColumn('uuid', { name: 'event_id' }) eventId: string;
  @Column('uuid', { name: 'run_id' }) runId: string;
  @Column('uuid', { name: 'meetup_participant_id', nullable: true })
  meetupParticipantId: string | null;
  @Column('varchar', { name: 'event_type', length: 30 })
  eventType: RecommendationFeedbackEventType;
  @Column('varchar', {
    name: 'canonical_candidate_key',
    length: 300,
    nullable: true,
  })
  canonicalCandidateKey: string | null;
  @Column('varchar', {
    name: 'from_canonical_candidate_key',
    length: 300,
    nullable: true,
  })
  fromCanonicalCandidateKey: string | null;
  @Column('char', { name: 'payload_hash', length: 64 }) payloadHash: string;
  @Column('timestamptz', { name: 'occurred_at' }) occurredAt: Date;
  @Column('jsonb') metadata: Record<string, never>;
  @Column('timestamptz', { name: 'created_at' }) createdAt: Date;
}
