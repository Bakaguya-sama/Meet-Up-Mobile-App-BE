import { Injectable } from '@nestjs/common';
import { DataSource, EntityManager, In } from 'typeorm';
import { TypeOrmTransactionalOutbox } from '../../../../../infrastructure/outbox/persistence/typeorm-outbox.port';
import type {
  MeetupHistoryRecord,
  MeetupChatAccessState,
  MeetupStorePort,
} from '../../../application/ports/persistence/meetup-store.port';
import type {
  Meetup,
  MeetupState,
} from '../../../domain/aggregates/meetup.aggregate';
import { MeetupError } from '../../../domain/errors/meetup.error';
import { MeetupEntity } from './entities/meetup.typeorm-entity';
import { ParticipantEntity } from './entities/participant.typeorm-entity';
import { ParticipantPreferenceEntity } from './entities/participant-preference.typeorm-entity';
import { MeetupTypeOrmMapper } from './mappers/meetup.typeorm-mapper';
import { writeMeetupEvents } from './meetup-outbox';

@Injectable()
export class TypeOrmMeetupRepository implements MeetupStorePort {
  constructor(private readonly dataSource: DataSource) {}

  async insert(meetup: Meetup): Promise<void> {
    await this.dataSource.transaction(async (manager) => {
      const rows = MeetupTypeOrmMapper.toPersistence(meetup.snapshot());
      await manager.insert(MeetupEntity, rows.meetup);
      for (let offset = 0; offset < rows.participants.length; offset += 500) {
        await manager.insert(
          ParticipantEntity,
          rows.participants.slice(offset, offset + 500),
        );
      }
      if (rows.preferences.length > 0) {
        for (let offset = 0; offset < rows.preferences.length; offset += 500) {
          await manager.insert(
            ParticipantPreferenceEntity,
            rows.preferences.slice(offset, offset + 500),
          );
        }
      }
      await writeMeetupEvents(meetup, new TypeOrmTransactionalOutbox(manager));
    });
  }

  updateLocked(id: string, change: (meetup: Meetup) => void | Promise<void>) {
    return this.dataSource.transaction(async (manager) => {
      const row = await manager.findOne(MeetupEntity, {
        where: { id },
        lock: { mode: 'pessimistic_write' },
      });
      if (!row) throw new MeetupError('MEETUP_NOT_FOUND', 'Meetup not found');
      const { participants, preferences } =
        await this.participantsAndPreferences(manager, id);
      const meetup = MeetupTypeOrmMapper.toDomain(
        row,
        participants,
        preferences,
      );
      await change(meetup);
      const state = meetup.snapshot();
      const rows = MeetupTypeOrmMapper.toPersistence(state);
      await manager.update(MeetupEntity, id, rows.meetup);
      const changedIds = new Set(
        meetup
          .pendingEvents()
          .filter((event) => event.name === 'MeetupMemberChanged')
          .map((event) => event.userId),
      );
      const changed = rows.participants.filter((p) => changedIds.has(p.userId));
      for (let offset = 0; offset < changed.length; offset += 500) {
        await manager.upsert(
          ParticipantEntity,
          changed.slice(offset, offset + 500),
          ['meetupId', 'userId'],
        );
      }
      const preferenceEvents = meetup
        .pendingEvents()
        .filter((event) => event.name === 'PreferenceUpdated');
      if (preferenceEvents.length > 0) {
        const changedParticipantIds = new Set(
          preferenceEvents.map((e) => e.participantId!).filter(Boolean),
        );
        for (const participantId of changedParticipantIds) {
          await manager.delete(ParticipantPreferenceEntity, {
            meetupParticipantId: participantId,
          });
          const newPrefs = rows.preferences.filter(
            (p) => p.meetupParticipantId === participantId,
          );
          if (newPrefs.length > 0) {
            for (let offset = 0; offset < newPrefs.length; offset += 500) {
              await manager.insert(
                ParticipantPreferenceEntity,
                newPrefs.slice(offset, offset + 500),
              );
            }
          }
        }
      }
      await writeMeetupEvents(meetup, new TypeOrmTransactionalOutbox(manager));
      return state;
    });
  }

  findVisible(id: string, actorId: string) {
    // One consistent read snapshot prevents mixing stale membership with new details.
    return this.dataSource.transaction('REPEATABLE READ', async (manager) => {
      const row = await this.visibleQuery(manager, actorId)
        .andWhere('meetup.id = :id', { id })
        .getOne();
      if (!row) return null;
      const { participants, preferences } =
        await this.participantsAndPreferences(manager, id);
      return MeetupTypeOrmMapper.toDomain(
        row,
        participants,
        preferences,
      ).snapshot();
    });
  }

  findById(id: string): Promise<MeetupState | null> {
    return this.dataSource.transaction('REPEATABLE READ', async (manager) => {
      const row = await manager.findOne(MeetupEntity, { where: { id } });
      if (!row) return null;
      const { participants, preferences } =
        await this.participantsAndPreferences(manager, id);
      return MeetupTypeOrmMapper.toDomain(
        row,
        participants,
        preferences,
      ).snapshot();
    });
  }

  async listVisible(input: { actorId: string; offset: number; limit: number }) {
    const [items, total] = await this.visibleQuery(
      this.dataSource.manager,
      input.actorId,
    )
      .orderBy('meetup.createdAt', 'DESC')
      .addOrderBy('meetup.id', 'DESC')
      .offset(input.offset)
      .limit(input.limit)
      .getManyAndCount();
    return { items, total };
  }

  async listFinishedHistory(input: {
    actorId: string;
    offset: number;
    limit: number;
  }) {
    const [rows, total] = await this.dataSource.manager
      .getRepository(MeetupEntity)
      .createQueryBuilder('meetup')
      .innerJoin(
        ParticipantEntity,
        'membership',
        'membership.meetupId = meetup.id AND membership.userId = :actorId AND membership.status = :accepted',
        { actorId: input.actorId, accepted: 'accepted' },
      )
      .select([
        'meetup.id',
        'meetup.title',
        'meetup.description',
        'meetup.scheduledAt',
        'meetup.finishedAt',
        'meetup.chosenRunId',
        'meetup.chosenRecommendationPlaceId',
      ])
      .where('meetup.status = :finished', { finished: 'finished' })
      .andWhere('meetup.finishedAt IS NOT NULL')
      .andWhere('meetup.chosenRunId IS NOT NULL')
      .andWhere('meetup.chosenRecommendationPlaceId IS NOT NULL')
      .orderBy('meetup.finishedAt', 'DESC')
      .addOrderBy('meetup.id', 'DESC')
      .offset(input.offset)
      .limit(input.limit)
      .getManyAndCount();
    const items: MeetupHistoryRecord[] = rows.flatMap((row) => {
      if (
        !row.finishedAt ||
        !row.chosenRunId ||
        !row.chosenRecommendationPlaceId
      ) {
        return [];
      }
      return [
        {
          id: row.id,
          title: row.title,
          description: row.description,
          scheduledAt: row.scheduledAt,
          finishedAt: row.finishedAt,
          chosenRunId: row.chosenRunId,
          chosenRecommendationPlaceId: row.chosenRecommendationPlaceId,
        },
      ];
    });
    return { items, total };
  }

  async areAcceptedInActiveMeetup(
    meetupId: string,
    userIds: string[],
  ): Promise<boolean> {
    const ids = [...new Set(userIds)];
    if (!ids.length) return false;
    const count = await this.dataSource
      .getRepository(ParticipantEntity)
      .createQueryBuilder('participant')
      .innerJoin(MeetupEntity, 'meetup', 'meetup.id = participant.meetupId')
      .where('meetup.id = :meetupId', { meetupId })
      .andWhere('meetup.status IN (:...active)', {
        active: ['inviting', 'choosing', 'selected'],
      })
      .andWhere('participant.userId IN (:...ids)', { ids })
      .andWhere('participant.status = :accepted', { accepted: 'accepted' })
      .getCount();
    return count === ids.length;
  }

  async findAcceptedParticipantId(
    meetupId: string,
    userId: string,
  ): Promise<string | null> {
    const row = await this.dataSource
      .getRepository(ParticipantEntity)
      .createQueryBuilder('participant')
      .innerJoin(MeetupEntity, 'meetup', 'meetup.id = participant.meetupId')
      .select('participant.id', 'id')
      .where('meetup.id = :meetupId', { meetupId })
      .andWhere('meetup.status IN (:...active)', {
        active: ['inviting', 'choosing', 'selected'],
      })
      .andWhere('participant.userId = :userId', { userId })
      .andWhere('participant.status = :accepted', { accepted: 'accepted' })
      .getRawOne<{ id: string }>();
    return row?.id ?? null;
  }

  async getChatAccess(
    meetupId: string,
    userId: string,
  ): Promise<MeetupChatAccessState | null> {
    const row = await this.dataSource
      .getRepository(ParticipantEntity)
      .createQueryBuilder('participant')
      .innerJoin(MeetupEntity, 'meetup', 'meetup.id = participant.meetupId')
      .select('participant.status', 'participant_status')
      .addSelect('participant.leftAt', 'participant_left_at')
      .addSelect('meetup.status', 'meetup_status')
      .where('meetup.id = :meetupId', { meetupId })
      .andWhere('participant.userId = :userId', { userId })
      .getRawOne<{
        participant_status: string;
        participant_left_at: Date | null;
        meetup_status: string;
      }>();
    if (!row) return null;

    const active = ['inviting', 'choosing', 'selected'].includes(
      row.meetup_status,
    );
    if (active && row.participant_status === 'accepted') {
      return { canSend: true };
    }
    if (
      ['left', 'removed'].includes(row.participant_status) &&
      row.participant_left_at
    ) {
      return {
        canSend: false,
        historyVisibleUntil: new Date(row.participant_left_at),
      };
    }
    return null;
  }

  async listActiveChatRecipientIds(meetupId: string): Promise<string[]> {
    const rows = await this.dataSource
      .getRepository(ParticipantEntity)
      .createQueryBuilder('participant')
      .innerJoin(MeetupEntity, 'meetup', 'meetup.id = participant.meetupId')
      .select('participant.userId', 'user_id')
      .where('meetup.id = :meetupId', { meetupId })
      .andWhere('meetup.status IN (:...active)', {
        active: ['inviting', 'choosing', 'selected'],
      })
      .andWhere('participant.status = :accepted', { accepted: 'accepted' })
      .orderBy('participant.userId', 'ASC')
      .getRawMany<{ user_id: string }>();
    return rows.map((row) => row.user_id);
  }

  private visibleQuery(manager: EntityManager, actorId: string) {
    return manager
      .getRepository(MeetupEntity)
      .createQueryBuilder('meetup')
      .innerJoin(
        ParticipantEntity,
        'membership',
        'membership.meetupId = meetup.id AND membership.userId = :actorId',
        { actorId },
      )
      .where('membership.status IN (:...visible)', {
        visible: ['invited', 'accepted'],
      });
  }

  private async participantsAndPreferences(
    manager: EntityManager,
    meetupId: string,
  ) {
    const participants = await manager.find(ParticipantEntity, {
      where: { meetupId },
      order: { id: 'ASC' },
    });
    const participantIds = participants.map((p) => p.id);
    const preferences = participantIds.length
      ? await manager.find(ParticipantPreferenceEntity, {
          where: { meetupParticipantId: In(participantIds) },
        })
      : [];
    return { participants, preferences };
  }
}
