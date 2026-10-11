import type { PrivacySettingsDto } from '../dto/privacy-settings.dto';

/** Internal contract. Call on every location operation; never cache a grant. */
export abstract class LocationPrivacyReader {
  /** Null means the account is unavailable (missing, locked or deleted). */
  abstract read(userId: string): Promise<PrivacySettingsDto | null>;
}
