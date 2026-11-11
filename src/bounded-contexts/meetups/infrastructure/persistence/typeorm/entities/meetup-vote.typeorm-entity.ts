import { Column, Entity, Index, PrimaryColumn } from 'typeorm';

@Entity('votes')
@Index('uq_votes_meetup_participant', ['meetupId', 'meetupParticipantId'], { unique: true })
export class MeetupVoteEntity {
  @PrimaryColumn('uuid') id: string;
  @Column('uuid', { name: 'meetup_id' }) meetupId: string;
  @Column('uuid', { name: 'run_id' }) runId: string;
  @Column('uuid', { name: 'recommendation_place_id' }) recommendationPlaceId: string;
  @Column('uuid', { name: 'participant_id' }) meetupParticipantId: string;
  @Column('timestamptz', { name: 'created_at' }) createdAt: Date;
  @Column('timestamptz', { name: 'updated_at' }) updatedAt: Date;
}
