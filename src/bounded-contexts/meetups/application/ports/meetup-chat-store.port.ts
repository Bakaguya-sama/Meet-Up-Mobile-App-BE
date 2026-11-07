export interface MeetupChatMessage {
  id: string;
  meetupId: string;
  senderUserId: string;
  textContent: string;
  sentAt: Date;
}

export const MEETUP_CHAT_STORE = Symbol('MEETUP_CHAT_STORE');
export interface MeetupChatStore {
  append(input: MeetupChatMessage): Promise<void>;
  list(input: {
    meetupId: string;
    before?: Date;
    limit: number;
  }): Promise<MeetupChatMessage[]>;
}
