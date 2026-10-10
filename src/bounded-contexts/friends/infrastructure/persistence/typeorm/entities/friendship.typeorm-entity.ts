import { Check, Column, Entity, Index, PrimaryColumn } from 'typeorm';
import type {
  FriendshipState,
  FriendshipStatus,
} from '../../../../domain/aggregates/friendship.aggregate';

@Entity('friendships')
@Check('chk_friendships_sorted_pair', 'user_a_id < user_b_id')
@Check('chk_friendships_requester', 'requested_by_id IN (user_a_id, user_b_id)')
@Check(
  'chk_friendships_response',
  "(status = 'pending' AND responded_at IS NULL) OR (status <> 'pending' AND responded_at IS NOT NULL)",
)
@Index('uq_friendships_pair', ['userAId', 'userBId'], { unique: true })
@Index('idx_friendships_a_status', ['userAId', 'status'])
@Index('idx_friendships_b_status', ['userBId', 'status'])
export class FriendshipEntity implements FriendshipState {
  @PrimaryColumn('uuid') id: string;
  @Column('uuid', { name: 'user_a_id' }) userAId: string;
  @Column('uuid', { name: 'user_b_id' }) userBId: string;
  @Column('uuid', { name: 'requested_by_id' }) requestedById: string;
  @Column('enum', {
    enum: ['pending', 'accepted', 'rejected', 'blocked'],
    enumName: 'friendship_status',
    default: 'pending',
  })
  status: FriendshipStatus;
  @Column('timestamptz', { name: 'requested_at' }) requestedAt: Date;
  @Column('timestamptz', { name: 'responded_at', nullable: true })
  respondedAt: Date | null;
  @Column('timestamptz', { name: 'updated_at' }) updatedAt: Date;
}
