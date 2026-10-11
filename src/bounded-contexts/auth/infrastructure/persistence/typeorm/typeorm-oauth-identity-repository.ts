import { EntityManager } from 'typeorm';
import type { OAuthIdentityStorePort } from '../../../application/ports/persistence/oauth-identity-store.port';
import {
  OAuthIdentity,
  type OAuthIdentityState,
} from '../../../domain/entities/oauth-identity.entity';
import { OAuthIdentityEntity } from './entities/oauth-identity.typeorm-entity';

export class TypeOrmOAuthIdentityRepository implements OAuthIdentityStorePort {
  constructor(private readonly manager: EntityManager) {}

  async findByProviderAccount(
    provider: 'google',
    providerAccountId: string,
  ): Promise<OAuthIdentity | null> {
    const row = await this.manager.findOneBy(OAuthIdentityEntity, {
      provider,
      providerAccountId,
    });
    return row ? new OAuthIdentity(toState(row)) : null;
  }

  async save(identity: OAuthIdentity): Promise<void> {
    await this.manager.save(OAuthIdentityEntity, identity.snapshot());
  }
}

function toState(row: OAuthIdentityEntity): OAuthIdentityState {
  return {
    id: row.id,
    userAccountId: row.userAccountId,
    provider: row.provider,
    providerAccountId: row.providerAccountId,
    providerEmail: row.providerEmail,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}
