export const REALTIME_PUBLISHER = Symbol('REALTIME_PUBLISHER');

export interface RealtimeMessage {
  room: string;
  eventName: string;
  eventId: string;
  payload: Record<string, unknown>;
}

export interface RealtimePublisherPort {
  publish(message: RealtimeMessage): Promise<void>;
}

export const realtimeRooms = {
  meetup: (meetupId: string): string => `meetup:${meetupId}`,
  user: (userId: string): string => `user:${userId}`,
} as const;
