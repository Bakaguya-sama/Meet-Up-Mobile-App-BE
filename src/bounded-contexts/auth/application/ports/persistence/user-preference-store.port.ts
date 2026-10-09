import type { UserPreference } from '../../../domain/aggregates/user-preference.aggregate';

export interface ActivityTagRecord {
  id: number;
  code: string;
  displayName: string;
  isActive: boolean;
}

export interface UserPreferenceStorePort {
  findByUserId(userId: string): Promise<UserPreference | null>;
  savePreference(preference: UserPreference): Promise<void>;
  findActiveActivityTags(): Promise<ActivityTagRecord[]>;
}
