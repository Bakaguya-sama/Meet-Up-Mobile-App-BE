import { Column, Entity, Index, PrimaryColumn } from 'typeorm';

@Entity('device_tokens')
@Index('uq_device_tokens_fingerprint', ['tokenFingerprint'], { unique: true })
@Index('idx_device_tokens_user_active', ['userId', 'revokedAt'])
export class DeviceTokenEntity {
  @PrimaryColumn('uuid')
  id!: string;

  @Column('uuid', { name: 'user_account_id' })
  userId!: string;

  /** AES-256-GCM envelope; plaintext FCM tokens never leave this adapter. */
  @Column('text', { name: 'token_ciphertext' })
  tokenCiphertext!: string;

  /** HMAC-SHA-256 lookup key, not an FCM token. */
  @Column('char', { name: 'token_fingerprint', length: 64 })
  tokenFingerprint!: string;

  @Column('varchar', { length: 10 })
  platform!: 'android' | 'ios';

  @Column('timestamptz', { name: 'revoked_at', nullable: true })
  revokedAt!: Date | null;

  @Column('timestamptz', { name: 'created_at' })
  createdAt!: Date;

  @Column('timestamptz', { name: 'updated_at' })
  updatedAt!: Date;
}
