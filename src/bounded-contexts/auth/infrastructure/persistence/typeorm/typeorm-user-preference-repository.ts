import { EntityManager } from 'typeorm';
import type {
  ActivityTagRecord,
  UserPreferenceStorePort,
} from '../../../application/ports/persistence/user-preference-store.port';
import { UserPreference } from '../../../domain/aggregates/user-preference.aggregate';
import { ActivityTagEntity } from './entities/activity-tag.typeorm-entity';
import { UserPreferenceEntity } from './entities/user-preference.typeorm-entity';
import { UserPreferenceTagEntity } from './entities/user-preference-tag.typeorm-entity';
import { UserPreferenceTypeOrmMapper } from './mappers/user-preference.typeorm-mapper';

export class TypeOrmUserPreferenceRepository implements UserPreferenceStorePort {
  constructor(private readonly manager: EntityManager) {}

  async findByUserId(userId: string): Promise<UserPreference | null> {
    const row = await this.manager.findOne(UserPreferenceEntity, {
      where: { userId },
      relations: {
        tags: {
          activityTag: true,
        },
      },
    });
    return row ? UserPreferenceTypeOrmMapper.toDomain(row) : null;
  }

  async savePreference(preference: UserPreference): Promise<void> {
    const entity = UserPreferenceTypeOrmMapper.toPersistence(preference);

    await this.manager.save(UserPreferenceEntity, {
      id: entity.id,
      userId: entity.userId,
      updatedAt: entity.updatedAt,
    });

    await this.manager.delete(UserPreferenceTagEntity, {
      userPreferenceId: entity.id,
    });

    if (entity.tags && entity.tags.length > 0) {
      await this.manager.save(UserPreferenceTagEntity, entity.tags);
    }
  }

  async findActiveActivityTags(): Promise<ActivityTagRecord[]> {
    const rows = await this.manager.find(ActivityTagEntity, {
      where: { isActive: true },
      order: { id: 'ASC' },
    });
    return rows.map((r) => ({
      id: r.id,
      code: r.code,
      displayName: r.displayName,
      isActive: r.isActive,
    }));
  }
}
