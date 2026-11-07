export const MEETUP_CHAT_ACCESS = Symbol('MEETUP_CHAT_ACCESS');

export interface MeetupChatAccessPort {
  canUseChat(meetupId: string, userId: string): Promise<boolean>;
}
