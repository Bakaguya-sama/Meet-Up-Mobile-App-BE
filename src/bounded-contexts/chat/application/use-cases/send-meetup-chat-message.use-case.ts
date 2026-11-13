import { randomUUID } from 'node:crypto';
import { ChatError } from '../../domain/errors/chat.error';
import type { MeetupChatAccessPort } from '../ports/meetup-chat-access.port';
import type { MeetupChatStore } from '../ports/meetup-chat-store.port';
import type { IncomingChatFile } from '../services/chat-attachment.service';
import { ChatAttachmentService } from '../services/chat-attachment.service';

export class SendMeetupChatMessageUseCase {
  constructor(
    private readonly store: MeetupChatStore,
    private readonly membership: MeetupChatAccessPort,
    private readonly attachmentService?: ChatAttachmentService,
  ) {}

  async execute(input: {
    actorId: string;
    meetupId: string;
    clientMessageId: string;
    text?: string;
    files?: IncomingChatFile[];
  }) {
    const meetupId = input.meetupId.toLowerCase();
    const existing = await this.store.findByClientMessageId({
      meetupId,
      actorId: input.actorId,
      clientMessageId: input.clientMessageId,
    });
    if (existing) {
      return {
        ...existing,
        attachments: this.attachmentService
          ? await this.attachmentService.createViews(existing.attachments ?? [])
          : [],
      };
    }
    if (!(await this.membership.canSendChat(meetupId, input.actorId))) {
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
      ? await this.attachmentService!.upload(files, {
          scope: `meetup/${meetupId}`,
          clientMessageId: input.clientMessageId,
        })
      : [];
    const message = {
      id: randomUUID(),
      meetupId,
      senderUserId: input.actorId,
      clientMessageId: input.clientMessageId,
      textContent: text,
      sentAt: new Date(),
      attachments,
    };
    let persisted;
    try {
      persisted = await this.store.append(message);
    } catch (error) {
      await this.attachmentService?.delete(attachments);
      throw error;
    }
    if (persisted.id !== message.id) {
      await this.attachmentService?.delete(
        attachments.filter(
          (attachment) =>
            !persisted.attachments?.some(
              (stored) => stored.storageKey === attachment.storageKey,
            ),
        ),
      );
    }
    return {
      ...persisted,
      attachments: this.attachmentService
        ? await this.attachmentService.createViews(persisted.attachments ?? [])
        : [],
    };
  }
}
