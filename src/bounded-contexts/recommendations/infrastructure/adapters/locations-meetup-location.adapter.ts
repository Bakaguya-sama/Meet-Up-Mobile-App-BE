import { Injectable } from '@nestjs/common';
import { MeetupLocationReader as LocationsMeetupLocationReader } from '../../../locations/application/public/meetup-location-reader';
import type {
  ActiveMeetupLocation,
  MeetupLocationPort,
} from '../../application/ports/meetup-location.port';

@Injectable()
export class LocationsMeetupLocationAdapter implements MeetupLocationPort {
  constructor(private readonly locations: LocationsMeetupLocationReader) {}

  getActiveLocations(
    meetupId: string,
    viewerId: string,
    userIds: string[],
  ): Promise<ActiveMeetupLocation[]> {
    return this.locations.getActiveLocations(meetupId, viewerId, userIds);
  }
}
