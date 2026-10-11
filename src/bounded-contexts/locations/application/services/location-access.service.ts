import {
  canPublishLocation,
  canViewLocation,
  isSharingActive,
  LocationAccessError,
  visibleLocation,
  type LocationSample,
} from '../../domain/location-visibility';
import type {
  LocationFriendshipsPort,
  LocationPrivacy,
  LocationPrivacyPort,
  MeetupLocationAccessPort,
} from '../ports/location-access.port';

export interface ReadLocationAccess {
  ownerId: string;
  viewerId: string;
  scope: 'friends' | 'meetup';
  meetupId?: string;
}

export interface LocationPermission {
  allowed: boolean;
  precision: 'precise' | 'approximate' | null;
  expiresAt: Date | null;
}

/** Public application API for HTTP, Socket, map and recommendation consumers. */
export class LocationAccessService {
  constructor(
    private readonly privacy: LocationPrivacyPort,
    private readonly friendships: LocationFriendshipsPort,
    private readonly meetups?: MeetupLocationAccessPort,
  ) {}

  private async readGrant(
    input: ReadLocationAccess,
  ): Promise<LocationPrivacy | null> {
    const ownerId = input.ownerId.toLowerCase();
    const viewerId = input.viewerId.toLowerCase();
    const settings = await this.privacy.read(ownerId);
    if (!settings || !isSharingActive(settings, new Date())) return null;
    if (ownerId !== viewerId && !(await this.privacy.read(viewerId)))
      return null;
    const acceptedFriend =
      ownerId !== viewerId && settings.sharingMode !== 'meetup_only'
        ? await this.friendships.areAccepted(ownerId, viewerId)
        : false;
    const acceptedMeetupMember =
      input.scope === 'meetup' && input.meetupId && this.meetups
        ? await this.meetups.canRead(ownerId, viewerId, input.meetupId)
        : false;
    // Queries may cross the expiry boundary; check again before granting access.
    return canViewLocation(
      settings,
      { ...input, ownerId, viewerId, acceptedFriend, acceptedMeetupMember },
      new Date(),
    )
      ? settings
      : null;
  }

  async checkRead(input: ReadLocationAccess): Promise<LocationPermission> {
    const settings = await this.readGrant(input);
    return settings
      ? {
          allowed: true,
          precision: settings.useApproximateLocation
            ? 'approximate'
            : 'precise',
          expiresAt: settings.sharingExpiresAt,
        }
      : { allowed: false, precision: null, expiresAt: null };
  }

  async requirePublish(userId: string, meetupId?: string): Promise<void> {
    const settings = await this.privacy.read(userId.toLowerCase());
    if (!settings || !isSharingActive(settings, new Date()))
      throw new LocationAccessError();
    const acceptedMeetupMember =
      meetupId && this.meetups
        ? await this.meetups.canPublish(userId.toLowerCase(), meetupId)
        : false;
    if (
      !canPublishLocation(settings, meetupId, acceptedMeetupMember, new Date())
    )
      throw new LocationAccessError();
  }

  async projectForViewer(input: ReadLocationAccess, sample: LocationSample) {
    const settings = await this.readGrant(input);
    if (
      !settings ||
      (settings.updatedAt && sample.recordedAt < settings.updatedAt)
    )
      throw new LocationAccessError();
    return visibleLocation(sample, settings.useApproximateLocation, new Date());
  }
}
