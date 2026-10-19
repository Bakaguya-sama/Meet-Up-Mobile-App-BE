import { Inject, Injectable } from '@nestjs/common';
import { ProfilePreferenceReader } from '../../application/public/profile-preference-reader';
import {
  AUTH_UNIT_OF_WORK,
  type AuthUnitOfWork,
} from '../../application/ports/auth-unit-of-work.port';
import { AuthError } from '../../domain/errors/auth.error';
import { GetActivityTagsUseCase } from '../../application/use-cases/get-activity-tags.use-case';
import type {
  ActivityTagDto,
  UserPreferenceDto,
} from '../../application/dto/auth-response.dto';

@Injectable()
export class TypeOrmProfilePreferenceReader implements ProfilePreferenceReader {
  constructor(
    @Inject(AUTH_UNIT_OF_WORK) private readonly uow: AuthUnitOfWork,
    private readonly getActivityTagsUseCase: GetActivityTagsUseCase,
  ) {}

  getPreference(userId: string): Promise<UserPreferenceDto> {
    return this.uow.run(async (store) => {
      const account = await store.accounts.findAccountById(userId);
      if (!account)
        throw new AuthError('ACCOUNT_NOT_FOUND', 'User account not found');
      account.assertCanAuthenticate();
      const preference = await store.preferences.findByUserId(userId);
      const tags = await store.preferences.findActiveActivityTags();
      const active = new Map(tags.map((tag) => [tag.id, tag]));
      return {
        id: preference?.getId() ?? null,
        userId,
        updatedAt: preference?.getUpdatedAt() ?? null,
        tags: (preference?.getTags() ?? []).flatMap((item) => {
          const tag = active.get(item.activityTagId);
          return tag
            ? [
                {
                  activityTagId: tag.id,
                  tagCode: tag.code,
                  displayName: tag.displayName,
                  level: item.level,
                },
              ]
            : [];
        }),
      };
    });
  }

  getActiveTags(): Promise<ActivityTagDto[]> {
    return this.getActivityTagsUseCase.execute();
  }
}
