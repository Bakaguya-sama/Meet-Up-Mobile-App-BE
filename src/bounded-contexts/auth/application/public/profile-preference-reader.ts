import type {
  ActivityTagDto,
  UserPreferenceDto,
} from '../dto/auth-response.dto';

export abstract class ProfilePreferenceReader {
  /** Only saved active profile tags; unlike the profile form, no synthetic normal tags. */
  abstract getPreference(userId: string): Promise<UserPreferenceDto>;
  abstract getActiveTags(): Promise<ActivityTagDto[]>;
}
