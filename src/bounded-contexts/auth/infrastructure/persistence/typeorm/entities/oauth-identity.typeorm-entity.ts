import { Column, Entity, Index, PrimaryColumn } from 'typeorm';

@Entity('oauth_identities')
@Index(
  'uq_oauth_identities_provider_account',
  ['provider', 'providerAccountId'],
  {
    unique: true,
  },
)
@Index('uq_oauth_identities_account_provider', ['userAccountId', 'provider'], {
  unique: true,
})
export class OAuthIdentityEntity {
  @PrimaryColumn('uuid') id: string;
  @Column('uuid', { name: 'user_account_id' }) userAccountId: string;
  @Column('varchar', { length: 30 }) provider: 'google';
  @Column('varchar', { name: 'provider_account_id', length: 255 })
  providerAccountId: string;
  @Column('varchar', { name: 'provider_email', length: 255, nullable: true })
  providerEmail: string | null;
  @Column('timestamptz', { name: 'created_at' }) createdAt: Date;
  @Column('timestamptz', { name: 'updated_at' }) updatedAt: Date;
}
