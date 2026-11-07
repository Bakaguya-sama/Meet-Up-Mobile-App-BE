import { MeetupError } from '../../domain/errors/meetup.error';
import { MeetupMembershipReader } from '../public/meetup-membership-reader';
import type { MeetupChatStore } from '../ports/meetup-chat-store.port';

export class ListMeetupChatMessagesQuery {
  constructor(
    private readonly store: MeetupChatStore,
    private readonly membership: MeetupMembershipReader,
  ) {}

  async execute(input: {
    actorId: string;
    meetupId: string;
    before?: Date;
    limit: number;
  }) {
    if (
      !(await this.membership.areAcceptedInActiveMeetup(input.meetupId, [
        input.actorId,
      ]))
    ) {
      throw new MeetupError(
        'MEETUP_FORBIDDEN',
        'Only accepted members of an active meetup can use chat',
      );
    }
    return this.store.list({
      meetupId: input.meetupId.toLowerCase(),
      before: input.before,
      limit: Math.min(Math.max(input.limit, 1), 100),
    });
  }
}
