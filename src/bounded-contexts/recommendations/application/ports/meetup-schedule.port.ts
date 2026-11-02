export const MEETUP_SCHEDULE = Symbol('MEETUP_SCHEDULE');

export interface MeetupSchedulePort {
  getScheduledAt(meetupId: string): Promise<Date>;
}
