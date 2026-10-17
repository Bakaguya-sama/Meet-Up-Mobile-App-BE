import type { PreferenceLevel } from '../../domain/aggregates/meetup.aggregate';

export const PROFILE_PREFERENCE_FALLBACK = Symbol(
  'PROFILE_PREFERENCE_FALLBACK',
);

export interface ProfilePreferenceTag {
  activityTagId: number;
  tagCode: string;
  displayName: string;
  level: PreferenceLevel;
}

export interface ActivityTagItem {
  id: number;
  code: string;
  displayName: string;
  isActive: boolean;
}

export interface ProfilePreferenceFallbackPort {
  getActiveTags(): Promise<ActivityTagItem[]>;
  getProfilePreference(userId: string): Promise<ProfilePreferenceTag[] | null>;
}
