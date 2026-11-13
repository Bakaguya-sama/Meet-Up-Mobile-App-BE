import { createHash } from 'node:crypto';
import { Injectable } from '@nestjs/common';
import { DataSource, EntityManager, QueryFailedError } from 'typeorm';
import type {
  RecommendationFeedbackLedger,
  RecordFeedbackInput,
  RecordImpressionInput,
} from '../../../application/ports/recommendation-feedback-ledger.port';
import { RecommendationError } from '../../../domain/recommendation.error';
import { RecommendationFeedbackEventEntity } from './entities/recommendation-feedback-event.typeorm-entity';
import { RecommendationImpressionEntity } from './entities/recommendation-impression.typeorm-entity';

@Injectable()
export class TypeOrmRecommendationFeedbackLedger implements RecommendationFeedbackLedger {
  constructor(private readonly dataSource: DataSource) {}

  async recordImpression(
    actorId: string,
    meetupId: string,
    runId: string,
    input: RecordImpressionInput,
  ) {
    if (!Number.isInteger(input.rank) || input.rank < 1) {
      throw new RecommendationError(
        'INVALID_RECOMMENDATION_REQUEST',
        'Invalid impression rank',
      );
    }
    const payload = { ...input, eventId: input.eventId.toLowerCase() };
    return this.dataSource.transaction(async (manager) => {
      const participant = await findAcceptedParticipant(
        manager,
        actorId,
        meetupId,
        runId,
      );
      await assertCandidate(manager, runId, input.canonicalCandidateKey);
      return insertIdempotently(
        manager,
        RecommendationImpressionEntity,
        input.eventId,
        payload,
        {
          eventId: input.eventId.toLowerCase(),
          runId,
          meetupParticipantId: participant.id,
          canonicalCandidateKey: input.canonicalCandidateKey,
          rank: input.rank,
          payloadHash: hash(payload),
          shownAt: validDate(input.shownAt),
          createdAt: new Date(),
        },
      );
    });
  }

  async recordFeedback(
    actorId: string,
    meetupId: string,
    runId: string,
    input: RecordFeedbackInput,
  ) {
    const payload = { ...input, eventId: input.eventId.toLowerCase() };
    return this.dataSource.transaction(async (manager) => {
      const participant = await findAcceptedParticipant(
        manager,
        actorId,
        meetupId,
        runId,
      );
      if (input.canonicalCandidateKey) {
        await assertCandidate(manager, runId, input.canonicalCandidateKey);
        if (
          input.eventType !== 'MEETUP_PLACE_SELECTED' &&
          !(await manager.exists(RecommendationImpressionEntity, {
            where: {
              runId,
              meetupParticipantId: participant.id,
              canonicalCandidateKey: input.canonicalCandidateKey,
            },
          }))
        ) {
          throw new RecommendationError(
            'RECOMMENDATION_NOT_SHOWN',
            'Feedback is unknown until this candidate has been shown to the participant',
          );
        }
      }
      if (input.fromCanonicalCandidateKey)
        await assertCandidate(manager, runId, input.fromCanonicalCandidateKey);
      return insertIdempotently(
        manager,
        RecommendationFeedbackEventEntity,
        input.eventId,
        payload,
        {
          eventId: input.eventId.toLowerCase(),
          runId,
          meetupParticipantId: participant.id,
          eventType: input.eventType,
          canonicalCandidateKey: input.canonicalCandidateKey ?? null,
          fromCanonicalCandidateKey: input.fromCanonicalCandidateKey ?? null,
          payloadHash: hash(payload),
          occurredAt: validDate(input.occurredAt),
          metadata: {},
          createdAt: new Date(),
        },
      );
    });
  }
}

async function findAcceptedParticipant(
  manager: EntityManager,
  actorId: string,
  meetupId: string,
  runId: string,
) {
  const rows = await manager.query<Array<{ id: string }>>(
    `SELECT participant.id FROM recommendation_runs run
     INNER JOIN meetup_participants participant ON participant.meetup_id = run.meetup_id
     WHERE run.id = $1 AND run.meetup_id = $2 AND participant.user_id = $3 AND participant.status = 'accepted'`,
    [runId, meetupId, actorId.toLowerCase()],
  );
  if (!rows[0])
    throw new RecommendationError(
      'RECOMMENDATION_RUN_FORBIDDEN',
      'Accepted meetup membership is required',
    );
  return rows[0];
}

async function assertCandidate(
  manager: EntityManager,
  runId: string,
  key: string,
) {
  const rows = await manager.query<Array<{ canonical_candidate_key: string }>>(
    'SELECT canonical_candidate_key FROM recommendation_candidates WHERE run_id = $1 AND canonical_candidate_key = $2',
    [runId, key],
  );
  if (!rows[0])
    throw new RecommendationError(
      'RECOMMENDATION_CANDIDATE_NOT_FOUND',
      'Candidate does not belong to this run',
    );
}

async function insertIdempotently<
  T extends { eventId: string; payloadHash: string },
>(
  manager: EntityManager,
  entity: new () => T,
  eventId: string,
  payload: object,
  values: T,
) {
  const normalizedId = eventId.toLowerCase();
  const payloadHash = hash(payload);
  const existing = await manager.findOne(entity, {
    where: { eventId: normalizedId } as never,
    lock: { mode: 'pessimistic_read' },
  });
  if (existing)
    return equalPayload(existing.payloadHash, payloadHash, normalizedId);
  try {
    await manager.insert(entity, values as never);
  } catch (error) {
    if (!isUnique(error)) throw error;
    const concurrent = await manager.findOneByOrFail(entity, {
      eventId: normalizedId,
    } as never);
    return equalPayload(concurrent.payloadHash, payloadHash, normalizedId);
  }
  return { eventId: normalizedId, idempotent: false };
}

function equalPayload(stored: string, supplied: string, eventId: string) {
  if (stored !== supplied)
    throw new RecommendationError(
      'RECOMMENDATION_EVENT_ID_REUSED',
      'eventId was already used with a different payload',
    );
  return { eventId, idempotent: true };
}
function hash(value: object): string {
  return createHash('sha256')
    .update(JSON.stringify(sort(value)))
    .digest('hex');
}
function sort(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(sort);
  if (value && typeof value === 'object')
    return Object.fromEntries(
      Object.entries(value)
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([key, child]) => [key, sort(child)]),
    );
  return value;
}
function validDate(value: string): Date {
  const result = new Date(value);
  if (!Number.isFinite(result.getTime()))
    throw new RecommendationError(
      'INVALID_RECOMMENDATION_REQUEST',
      'Invalid event timestamp',
    );
  return result;
}
function isUnique(error: unknown): boolean {
  return (
    error instanceof QueryFailedError &&
    (error.driverError as { code?: string }).code === '23505'
  );
}
