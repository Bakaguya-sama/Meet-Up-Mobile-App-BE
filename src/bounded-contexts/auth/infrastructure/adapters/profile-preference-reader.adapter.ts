import { Injectable } from '@nestjs/common';
import { ProfilePreferenceReader } from '../../application/public/profile-preference-reader';
import { GetUserPreferenceUseCase } from '../../application/use-cases/get-user-preference.use-case';
import { GetActivityTagsUseCase } from '../../application/use-cases/get-activity-tags.use-case';
import type {
  ActivityTagDto,
  UserPreferenceDto,
} from '../../application/dto/auth-response.dto';

@Injectable()
export class TypeOrmProfilePreferenceReader implements ProfilePreferenceReader {
  constructor(
    private readonly getUserPreferenceUseCase: GetUserPreferenceUseCase,
    private readonly getActivityTagsUseCase: GetActivityTagsUseCase,
  ) {}

  getPreference(userId: string): Promise<UserPreferenceDto> {
    return this.getUserPreferenceUseCase.execute(userId);
  }

  getActiveTags(): Promise<ActivityTagDto[]> {
    return this.getActivityTagsUseCase.execute();
  }
}
