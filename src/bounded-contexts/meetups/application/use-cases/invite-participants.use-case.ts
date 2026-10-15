import { randomUUID } from 'node:crypto';
import { MeetupError } from '../../domain/errors/meetup.error';
import { toMeetupDetail } from '../dto/meetup-response.dto';
import type { InviteeEligibilityPort } from '../ports/invitee-eligibility.port';
import type { MeetupStorePort } from '../ports/persistence/meetup-store.port';

export class InviteParticipantsUseCase {
  constructor(
    private readonly store: MeetupStorePort,
    private readonly eligibility: InviteeEligibilityPort,
  ) {}
  async execute(actorId: string, meetupId: string, userIds: string[]) {
    actorId = actorId.toLowerCase();
    userIds = userIds.map((id) => id.toLowerCase());
    const state = await this.store.updateLocked(
      meetupId.toLowerCase(),
      async (meetup) => {
        meetup.assertCanInvite(actorId, userIds, new Date());
        const eligible = new Set(
          await this.eligibility.eligibleIds(actorId, userIds),
        );
        if (userIds.some((id) => !eligible.has(id)))
          throw new MeetupError(
            'MEETUP_INVITEE_UNAVAILABLE',
            'Invitees must be active accepted friends',
          );
        meetup.invite(
          actorId,
          userIds.map((userId) => ({ id: randomUUID(), userId })),
          new Date(),
        );
      },
    );
    return toMeetupDetail(state);
  }
}
