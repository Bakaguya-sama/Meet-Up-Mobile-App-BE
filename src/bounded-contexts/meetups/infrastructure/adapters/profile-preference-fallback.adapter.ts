import { Injectable } from '@nestjs/common';
import { ProfilePreferenceReader } from '../../../auth/application/public/profile-preference-reader';
import type {
  ActivityTagItem,
  ProfilePreferenceFallbackPort,
  ProfilePreferenceTag,
} from '../../application/ports/profile-preference-fallback.port';

@Injectable()
export class ProfilePreferenceFallbackAdapter implements ProfilePreferenceFallbackPort {
  constructor(private readonly profileReader: ProfilePreferenceReader) {}

  async getActiveTags(): Promise<ActivityTagItem[]> {
    const tags = await this.profileReader.getActiveTags();
    return tags.map((t) => ({
      id: t.id,
      code: t.code,
      displayName: t.displayName,
      isActive: t.isActive,
    }));
  }

  async getProfilePreference(
    userId: string,
  ): Promise<ProfilePreferenceTag[] | null> {
    const pref = await this.profileReader.getPreference(userId);
    return pref.tags.map((t) => ({
      activityTagId: t.activityTagId,
      tagCode: t.tagCode,
      displayName: t.displayName,
      level: t.level,
    }));
  }
}
