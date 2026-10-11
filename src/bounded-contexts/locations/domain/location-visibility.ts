import { DomainError } from '../../../shared-kernel/domain/domain-error';

export interface LocationPrivacy {
  sharingMode: 'off' | 'friends' | 'selected_friends' | 'meetup_only';
  sharingExpiresAt: Date | null;
  useApproximateLocation: boolean;
  selectedFriendIds: string[];
  updatedAt: Date | null;
}

export function isSharingActive(settings: LocationPrivacy, now: Date): boolean {
  return (
    settings.sharingMode !== 'off' &&
    (settings.sharingExpiresAt === null || settings.sharingExpiresAt > now)
  );
}

/** Relationship facts must come from server-side ports, not HTTP input. */
export function canViewLocation(
  settings: LocationPrivacy,
  context: {
    ownerId: string;
    viewerId: string;
    scope: 'friends' | 'meetup';
    meetupId?: string;
    acceptedFriend: boolean;
    acceptedMeetupMember: boolean;
  },
  now: Date,
): boolean {
  if (!isSharingActive(settings, now)) return false;
  if (
    context.ownerId !== context.viewerId &&
    settings.sharingMode !== 'meetup_only'
  ) {
    if (!context.acceptedFriend) return false;
    if (
      settings.sharingMode === 'selected_friends' &&
      !settings.selectedFriendIds.includes(context.viewerId)
    )
      return false;
  }
  if (context.scope === 'meetup')
    return Boolean(context.meetupId) && context.acceptedMeetupMember;
  return (
    context.scope === 'friends' &&
    !context.meetupId &&
    settings.sharingMode !== 'meetup_only'
  );
}

export function canPublishLocation(
  settings: LocationPrivacy,
  meetupId: string | undefined,
  acceptedMeetupMember: boolean,
  now: Date,
): boolean {
  return (
    isSharingActive(settings, now) &&
    ((settings.sharingMode !== 'meetup_only' && !meetupId) ||
      (Boolean(meetupId) && acceptedMeetupMember))
  );
}

export class LocationAccessError extends DomainError {
  constructor() {
    super(
      'LOCATION_ACCESS_DENIED',
      'Location is unavailable or access is not permitted',
    );
  }
}

export interface LocationSample {
  latitude: number;
  longitude: number;
  accuracy: number;
  recordedAt: Date;
}

/** Whitelists output fields and never returns the original object with precise metadata. */
export function visibleLocation(
  sample: LocationSample,
  approximate: boolean,
  now: Date,
): LocationSample & { isApproximate: boolean } {
  const age = now.getTime() - sample.recordedAt.getTime();
  if (
    !Number.isFinite(sample.latitude) ||
    Math.abs(sample.latitude) > 90 ||
    !Number.isFinite(sample.longitude) ||
    Math.abs(sample.longitude) > 180 ||
    !Number.isFinite(sample.accuracy) ||
    sample.accuracy < 0 ||
    !Number.isFinite(age) ||
    age < 0 ||
    age >= 300000
  )
    throw new LocationAccessError();
  return {
    latitude: approximate
      ? Math.round(sample.latitude * 100) / 100
      : sample.latitude,
    longitude: approximate
      ? Math.round(sample.longitude * 100) / 100
      : sample.longitude,
    accuracy: approximate ? Math.max(sample.accuracy, 1000) : sample.accuracy,
    recordedAt: new Date(sample.recordedAt),
    isApproximate: approximate,
  };
}
