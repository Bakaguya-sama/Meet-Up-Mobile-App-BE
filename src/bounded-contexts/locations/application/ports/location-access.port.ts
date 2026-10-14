export const LOCATION_PRIVACY = Symbol('LOCATION_PRIVACY');
export const LOCATION_FRIENDSHIPS = Symbol('LOCATION_FRIENDSHIPS');
export const MEETUP_LOCATION_ACCESS = Symbol('MEETUP_LOCATION_ACCESS');

export interface LocationPrivacyPort {
  read(userId: string): Promise<LocationPrivacy | null>;
}

export interface LocationFriendshipsPort {
  areAccepted(userId: string, otherId: string): Promise<boolean>;
}

/** Must be backed by Meetups' public API once that context exists. Never trust client flags. */
export interface MeetupLocationAccessPort {
  canJoin(userId: string, meetupId: string): Promise<boolean>;
  canPublish(userId: string, meetupId: string): Promise<boolean>;
  canRead(
    ownerId: string,
    viewerId: string,
    meetupId: string,
  ): Promise<boolean>;
}
import type { LocationPrivacy } from '../../domain/location-visibility';
export type { LocationPrivacy } from '../../domain/location-visibility';
