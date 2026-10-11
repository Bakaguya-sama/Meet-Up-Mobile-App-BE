import type { OAuthIdentity } from '../../../domain/entities/oauth-identity.entity';

export interface OAuthIdentityStorePort {
  findByProviderAccount(
    provider: 'google',
    providerAccountId: string,
  ): Promise<OAuthIdentity | null>;
  save(identity: OAuthIdentity): Promise<void>;
}
