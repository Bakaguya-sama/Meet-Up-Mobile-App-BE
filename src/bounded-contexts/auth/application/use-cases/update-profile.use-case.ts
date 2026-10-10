import { AuthError } from '../../domain/errors/auth.error';
import type { AuthUnitOfWork } from '../ports/auth-unit-of-work.port';
import type { PreferenceTagItemRequest } from '../dto/auth-request.dto';
import type { UserProfileDto } from '../dto/auth-response.dto';
import { SaveUserPreferenceUseCase } from './save-user-preference.use-case';

export interface UpdateProfileInput {
  userId: string;
  displayName?: string;
  avatarUrl?: string | null;
  preferences?: PreferenceTagItemRequest[];
}

export class UpdateProfileUseCase {
  constructor(
    private readonly uow: AuthUnitOfWork,
    private readonly savePreferences?: SaveUserPreferenceUseCase,
  ) {}

  async execute(input: UpdateProfileInput): Promise<UserProfileDto> {
    const profile = await this.uow.run(async (store) => {
      const account = await store.accounts.findAccountById(input.userId);
      if (!account) {
        throw new AuthError('ACCOUNT_NOT_FOUND', 'User account not found');
      }
      account.assertCanAuthenticate();

      if (input.displayName !== undefined || input.avatarUrl !== undefined) {
        account.updateProfile(
          {
            displayName: input.displayName,
            avatarUrl: input.avatarUrl,
          },
          new Date(),
        );
        await store.accounts.saveAccount(account);
      }

      return account.publicProfile();
    });

    if (input.preferences && this.savePreferences) {
      const prefResult = await this.savePreferences.execute({
        userId: input.userId,
        tags: input.preferences,
      });
      return {
        ...profile,
        preferences: prefResult,
      };
    }

    return profile;
  }
}
