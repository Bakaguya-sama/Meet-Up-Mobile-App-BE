import { randomUUID } from 'node:crypto';
import { MeetupError } from '../../domain/errors/meetup.error';
import { MeetupMembershipReader } from '../public/meetup-membership-reader';
import type { ChatMessagePublisherPort } from '../ports/chat-message-publisher.port';
import type { MeetupChatStore } from '../ports/meetup-chat-store.port';

export class SendMeetupChatMessageUseCase {
  constructor(
    private readonly store: MeetupChatStore,
    private readonly membership: MeetupMembershipReader,
    private readonly publisher: ChatMessagePublisherPort,
  ) {}

  async execute(input: { actorId: string; meetupId: string; text: string }) {
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
    const text = input.text.trim();
    if (!text || text.length > 2000) {
      throw new MeetupError(
        'INVALID_INPUT',
        'Message must contain 1 to 2000 characters',
      );
    }
    const message = {
      id: randomUUID(),
      meetupId: input.meetupId.toLowerCase(),
      senderUserId: input.actorId,
      textContent: text,
      sentAt: new Date(),
    };
    await this.store.append(message);
    await this.publisher.publish(message);
    return message;
  }
}
