import { AuthError } from '../errors/auth.error';
import {
  PreferenceLevel,
  type PreferenceLevelValue,
} from '../value-objects/preference-level.vo';

export interface PreferenceTagItem {
  activityTagId: number;
  level: PreferenceLevelValue;
  createdAt: Date;
  tagCode?: string;
  displayName?: string;
}

export interface UserPreferenceState {
  id: string;
  userId: string;
  updatedAt: Date;
  tags: PreferenceTagItem[];
}

export class UserPreference {
  constructor(private readonly state: UserPreferenceState) {}

  updateTags(
    items: Array<{
      activityTagId: number;
      level: PreferenceLevelValue;
      tagCode?: string;
      displayName?: string;
    }>,
    now: Date,
  ): void {
    const seenTags = new Set<number>();
    const newTags: PreferenceTagItem[] = [];

    for (const item of items) {
      if (seenTags.has(item.activityTagId)) {
        throw new AuthError(
          'INVALID_INPUT',
          `Duplicate activity tag ID ${item.activityTagId} in preferences`,
        );
      }
      seenTags.add(item.activityTagId);

      PreferenceLevel.from(item.level);

      newTags.push({
        activityTagId: item.activityTagId,
        level: item.level,
        createdAt: now,
        tagCode: item.tagCode,
        displayName: item.displayName,
      });
    }

    this.state.tags = newTags;
    this.state.updatedAt = now;
  }

  snapshot(): UserPreferenceState {
    return {
      id: this.state.id,
      userId: this.state.userId,
      updatedAt: this.state.updatedAt,
      tags: this.state.tags.map((t) => ({ ...t })),
    };
  }

  getTags(): ReadonlyArray<PreferenceTagItem> {
    return this.state.tags;
  }

  getId(): string {
    return this.state.id;
  }

  getUserId(): string {
    return this.state.userId;
  }

  getUpdatedAt(): Date {
    return this.state.updatedAt;
  }
}
