import type { TokenPair } from '../ports/auth-tokens.port';
import type { PreferenceLevelValue } from '../../domain/value-objects/preference-level.vo';

export interface UserPreferenceTagDto {
  activityTagId: number;
  tagCode: string;
  displayName: string;
  level: PreferenceLevelValue;
}

export interface UserPreferenceDto {
  id: string | null;
  userId: string;
  updatedAt: Date | null;
  tags: UserPreferenceTagDto[];
}

export interface ActivityTagDto {
  id: number;
  code: string;
  displayName: string;
  isActive: boolean;
}

export interface UserProfileDto {
  id: string;
  email: string;
  displayName: string;
  avatarUrl: string | null;
  preferences?: UserPreferenceDto;
}

export interface AuthResultDto extends TokenPair {
  user: UserProfileDto;
}
