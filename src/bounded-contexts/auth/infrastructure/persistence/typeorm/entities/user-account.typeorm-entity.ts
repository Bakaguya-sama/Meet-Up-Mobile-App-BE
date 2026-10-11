import { Check, Column, Entity, Index, PrimaryColumn } from 'typeorm';
import type { AccountState } from '../../../../domain/aggregates/user-account.aggregate';

@Entity('user_accounts')
@Check('chk_user_accounts_normalized_email', 'email = lower(trim(email))')
@Index('uq_user_accounts_email', ['email'], { unique: true })
export class UserAccountEntity implements AccountState {
  @PrimaryColumn('uuid') id: string;
  @Column('varchar', { length: 255 }) email: string;
  @Column('varchar', { name: 'password_hash', length: 255, nullable: true })
  passwordHash: string | null;
  @Column('varchar', { name: 'display_name', length: 100 }) displayName: string;
  @Column('varchar', { name: 'avatar_url', length: 1000, nullable: true })
  avatarUrl: string | null;
  @Column('boolean', { name: 'is_locked', default: false }) isLocked: boolean;
  @Column('varchar', { name: 'locked_reason', length: 500, nullable: true })
  lockedReason: string | null;
  @Column('timestamptz', { name: 'last_login_at', nullable: true })
  lastLoginAt: Date | null;
  @Column('timestamptz', { name: 'created_at' }) createdAt: Date;
  @Column('timestamptz', { name: 'updated_at' }) updatedAt: Date;
  @Column('timestamptz', { name: 'deleted_at', nullable: true })
  deletedAt: Date | null;
}
