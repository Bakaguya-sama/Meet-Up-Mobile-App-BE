import {
  Column,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryColumn,
} from 'typeorm';
import type { SessionState } from '../../../../domain/aggregates/user-session.aggregate';
import { UserAccountEntity } from './user-account.typeorm-entity';

@Entity('user_sessions')
@Index('uq_user_sessions_token_hash', ['refreshTokenHash'], { unique: true })
@Index('idx_user_sessions_account_expiry', ['userAccountId', 'expiresAt'])
@Index('idx_user_sessions_family', ['refreshTokenFamilyId'])
export class UserSessionEntity implements SessionState {
  @PrimaryColumn('uuid') id: string;
  @Column('uuid', { name: 'user_account_id' }) userAccountId: string;
  @Column('varchar', { name: 'refresh_token_hash', length: 255 })
  refreshTokenHash: string;
  @Column('uuid', { name: 'refresh_token_family_id' })
  refreshTokenFamilyId: string;
  @Column('uuid', { name: 'parent_session_id', nullable: true })
  parentSessionId: string | null;
  @Column('uuid', { name: 'replaced_by_session_id', nullable: true })
  replacedBySessionId: string | null;
  @Column('varchar', { name: 'device_name', length: 150, nullable: true })
  deviceName: string | null;
  @Column('timestamptz', { name: 'expires_at' }) expiresAt: Date;
  @Column('timestamptz', { name: 'revoked_at', nullable: true })
  revokedAt: Date | null;
  @Column('timestamptz', { name: 'reuse_detected_at', nullable: true })
  reuseDetectedAt: Date | null;
  @Column('timestamptz', { name: 'created_at' }) createdAt: Date;

  @ManyToOne(() => UserAccountEntity, { nullable: false })
  @JoinColumn({
    name: 'user_account_id',
    foreignKeyConstraintName: 'user_sessions_user_account_id_fkey',
  })
  userAccount?: UserAccountEntity;

  @ManyToOne(() => UserSessionEntity, { nullable: true })
  @JoinColumn({
    name: 'parent_session_id',
    foreignKeyConstraintName: 'user_sessions_parent_session_id_fkey',
  })
  parentSession?: UserSessionEntity | null;

  @ManyToOne(() => UserSessionEntity, { nullable: true })
  @JoinColumn({
    name: 'replaced_by_session_id',
    foreignKeyConstraintName: 'user_sessions_replaced_by_session_id_fkey',
  })
  replacedBySession?: UserSessionEntity | null;
}
