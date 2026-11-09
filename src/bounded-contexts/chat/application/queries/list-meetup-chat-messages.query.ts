import { ChatError } from '../../domain/errors/chat.error';
import type { MeetupChatAccessPort } from '../ports/meetup-chat-access.port';
import type { MeetupChatStore } from '../ports/meetup-chat-store.port';

export class ListMeetupChatMessagesQuery {
  constructor(
    private readonly store: MeetupChatStore,
    private readonly membership: MeetupChatAccessPort,
  ) {}

  async execute(input: {
    actorId: string;
    meetupId: string;
    before?: Date;
    beforeId?: string;
    limit: number;
  }) {
    if (!!input.before !== !!input.beforeId) {
      throw new ChatError(
        'INVALID_INPUT',
        'before and beforeId must be provided together',
      );
    }
    const access = await this.membership.getHistoryAccess(
      input.meetupId,
      input.actorId,
    );
    if (!access) {
      throw new ChatError(
        'CHAT_FORBIDDEN',
        'Only members and former members with retained history can read chat',
      );
    }
    return this.store.list({
      meetupId: input.meetupId.toLowerCase(),
      before: input.before,
      beforeId: input.beforeId,
      historyVisibleUntil: access.historyVisibleUntil,
      limit: Math.min(Math.max(input.limit, 1), 100),
    });
  }
}
