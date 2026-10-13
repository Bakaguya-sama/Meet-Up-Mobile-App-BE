import { Injectable } from '@nestjs/common';
import type { MeetupLocationAccessPort } from '../../application/ports/location-access.port';

/** Safe default until Meetups exposes accepted-membership and active-status contracts. */
@Injectable()
export class MeetupLocationAdapter implements MeetupLocationAccessPort {
  canPublish(): Promise<boolean> {
    return Promise.resolve(false);
  }

  canRead(): Promise<boolean> {
    return Promise.resolve(false);
  }
}
