import { UserSession } from '../../../../domain/aggregates/user-session.aggregate';
import { UserSessionEntity } from '../entities/user-session.typeorm-entity';

export class UserSessionTypeOrmMapper {
  static toDomain(row: UserSessionEntity): UserSession {
    return new UserSession({
      id: row.id,
      userAccountId: row.userAccountId,
      refreshTokenHash: row.refreshTokenHash,
      refreshTokenFamilyId: row.refreshTokenFamilyId,
      parentSessionId: row.parentSessionId,
      replacedBySessionId: row.replacedBySessionId,
      deviceName: row.deviceName,
      expiresAt: row.expiresAt,
      revokedAt: row.revokedAt,
      reuseDetectedAt: row.reuseDetectedAt,
      createdAt: row.createdAt,
    });
  }

  static toPersistence(session: UserSession) {
    return session.snapshot();
  }
}
