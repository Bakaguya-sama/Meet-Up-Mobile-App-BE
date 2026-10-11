import { randomUUID } from 'node:crypto';
import { AuthError } from '../../domain/errors/auth.error';
import { UserPreference } from '../../domain/aggregates/user-preference.aggregate';
import {
  PreferenceLevel,
  type PreferenceLevelValue,
} from '../../domain/value-objects/preference-level.vo';
import type { AuthUnitOfWork } from '../ports/auth-unit-of-work.port';
import type { PreferenceTagItemRequest } from '../dto/auth-request.dto';
import type { UserPreferenceDto } from '../dto/auth-response.dto';

export interface SaveUserPreferenceInput {
  userId: string;
  tags: PreferenceTagItemRequest[];
}

export class SaveUserPreferenceUseCase {
  constructor(private readonly uow: AuthUnitOfWork) {}

  async execute(input: SaveUserPreferenceInput): Promise<UserPreferenceDto> {
    return this.uow.run(async (store) => {
      const account = await store.accounts.findAccountById(input.userId);
      if (!account) {
        throw new AuthError('ACCOUNT_NOT_FOUND', 'User account not found');
      }
      account.assertCanAuthenticate();

      const activeTags = await store.preferences.findActiveActivityTags();
      const tagsById = new Map(activeTags.map((t) => [t.id, t]));
      const tagsByCode = new Map(
        activeTags.map((t) => [t.code.toLowerCase(), t]),
      );

      const resolvedItems: Array<{
        activityTagId: number;
        level: PreferenceLevelValue;
        tagCode: string;
        displayName: string;
      }> = [];

      for (const item of input.tags) {
        let matched = item.activityTagId
          ? tagsById.get(item.activityTagId)
          : undefined;
        if (!matched && item.tagCode) {
          matched = tagsByCode.get(item.tagCode.toLowerCase().trim());
        }

        if (!matched) {
          throw new AuthError(
            'ACTIVITY_TAG_NOT_FOUND',
            `Activity tag not found: ${item.tagCode ?? item.activityTagId}`,
          );
        }

        const validLevel = PreferenceLevel.from(item.level).value;
        resolvedItems.push({
          activityTagId: matched.id,
          level: validLevel,
          tagCode: matched.code,
          displayName: matched.displayName,
        });
      }

      const now = new Date();
      let preference = await store.preferences.findByUserId(input.userId);

      if (!preference) {
        preference = new UserPreference({
          id: randomUUID(),
          userId: input.userId,
          updatedAt: now,
          tags: [],
        });
      }

      preference.updateTags(resolvedItems, now);
      await store.preferences.savePreference(preference);

      const userTagMap = new Map(
        preference.getTags().map((t) => [t.activityTagId, t.level]),
      );

      return {
        id: preference.getId(),
        userId: preference.getUserId(),
        updatedAt: preference.getUpdatedAt(),
        tags: activeTags.map((t) => ({
          activityTagId: t.id,
          tagCode: t.code,
          displayName: t.displayName,
          level: userTagMap.get(t.id) ?? 'normal',
        })),
      };
    });
  }
}
