import { Meetup } from '../../../../domain/aggregates/meetup.aggregate';
import type { MeetupState } from '../../../../domain/aggregates/meetup.aggregate';
import { MeetupEntity } from '../entities/meetup.typeorm-entity';
import { ParticipantEntity } from '../entities/participant.typeorm-entity';

export class MeetupTypeOrmMapper {
  static toDomain(
    row: MeetupEntity,
    participants: ParticipantEntity[],
  ): Meetup {
    return Meetup.reconstitute({
      ...row,
      participants: participants.map((p) => ({
        id: p.id,
        userId: p.userId,
        status: p.status,
        invitedById: p.invitedById,
        respondedAt: p.respondedAt,
        joinedAt: p.joinedAt,
        leftAt: p.leftAt,
      })),
    });
  }
  static toPersistence(state: MeetupState) {
    const { participants, ...details } = state;
    return {
      meetup: Object.assign(new MeetupEntity(), details),
      participants: participants.map((p) =>
        Object.assign(new ParticipantEntity(), p, { meetupId: state.id }),
      ),
    };
  }
}
