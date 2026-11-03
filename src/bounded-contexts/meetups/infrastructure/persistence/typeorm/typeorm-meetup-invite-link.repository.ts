import { Injectable } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { DataSource, EntityManager, In } from 'typeorm';
import { MeetupInviteLinkError } from '../../../domain/errors/meetup-invite-link.error';
import type { MeetupInviteLinkStorePort } from '../../../application/ports/persistence/meetup-invite-link-store.port';
import { TypeOrmTransactionalOutbox } from '../../../../../infrastructure/outbox/persistence/typeorm-outbox.port';
import { MeetupEntity } from './entities/meetup.typeorm-entity';
import { MeetupInviteLinkEntity } from './entities/meetup-invite-link.typeorm-entity';
import { ParticipantEntity } from './entities/participant.typeorm-entity';
import { ParticipantPreferenceEntity } from './entities/participant-preference.typeorm-entity';
import { MeetupTypeOrmMapper } from './mappers/meetup.typeorm-mapper';
import { writeMeetupEvents } from './meetup-outbox';

@Injectable()
export class TypeOrmMeetupInviteLinkRepository implements MeetupInviteLinkStorePort {
  constructor(private readonly dataSource: DataSource) {}

  create(input: Parameters<MeetupInviteLinkStorePort['create']>[0]) {
    return this.dataSource.transaction(async (manager) => {
      const meetup = await this.lockMeetup(manager, input.meetupId);
      const domain = await this.toDomain(manager, meetup);
      domain.assertCanCreateInviteLink(
        input.actorId,
        input.expiresAt,
        input.now,
      );

      if (input.revokePrevious) {
        await manager
          .createQueryBuilder()
          .update(MeetupInviteLinkEntity)
          .set({
            revokedAt: input.now,
            revokedById: input.actorId,
            updatedAt: input.now,
          })
          .where('meetup_id = :meetupId', { meetupId: input.meetupId })
          .andWhere('revoked_at IS NULL')
          .andWhere('expires_at > :now', { now: input.now })
          .execute();
      }

      const row = manager.create(MeetupInviteLinkEntity, {
        id: input.id,
        meetupId: input.meetupId,
        createdById: input.actorId,
        tokenHash: input.tokenHash,
        expiresAt: input.expiresAt,
        revokedAt: null,
        revokedById: null,
        useCount: 0,
        lastUsedAt: null,
        createdAt: input.now,
        updatedAt: input.now,
      });
      await manager.insert(MeetupInviteLinkEntity, row);
      return {
        id: row.id,
        meetupId: row.meetupId,
        createdById: row.createdById,
        expiresAt: row.expiresAt,
        revokedAt: row.revokedAt,
        useCount: row.useCount,
        createdAt: row.createdAt,
      };
    });
  }

  async findPreview(tokenHash: string, now: Date) {
    const row = await this.dataSource
      .getRepository(MeetupInviteLinkEntity)
      .createQueryBuilder('link')
      .innerJoin(MeetupEntity, 'meetup', 'meetup.id = link.meetup_id')
      .select([
        'link.expiresAt AS "expiresAt"',
        'meetup.title AS title',
        'meetup.scheduledAt AS "scheduledAt"',
      ])
      .where('link.token_hash = :tokenHash', { tokenHash })
      .andWhere('link.revoked_at IS NULL')
      .andWhere('link.expires_at > :now', { now })
      .andWhere('meetup.invitation_deadline_at > :now', { now })
      .andWhere('meetup.status IN (:...statuses)', {
        statuses: ['inviting', 'choosing'],
      })
      .getRawOne<{ title: string; scheduledAt: Date; expiresAt: Date }>();
    return row ?? null;
  }

  async revoke(input: Parameters<MeetupInviteLinkStorePort['revoke']>[0]) {
    await this.dataSource.transaction(async (manager) => {
      const meetup = await this.lockMeetup(manager, input.meetupId);
      const domain = await this.toDomain(manager, meetup);
      domain.assertOrganizer(input.actorId);
      const link = await manager.findOne(MeetupInviteLinkEntity, {
        where: { id: input.linkId, meetupId: input.meetupId },
        lock: { mode: 'pessimistic_write' },
      });
      if (!link) throw inviteLinkNotFound();
      if (!link.revokedAt) {
        await manager.update(MeetupInviteLinkEntity, link.id, {
          revokedAt: input.now,
          revokedById: input.actorId,
          updatedAt: input.now,
        });
      }
    });
  }

  accept(input: Parameters<MeetupInviteLinkStorePort['accept']>[0]) {
    return this.dataSource.transaction(async (manager) => {
      const lookup = await manager.findOne(MeetupInviteLinkEntity, {
        where: { tokenHash: input.tokenHash },
      });
      if (!lookup) throw inviteLinkNotFound();

      // All invite-link mutations lock meetup first, then link, so revoke/rotate
      // and accept serialize without creating a membership after revocation.
      const meetupRow = await this.lockMeetup(manager, lookup.meetupId);
      const link = await manager.findOne(MeetupInviteLinkEntity, {
        where: { tokenHash: input.tokenHash, meetupId: lookup.meetupId },
        lock: { mode: 'pessimistic_write' },
      });
      if (!link || link.revokedAt || link.expiresAt <= input.now) {
        throw inviteLinkNotFound();
      }

      const meetup = await this.toDomain(manager, meetupRow);
      const acceptedNow = meetup.acceptViaInviteLink(input.actorId, input.now);
      const participant = meetup
        .snapshot()
        .participants.find((item) => item.userId === input.actorId);
      if (!participant) throw inviteLinkNotFound();

      if (acceptedNow) {
        const state = meetup.snapshot();
        const persistence = MeetupTypeOrmMapper.toPersistence(state);
        await manager.update(MeetupEntity, state.id, persistence.meetup);
        const participantRow = persistence.participants.find(
          (item) => item.userId === input.actorId,
        );
        if (!participantRow) throw inviteLinkNotFound();
        await manager.upsert(ParticipantEntity, participantRow, [
          'meetupId',
          'userId',
        ]);
        await writeMeetupEvents(
          meetup,
          new TypeOrmTransactionalOutbox(manager),
        );
        await new TypeOrmTransactionalOutbox(manager).add(
          {
            eventId: randomUUID(),
            eventName: 'MeetupInviteLinkAccepted.v1',
            occurredAt: input.now.toISOString(),
            meetupId: state.id,
            participantId: participant.id,
            inviteLinkId: link.id,
          },
          {
            destination: 'realtime',
            recipientIds: state.participants
              .filter((item) => ['invited', 'accepted'].includes(item.status))
              .map((item) => item.userId),
          },
        );
        await manager.update(MeetupInviteLinkEntity, link.id, {
          useCount: link.useCount + 1,
          lastUsedAt: input.now,
          updatedAt: input.now,
        });
      }

      return {
        meetupId: meetupRow.id,
        participantId: participant.id,
        acceptedNow,
      };
    });
  }

  private async lockMeetup(manager: EntityManager, id: string) {
    const meetup = await manager.findOne(MeetupEntity, {
      where: { id },
      lock: { mode: 'pessimistic_write' },
    });
    if (!meetup) throw inviteLinkNotFound();
    return meetup;
  }

  private async toDomain(manager: EntityManager, row: MeetupEntity) {
    const participants = await manager.find(ParticipantEntity, {
      where: { meetupId: row.id },
    });
    const preferences = participants.length
      ? await manager.find(ParticipantPreferenceEntity, {
          where: { meetupParticipantId: In(participants.map((p) => p.id)) },
        })
      : [];
    return MeetupTypeOrmMapper.toDomain(row, participants, preferences);
  }
}

function inviteLinkNotFound(): MeetupInviteLinkError {
  return new MeetupInviteLinkError(
    'MEETUP_INVITE_LINK_NOT_FOUND',
    'Invite link is unavailable',
  );
}
