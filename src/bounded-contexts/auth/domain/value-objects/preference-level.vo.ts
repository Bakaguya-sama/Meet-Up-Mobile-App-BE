import { AuthError } from '../errors/auth.error';

export type PreferenceLevelValue = 'high' | 'normal' | 'avoid';

export class PreferenceLevel {
  static readonly HIGH = new PreferenceLevel('high');
  static readonly NORMAL = new PreferenceLevel('normal');
  static readonly AVOID = new PreferenceLevel('avoid');

  private constructor(readonly value: PreferenceLevelValue) {}

  static from(value: unknown): PreferenceLevel {
    if (typeof value !== 'string') {
      throw new AuthError(
        'INVALID_PREFERENCE_LEVEL',
        'Preference level must be a string',
      );
    }
    const normalized = value.toLowerCase().trim() as PreferenceLevelValue;
    if (
      normalized !== 'high' &&
      normalized !== 'normal' &&
      normalized !== 'avoid'
    ) {
      throw new AuthError(
        'INVALID_PREFERENCE_LEVEL',
        `Invalid preference level: ${value}. Must be 'high', 'normal', or 'avoid'`,
      );
    }
    return new PreferenceLevel(normalized);
  }

  equals(other: PreferenceLevel): boolean {
    return this.value === other.value;
  }
}
