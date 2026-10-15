import type { MeetupDetails } from '../../domain/aggregates/meetup.aggregate';
import { MeetupError } from '../../domain/errors/meetup.error';
import type { UpdateMeetupRequest } from '../dto/meetup-request.dto';
import { toMeetupDetail } from '../dto/meetup-response.dto';
import type { MeetupStorePort } from '../ports/persistence/meetup-store.port';

export class UpdateMeetupUseCase {
  constructor(private readonly store: MeetupStorePort) {}
  async execute(actorId: string, meetupId: string, input: UpdateMeetupRequest) {
    const { scheduledAt, invitationDeadlineAt, ...rest } = input;
    const patch: Partial<MeetupDetails> = Object.fromEntries(
      Object.entries(rest).filter(([, value]) => value !== undefined),
    );
    if (scheduledAt !== undefined) patch.scheduledAt = new Date(scheduledAt);
    if (invitationDeadlineAt !== undefined)
      patch.invitationDeadlineAt = new Date(invitationDeadlineAt);
    if (!Object.keys(patch).length)
      throw new MeetupError(
        'INVALID_INPUT',
        'Provide at least one field to update',
      );
    const state = await this.store.updateLocked(
      meetupId.toLowerCase(),
      (meetup) => meetup.update(actorId.toLowerCase(), patch, new Date()),
    );
    return toMeetupDetail(state);
  }
}
