import { Injectable } from '@nestjs/common';
import type { MeetupLocationAccessPort } from '../../application/ports/location-access.port';
import { MeetupMembershipReader } from '../../../meetups/application/public/meetup-membership-reader';

/** Membership is rechecked on every access through Meetups' public read API. */
@Injectable()
export class MeetupLocationAdapter implements MeetupLocationAccessPort {
  constructor(private readonly meetups: MeetupMembershipReader) {}

  canJoin(userId: string, meetupId: string): Promise<boolean> {
    return this.meetups.areAcceptedInActiveMeetup(meetupId, [userId]);
  }

  canPublish(userId: string, meetupId: string): Promise<boolean> {
    return this.meetups.areAcceptedInActiveMeetup(meetupId, [userId]);
  }

  canRead(
    ownerId: string,
    viewerId: string,
    meetupId: string,
  ): Promise<boolean> {
    return this.meetups.areAcceptedInActiveMeetup(meetupId, [
      ownerId,
      viewerId,
    ]);
  }
}
