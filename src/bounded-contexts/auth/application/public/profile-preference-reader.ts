import type {
  ActivityTagDto,
  UserPreferenceDto,
} from '../dto/auth-response.dto';

export abstract class ProfilePreferenceReader {
  abstract getPreference(userId: string): Promise<UserPreferenceDto>;
  abstract getActiveTags(): Promise<ActivityTagDto[]>;
}
