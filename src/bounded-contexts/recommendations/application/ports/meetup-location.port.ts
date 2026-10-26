export const MEETUP_LOCATION = Symbol('MEETUP_LOCATION');

export interface ActiveMeetupLocation {
  userId: string;
  latitude: number;
  longitude: number;
}

export interface MeetupLocationPort {
  /**
   * Returns raw locations only for server-side recommendation calculations.
   * The Locations context rechecks privacy and meetup membership for each owner.
   */
  getActiveLocations(
    meetupId: string,
    viewerId: string,
    userIds: string[],
  ): Promise<ActiveMeetupLocation[]>;
}
