import { AuthError } from '../../domain/errors/auth.error';
import type { AuthUnitOfWork } from '../ports/auth-unit-of-work.port';
import type { UserPreferenceDto } from '../dto/auth-response.dto';

export class GetUserPreferenceUseCase {
  constructor(private readonly uow: AuthUnitOfWork) {}

  async execute(userId: string): Promise<UserPreferenceDto> {
    return this.uow.run(async (store) => {
      const account = await store.accounts.findAccountById(userId);
      if (!account) {
        throw new AuthError('ACCOUNT_NOT_FOUND', 'User account not found');
      }
      account.assertCanAuthenticate();

      const activeTags = await store.preferences.findActiveActivityTags();
      const preference = await store.preferences.findByUserId(userId);

      const userTagMap = new Map(
        preference
          ? preference.getTags().map((t) => [t.activityTagId, t.level])
          : [],
      );

      return {
        id: preference ? preference.getId() : null,
        userId,
        updatedAt: preference ? preference.getUpdatedAt() : null,
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
