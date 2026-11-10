import { Injectable } from '@nestjs/common';
import { MeetupMembershipReader } from '../../../meetups/application/public/meetup-membership-reader';
import type { MeetupChatAccessPort } from '../../application/ports/meetup-chat-access.port';

@Injectable()
export class MeetupChatAccessAdapter implements MeetupChatAccessPort {
  constructor(private readonly membership: MeetupMembershipReader) {}

  canSendChat(meetupId: string, userId: string): Promise<boolean> {
    return this.membership.areAcceptedInActiveMeetup(meetupId, [userId]);
  }

  getHistoryAccess(meetupId: string, userId: string) {
    return this.membership.getChatAccess(meetupId, userId);
  }

  listActiveRecipientIds(meetupId: string): Promise<string[]> {
    return this.membership.listActiveChatRecipientIds(meetupId);
  }
}
