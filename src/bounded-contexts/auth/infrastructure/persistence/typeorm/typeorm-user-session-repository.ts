import { EntityManager, IsNull } from 'typeorm';
import type { UserSessionStorePort } from '../../../application/ports/persistence/user-session-store.port';
import { UserSession } from '../../../domain/aggregates/user-session.aggregate';
import { UserSessionEntity } from './entities/user-session.typeorm-entity';
import { UserSessionTypeOrmMapper } from './mappers/user-session.typeorm-mapper';

export class TypeOrmUserSessionRepository implements UserSessionStorePort {
  constructor(private readonly manager: EntityManager) {}

  async findSession(id: string) {
    const row = await this.manager.findOneBy(UserSessionEntity, { id });
    return row ? UserSessionTypeOrmMapper.toDomain(row) : null;
  }

  async saveSession(session: UserSession) {
    await this.manager.save(
      UserSessionEntity,
      UserSessionTypeOrmMapper.toPersistence(session),
    );
  }

  async revokeFamily(familyId: string, now: Date) {
    await this.manager.update(
      UserSessionEntity,
      { refreshTokenFamilyId: familyId, revokedAt: IsNull() },
      { revokedAt: now },
    );
  }
}
