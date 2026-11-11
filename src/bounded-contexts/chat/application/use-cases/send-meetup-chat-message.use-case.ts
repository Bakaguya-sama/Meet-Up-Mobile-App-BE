import { randomUUID } from 'node:crypto';
import { ChatError } from '../../domain/errors/chat.error';
import type { MeetupChatAccessPort } from '../ports/meetup-chat-access.port';
import type { ChatMessagePublisherPort } from '../ports/chat-message-publisher.port';
import type { MeetupChatStore } from '../ports/meetup-chat-store.port';
import type { IncomingChatFile } from '../services/chat-attachment.service';
import { ChatAttachmentService } from '../services/chat-attachment.service';

export class SendMeetupChatMessageUseCase {
  constructor(
    private readonly store: MeetupChatStore,
    private readonly membership: MeetupChatAccessPort,
    private readonly publisher: ChatMessagePublisherPort,
    private readonly attachmentService?: ChatAttachmentService,
  ) {}

  async execute(input: {
    actorId: string;
    meetupId: string;
    text?: string;
    files?: IncomingChatFile[];
  }) {
    if (!(await this.membership.canSendChat(input.meetupId, input.actorId))) {
      throw new ChatError(
        'CHAT_FORBIDDEN',
        'Only accepted members of an active meetup can use chat',
      );
    }
    const text = input.text?.trim() ?? '';
    const files = input.files ?? [];
    if ((!text && !files.length) || text.length > 2000) {
      throw new ChatError(
        'INVALID_INPUT',
        'Message must contain text or at least one attachment; text is limited to 2000 characters',
      );
    }
    if (files.length && !this.attachmentService) {
      throw new ChatError('INVALID_INPUT', 'File attachments are unavailable');
    }
    const attachments = files.length
      ? await this.attachmentService!.upload(files)
      : [];
    let attachmentViews;
    try {
      attachmentViews = this.attachmentService
        ? await this.attachmentService.createViews(attachments)
        : [];
    } catch (error) {
      await this.attachmentService?.delete(attachments);
      throw error;
    }
    const message = {
      id: randomUUID(),
      meetupId: input.meetupId.toLowerCase(),
      senderUserId: input.actorId,
      textContent: text,
      sentAt: new Date(),
      attachments,
    };
    try {
      await this.store.append(message);
    } catch (error) {
      await this.attachmentService?.delete(attachments);
      throw error;
    }
    const view = { ...message, attachments: attachmentViews };
    await this.publisher.publish(view);
    return view;
  }
}
