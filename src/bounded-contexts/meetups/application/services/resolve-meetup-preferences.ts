import type { ParticipantState } from '../../domain/aggregates/meetup.aggregate';
import type {
  ActivityTagItem,
  ProfilePreferenceFallbackPort,
} from '../ports/profile-preference-fallback.port';

/** Resolve the entire preference source once: meetup input or profile, never both. */
export async function resolveMeetupPreferences(
  participant: ParticipantState,
  activeTags: ActivityTagItem[],
  fallback: ProfilePreferenceFallbackPort,
) {
  const explicit = participant.preferences ?? [];
  const hasExplicitMeetupPreference = explicit.length > 0;
  const activeById = new Map(activeTags.map((tag) => [tag.id, tag]));
  if (hasExplicitMeetupPreference) {
    return {
      hasExplicitMeetupPreference,
      tags: explicit.flatMap((preference) => {
        const tag = activeById.get(preference.activityTagId);
        return tag
          ? [
              {
                activityTagId: tag.id,
                tagCode: tag.code,
                displayName: tag.displayName,
                level: preference.level,
                source: 'meetup_input' as const,
                updatedAt: preference.updatedAt.toISOString(),
              },
            ]
          : [];
      }),
    };
  }
  const profile = await fallback.getProfilePreference(participant.userId);
  return {
    hasExplicitMeetupPreference,
    tags: (profile ?? []).flatMap((preference) => {
      const tag = activeById.get(preference.activityTagId);
      return tag
        ? [
            {
              activityTagId: tag.id,
              tagCode: tag.code,
              displayName: tag.displayName,
              level: preference.level,
              source: 'profile_fallback' as const,
              updatedAt: null,
            },
          ]
        : [];
    }),
  };
}
