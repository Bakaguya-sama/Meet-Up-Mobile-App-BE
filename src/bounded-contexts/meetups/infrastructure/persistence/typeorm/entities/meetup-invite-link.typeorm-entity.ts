import { Check, Column, Entity, Index, PrimaryColumn } from 'typeorm';

@Entity('meetup_invite_links')
@Index('uq_meetup_invite_links_token_hash', ['tokenHash'], { unique: true })
@Index('idx_meetup_invite_links_meetup_revoked', ['meetupId', 'revokedAt'])
@Index('idx_meetup_invite_links_expires_at', ['expiresAt'])
@Index('idx_meetup_invite_links_creator_created', ['createdById', 'createdAt'])
@Check('chk_meetup_invite_links_use_count', 'use_count >= 0')
export class MeetupInviteLinkEntity {
  @PrimaryColumn('uuid') id: string;
  @Column('uuid', { name: 'meetup_id' }) meetupId: string;
  @Column('uuid', { name: 'created_by_id' }) createdById: string;
  @Column('char', { name: 'token_hash', length: 64 }) tokenHash: string;
  @Column('timestamptz', { name: 'expires_at' }) expiresAt: Date;
  @Column('timestamptz', { name: 'revoked_at', nullable: true })
  revokedAt: Date | null;
  @Column('uuid', { name: 'revoked_by_id', nullable: true })
  revokedById: string | null;
  @Column('integer', { name: 'use_count', default: 0 }) useCount: number;
  @Column('timestamptz', { name: 'last_used_at', nullable: true })
  lastUsedAt: Date | null;
  @Column('timestamptz', { name: 'created_at' }) createdAt: Date;
  @Column('timestamptz', { name: 'updated_at' }) updatedAt: Date;
}
