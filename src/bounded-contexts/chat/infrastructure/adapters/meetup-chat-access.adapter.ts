import { Injectable } from '@nestjs/common';
import { MeetupMembershipReader } from '../../../meetups/application/public/meetup-membership-reader';
import type { MeetupChatAccessPort } from '../../application/ports/meetup-chat-access.port';

@Injectable()
export class MeetupChatAccessAdapter implements MeetupChatAccessPort {
  constructor(private readonly membership: MeetupMembershipReader) {}

  canUseChat(meetupId: string, userId: string): Promise<boolean> {
    return this.membership.areAcceptedInActiveMeetup(meetupId, [userId]);
  }
}
