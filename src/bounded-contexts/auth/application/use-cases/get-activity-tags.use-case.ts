import type { AuthUnitOfWork } from '../ports/auth-unit-of-work.port';
import type { ActivityTagDto } from '../dto/auth-response.dto';

export class GetActivityTagsUseCase {
  constructor(private readonly uow: AuthUnitOfWork) {}

  async execute(): Promise<ActivityTagDto[]> {
    return this.uow.run(async (store) => {
      const tags = await store.preferences.findActiveActivityTags();
      return tags.map((t) => ({
        id: t.id,
        code: t.code,
        displayName: t.displayName,
        isActive: t.isActive,
      }));
    });
  }
}
