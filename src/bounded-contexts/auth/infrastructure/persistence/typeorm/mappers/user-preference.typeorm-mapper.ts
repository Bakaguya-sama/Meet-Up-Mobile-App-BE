import { UserPreference } from '../../../../domain/aggregates/user-preference.aggregate';
import { UserPreferenceEntity } from '../entities/user-preference.typeorm-entity';
import { UserPreferenceTagEntity } from '../entities/user-preference-tag.typeorm-entity';

export class UserPreferenceTypeOrmMapper {
  static toDomain(
    row: UserPreferenceEntity,
    tags?: UserPreferenceTagEntity[],
  ): UserPreference {
    const tagEntities = tags ?? row.tags ?? [];
    return new UserPreference({
      id: row.id,
      userId: row.userId,
      updatedAt: row.updatedAt,
      tags: tagEntities.map((t) => ({
        activityTagId: t.activityTagId,
        level: t.level,
        createdAt: t.createdAt,
        tagCode: t.activityTag?.code,
        displayName: t.activityTag?.displayName,
      })),
    });
  }

  static toPersistence(preference: UserPreference) {
    const snap = preference.snapshot();
    const entity = new UserPreferenceEntity();
    entity.id = snap.id;
    entity.userId = snap.userId;
    entity.updatedAt = snap.updatedAt;
    entity.tags = snap.tags.map((t) => {
      const tagEntity = new UserPreferenceTagEntity();
      tagEntity.userPreferenceId = snap.id;
      tagEntity.activityTagId = t.activityTagId;
      tagEntity.level = t.level;
      tagEntity.createdAt = t.createdAt;
      return tagEntity;
    });
    return entity;
  }
}
