export const MEETUP_PREFERENCE = Symbol('MEETUP_PREFERENCE');

export interface EffectiveMemberPreference {
  participantId: string;
  budgetVnd: number | null;
  tags: Array<{
    tagCode: string;
    level: 'high' | 'normal' | 'avoid';
    source: 'meetup_input' | 'profile_fallback';
  }>;
}

export interface MeetupPreferencePort {
  getEffectivePreferences(
    meetupId: string,
  ): Promise<EffectiveMemberPreference[]>;
}
