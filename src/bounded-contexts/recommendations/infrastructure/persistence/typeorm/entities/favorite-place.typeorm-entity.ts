import { Column, Entity, Index, PrimaryColumn, Unique } from 'typeorm';

@Entity('favorite_places')
@Unique('uq_favorite_places_user_candidate', [
  'userId',
  'canonicalCandidateKey',
])
@Index('idx_favorite_places_user_created', ['userId', 'createdAt'])
export class FavoritePlaceEntity {
  @PrimaryColumn('uuid') id: string;
  @Column('uuid', { name: 'user_id' }) userId: string;
  @Column('varchar', { length: 50 }) provider: string;
  @Column('varchar', { name: 'provider_place_id', length: 255 })
  providerPlaceId: string;
  @Column('varchar', { name: 'canonical_candidate_key', length: 300 })
  canonicalCandidateKey: string;
  @Column('varchar', { name: 'place_name', length: 255 }) placeName: string;
  @Column('timestamptz', { name: 'created_at' }) createdAt: Date;
}
