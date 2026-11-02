import { Injectable } from '@nestjs/common';
import { MeetupScheduleReader } from '../../../meetups/application/public/meetup-schedule-reader';
import type { MeetupSchedulePort } from '../../application/ports/meetup-schedule.port';

@Injectable()
export class MeetupsScheduleAdapter implements MeetupSchedulePort {
  constructor(private readonly schedules: MeetupScheduleReader) {}

  getScheduledAt(meetupId: string): Promise<Date> {
    return this.schedules.getScheduledAt(meetupId);
  }
}
