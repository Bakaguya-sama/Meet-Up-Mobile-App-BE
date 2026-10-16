import { Meetup } from '../../../../domain/aggregates/meetup.aggregate';
import type {
  MeetupState,
  ParticipantPreferenceState,
} from '../../../../domain/aggregates/meetup.aggregate';
import { MeetupEntity } from '../entities/meetup.typeorm-entity';
import { ParticipantEntity } from '../entities/participant.typeorm-entity';
import { ParticipantPreferenceEntity } from '../entities/participant-preference.typeorm-entity';

export class MeetupTypeOrmMapper {
  static toDomain(
    row: MeetupEntity,
    participants: ParticipantEntity[],
    preferences: ParticipantPreferenceEntity[] = [],
  ): Meetup {
    const prefMap = new Map<string, ParticipantPreferenceState[]>();
    for (const pref of preferences) {
      const list = prefMap.get(pref.meetupParticipantId) ?? [];
      list.push({
        activityTagId: pref.activityTagId,
        level: pref.level,
        source: pref.source,
        updatedAt: pref.updatedAt,
      });
      prefMap.set(pref.meetupParticipantId, list);
    }

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
        preferences: prefMap.get(p.id) ?? [],
      })),
    });
  }

  static toPersistence(state: MeetupState) {
    const { participants, ...details } = state;
    return {
      meetup: Object.assign(new MeetupEntity(), details),
      participants: participants.map((p) =>
        Object.assign(
          new ParticipantEntity(),
          {
            id: p.id,
            userId: p.userId,
            status: p.status,
            invitedById: p.invitedById,
            respondedAt: p.respondedAt,
            joinedAt: p.joinedAt,
            leftAt: p.leftAt,
          },
          { meetupId: state.id },
        ),
      ),
      preferences: participants.flatMap((p) =>
        (p.preferences ?? []).map((pref) =>
          Object.assign(new ParticipantPreferenceEntity(), {
            meetupParticipantId: p.id,
            activityTagId: pref.activityTagId,
            level: pref.level,
            source: pref.source,
            updatedAt: pref.updatedAt,
          }),
        ),
      ),
    };
  }
}
