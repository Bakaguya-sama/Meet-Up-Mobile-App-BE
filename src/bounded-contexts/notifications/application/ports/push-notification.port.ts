export const PUSH_NOTIFICATION = Symbol('PUSH_NOTIFICATION');

export type PushData = {
  type: string;
  meetupId: string;
  placeId?: string;
};

export interface PushNotificationPort {
  send(input: {
    recipientId: string;
    title: string;
    body: string;
    data: PushData;
    eventId: string;
  }): Promise<void>;
}
