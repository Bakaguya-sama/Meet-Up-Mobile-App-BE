import type { LocationPort } from '../ports/location.port';
import { LocationAccessService } from '../services/location-access.service';
import { LocationAccessError } from '../../domain/location-visibility';

export interface ActiveMeetupLocation {
  userId: string;
  latitude: number;
  longitude: number;
}

export abstract class MeetupLocationReader {
  abstract getActiveLocations(
    meetupId: string,
    viewerId: string,
    userIds: string[],
  ): Promise<ActiveMeetupLocation[]>;
}

/** Internal server-side reader for recommendation calculations. */
export class LocationMeetupReader extends MeetupLocationReader {
  constructor(
    private readonly access: LocationAccessService,
    private readonly locations: LocationPort,
  ) {
    super();
  }

  async getActiveLocations(
    meetupId: string,
    viewerId: string,
    userIds: string[],
  ): Promise<ActiveMeetupLocation[]> {
    const uniqueUserIds = [...new Set(userIds.map((id) => id.toLowerCase()))];
    const result = await Promise.all(
      uniqueUserIds.map(async (userId) => {
        try {
          const sample =
            (await this.locations.get(userId, meetupId)) ??
            (await this.locations.get(userId));
          const projected = sample
            ? await this.access.projectForViewer(
                { ownerId: userId, viewerId, scope: 'meetup', meetupId },
                sample,
              )
            : null;
          return projected
            ? {
                userId,
                latitude: projected.latitude,
                longitude: projected.longitude,
              }
            : null;
        } catch (error) {
          if (error instanceof LocationAccessError) {
            return null;
          }
          throw error;
        }
      }),
    );
    return result.filter(
      (location): location is ActiveMeetupLocation => !!location,
    );
  }
}
