import type {
  PreferenceLevel,
  PreferenceSource,
} from '../../domain/aggregates/meetup.aggregate';

export interface ResolvedTagPreference {
  activityTagId: number;
  tagCode: string;
  displayName: string;
  level: PreferenceLevel;
  source: PreferenceSource;
}

export interface ResolvedParticipantPreference {
  participantId: string;
  userId: string;
  hasExplicitMeetupPreference: boolean;
  tags: ResolvedTagPreference[];
}

export abstract class MeetupPreferenceReader {
  /**
   * Returns effective preferences for all accepted participants in a meetup.
   * Enforces BR-21: Meetup preferences take precedence over profile preferences.
   * If a member has not submitted meetup preferences, profile preferences are used
   * as profile_fallback. If neither exists, defaults to 'normal'.
   */
  abstract getEffectivePreferences(
    meetupId: string,
  ): Promise<ResolvedParticipantPreference[]>;
}
