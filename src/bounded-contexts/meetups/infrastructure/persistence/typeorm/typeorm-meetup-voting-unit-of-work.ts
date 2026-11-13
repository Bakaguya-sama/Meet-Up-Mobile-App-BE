import { createHash } from 'node:crypto';
import { Injectable } from '@nestjs/common';
import { DataSource, In } from 'typeorm';
import { TypeOrmTransactionalOutbox } from '../../../../../infrastructure/outbox/persistence/typeorm-outbox.port';
import type {
  MeetupVotingTransaction,
  MeetupVotingUnitOfWork,
} from '../../../application/ports/meetup-voting-unit-of-work.port';
import { MeetupError } from '../../../domain/errors/meetup.error';
import { MeetupEntity } from './entities/meetup.typeorm-entity';
import { MeetupVoteEntity } from './entities/meetup-vote.typeorm-entity';
import { ParticipantEntity } from './entities/participant.typeorm-entity';
import { ParticipantPreferenceEntity } from './entities/participant-preference.typeorm-entity';
import { MeetupTypeOrmMapper } from './mappers/meetup.typeorm-mapper';
import { writeMeetupEvents } from './meetup-outbox';

@Injectable()
export class TypeOrmMeetupVotingUnitOfWork implements MeetupVotingUnitOfWork {
  constructor(private readonly dataSource: DataSource) {}

  runLocked<T>(
    meetupId: string,
    work: (tx: MeetupVotingTransaction) => Promise<T>,
  ): Promise<T> {
    return this.dataSource.transaction(async (manager) => {
      const row = await manager.findOne(MeetupEntity, {
        where: { id: meetupId.toLowerCase() },
        lock: { mode: 'pessimistic_write' },
      });
      if (!row) throw new MeetupError('MEETUP_NOT_FOUND', 'Meetup not found');
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
      const meetup = MeetupTypeOrmMapper.toDomain(
        row,
        participants,
        preferences,
      );
      const tx: MeetupVotingTransaction = {
        meetup,
        outbox: new TypeOrmTransactionalOutbox(manager),
        findVote: async (participantId) => {
          const vote = await manager.findOne(MeetupVoteEntity, {
            where: { meetupId, meetupParticipantId: participantId },
          });
          return vote ? vote : null;
        },
        listVotes: async (runId) =>
          manager.find(MeetupVoteEntity, { where: { meetupId, runId } }),
        saveVote: async (vote) => {
          await manager.upsert(MeetupVoteEntity, vote, [
            'meetupId',
            'meetupParticipantId',
          ]);
        },
        recordRecommendationFeedback: async (input) => {
          const payload = {
            eventId: input.eventId,
            runId: input.runId,
            meetupParticipantId: input.meetupParticipantId,
            eventType: input.eventType,
            canonicalCandidateKey: input.canonicalCandidateKey,
            fromCanonicalCandidateKey: input.fromCanonicalCandidateKey ?? null,
            occurredAt: input.occurredAt.toISOString(),
          };
          await manager.query(
            `INSERT INTO recommendation_feedback_events
              (event_id, run_id, meetup_participant_id, event_type,
               canonical_candidate_key, from_canonical_candidate_key,
               payload_hash, occurred_at, metadata, created_at)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, '{}'::jsonb, NOW())`,
            [
              input.eventId,
              input.runId,
              input.meetupParticipantId,
              input.eventType,
              input.canonicalCandidateKey,
              input.fromCanonicalCandidateKey ?? null,
              createHash('sha256')
                .update(JSON.stringify(payload))
                .digest('hex'),
              input.occurredAt,
            ],
          );
        },
      };
      const result = await work(tx);
      const rows = MeetupTypeOrmMapper.toPersistence(meetup.snapshot());
      await manager.update(MeetupEntity, meetupId, rows.meetup);
      await writeMeetupEvents(meetup, tx.outbox);
      return result;
    });
  }
}
