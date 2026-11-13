export const MEETUP_CHAT_ACCESS = Symbol('MEETUP_CHAT_ACCESS');

export interface MeetupChatHistoryAccess {
  canSend: boolean;
  historyVisibleUntil?: Date;
}

export interface MeetupChatAccessPort {
  canSendChat(meetupId: string, userId: string): Promise<boolean>;
  getHistoryAccess(
    meetupId: string,
    userId: string,
  ): Promise<MeetupChatHistoryAccess | null>;
}
