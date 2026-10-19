import { randomUUID } from 'node:crypto';
import { Meetup } from '../../domain/aggregates/meetup.aggregate';
import { MeetupError } from '../../domain/errors/meetup.error';
import type { CreateMeetupRequest } from '../dto/meetup-request.dto';
import { toMeetupDetail } from '../dto/meetup-response.dto';
import type { InviteeEligibilityPort } from '../ports/invitee-eligibility.port';
import type { MeetupStorePort } from '../ports/persistence/meetup-store.port';

export class CreateMeetupUseCase {
  constructor(
    private readonly store: MeetupStorePort,
    private readonly eligibility: InviteeEligibilityPort,
  ) {}

  async execute(actorId: string, input: CreateMeetupRequest) {
    actorId = actorId.toLowerCase();
    const inviteeIds = input.inviteeIds.map((id) => id.toLowerCase());
    const meetup = Meetup.create(
      {
        ...input,
        description: input.description ?? null,
        recommendationMode: input.recommendationMode ?? 'balanced',
        scheduledAt: new Date(input.scheduledAt),
        invitationDeadlineAt: new Date(input.invitationDeadlineAt),
        id: randomUUID(),
        organizerId: actorId,
        organizerParticipantId: randomUUID(),
        invitees: inviteeIds.map((userId) => ({ id: randomUUID(), userId })),
      },
      new Date(),
    );
    const eligible = new Set(
      await this.eligibility.eligibleIds(actorId, inviteeIds),
    );
    if (inviteeIds.some((id) => !eligible.has(id)))
      throw new MeetupError(
        'MEETUP_INVITEE_UNAVAILABLE',
        'Invitees must be active accepted friends',
      );
    await this.store.insert(meetup);
    return toMeetupDetail(meetup.snapshot());
  }
}
