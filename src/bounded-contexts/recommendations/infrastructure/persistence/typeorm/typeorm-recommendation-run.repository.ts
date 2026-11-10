import { Injectable } from '@nestjs/common';
import { DataSource, type FindOptionsWhere, QueryFailedError } from 'typeorm';
import type { RecommendationRunStore } from '../../../application/ports/recommendation-run-store.port';
import { RecommendationError } from '../../../domain/recommendation.error';
import type {
  RecommendationCandidateSnapshot,
  RecommendationCompletion,
  RecommendationMemberFeatureSnapshot,
  RecommendationPlaceSnapshot,
  RecommendationRun,
  RecommendationRunResult,
} from '../../../domain/recommendation-run';
import { RecommendationCandidateEntity } from './entities/recommendation-candidate.typeorm-entity';
import { RecommendationRunEntity } from './entities/recommendation-run.typeorm-entity';
import { RecommendationMemberFeatureEntity } from './entities/recommendation-member-feature.typeorm-entity';
import { RecommendationPlaceEntity } from './entities/recommendation-place.typeorm-entity';
import { TypeOrmTransactionalOutbox } from '../../../../../infrastructure/outbox/persistence/typeorm-outbox.port';

@Injectable()
export class TypeOrmRecommendationRunRepository implements RecommendationRunStore {
  constructor(private readonly dataSource: DataSource) {}

  findByRequest(meetupId: string, requestId: string) {
    return this.findOne({ meetupId, requestId });
  }

  findById(meetupId: string, runId: string) {
    return this.findOne({ meetupId, id: runId });
  }

  async create(run: RecommendationRun): Promise<RecommendationRunResult> {
    try {
      await this.dataSource.getRepository(RecommendationRunEntity).insert(run);
      return { ...run, candidates: [], memberFeatures: [], places: [] };
    } catch (error) {
      if (isUniqueViolation(error)) {
        const existing = await this.findByRequest(run.meetupId, run.requestId);
        if (existing) return existing;
      }
      throw error;
    }
  }

  complete(
    runId: string,
    completion: RecommendationCompletion,
    completedAt: Date,
  ): Promise<RecommendationRunResult> {
    return this.dataSource.transaction(async (manager) => {
      const run = await manager.findOne(RecommendationRunEntity, {
        where: { id: runId },
        lock: { mode: 'pessimistic_write' },
      });
      if (!run) {
        throw new RecommendationError(
          'RECOMMENDATION_RUN_NOT_FOUND',
          'Recommendation run not found',
        );
      }
      if (run.status !== 'RUNNING') {
        throw new RecommendationError(
          'RECOMMENDATION_RUN_NOT_RUNNING',
          'Recommendation run is already terminal',
        );
      }
      if (completion.candidates.length) {
        await manager.insert(
          RecommendationCandidateEntity,
          completion.candidates,
        );
      }
      if (completion.memberFeatures.length) {
        await manager.insert(
          RecommendationMemberFeatureEntity,
          completion.memberFeatures,
        );
      }
      if (completion.places.length) {
        await manager.insert(RecommendationPlaceEntity, completion.places);
      }
      await manager.update(RecommendationRunEntity, runId, {
        status: 'COMPLETED',
        completedAt,
        effectiveK: completion.effectiveK,
        warnings: completion.warnings,
        randomSeed: completion.randomSeed,
        routeBatchCount: completion.routeBatchCount,
        routeElementCount: completion.routeElementCount,
        routingPreferenceEffective: completion.routingPreferenceEffective,
        weatherPolicyEffective: completion.weatherPolicyEffective,
      });
      const candidatesById = new Map(
        completion.candidates.map((candidate) => [candidate.id, candidate]),
      );
      const topPlaceIds = completion.places
        .filter((place) => place.rank <= completion.effectiveK)
        .sort((left, right) => left.rank - right.rank)
        .map((place) => candidatesById.get(place.candidateId)!.providerPlaceId);
      await new TypeOrmTransactionalOutbox(manager).add(
        {
          eventId: completion.readyEventId,
          eventName: 'RecommendationReady.v1',
          occurredAt: completedAt.toISOString(),
          meetupId: run.meetupId,
          runId,
          placeIds: topPlaceIds,
          strategy: completion.routeBatchCount > 1 ? 'batched' : 'exact',
        },
        { destination: 'realtime' },
      );
      return {
        ...toDomain(run),
        status: 'COMPLETED',
        completedAt,
        effectiveK: completion.effectiveK,
        warnings: [...completion.warnings],
        randomSeed: completion.randomSeed,
        routeBatchCount: completion.routeBatchCount,
        routeElementCount: completion.routeElementCount,
        routingPreferenceEffective: completion.routingPreferenceEffective,
        weatherPolicyEffective: completion.weatherPolicyEffective,
        candidates: completion.candidates.map(cloneCandidate),
        memberFeatures: completion.memberFeatures.map(cloneMemberFeature),
        places: completion.places.map(clonePlace),
      };
    });
  }

  async fail(runId: string, failureCode: string, completedAt: Date) {
    const result = await this.dataSource
      .getRepository(RecommendationRunEntity)
      .createQueryBuilder()
      .update()
      .set({ status: 'FAILED', failureCode, completedAt })
      .where('id = :runId AND status = :status', { runId, status: 'RUNNING' })
      .execute();
    if (result.affected !== 1) {
      throw new RecommendationError(
        'RECOMMENDATION_RUN_NOT_RUNNING',
        'Recommendation run is missing or already terminal',
      );
    }
  }

  private async findOne(where: FindOptionsWhere<RecommendationRunEntity>) {
    const row = await this.dataSource
      .getRepository(RecommendationRunEntity)
      .findOne({
        where,
        relations: { candidates: true, memberFeatures: true, places: true },
        order: {
          candidates: { finalRank: 'ASC', canonicalCandidateKey: 'ASC' },
          memberFeatures: {
            canonicalCandidateKey: 'ASC',
            participantId: 'ASC',
          },
        },
      });
    return row
      ? {
          ...toDomain(row),
          candidates: (row.candidates ?? []).map(toCandidate),
          memberFeatures: (row.memberFeatures ?? []).map(cloneMemberFeature),
          places: (row.places ?? []).map(clonePlace),
        }
      : null;
  }
}

function toDomain(row: RecommendationRunEntity): RecommendationRun {
  return {
    id: row.id,
    meetupId: row.meetupId,
    requestId: row.requestId,
    payloadHash: row.payloadHash,
    requestedById: row.requestedById,
    requestedK: row.requestedK,
    status: row.status,
    failureCode: row.failureCode,
    rankingStrategy: row.rankingStrategy,
    algorithmVersion: row.algorithmVersion,
    configVersion: row.configVersion,
    featureSchemaVersion: row.featureSchemaVersion,
    providerMappingVersion: row.providerMappingVersion,
    providerRequestOptionsVersion: row.providerRequestOptionsVersion,
    openingFilter: row.openingFilter,
    openingEvaluatorVersion: row.openingEvaluatorVersion,
    routingPreferenceRequested: row.routingPreferenceRequested,
    routingPreferenceEffective: row.routingPreferenceEffective,
    weatherPolicyRequested: row.weatherPolicyRequested,
    weatherPolicyEffective: row.weatherPolicyEffective,
    weatherPolicyVersion: row.weatherPolicyVersion,
    requestedAt: new Date(row.requestedAt),
    scheduledAtSnapshot: new Date(row.scheduledAtSnapshot),
    createdAt: new Date(row.createdAt),
    completedAt: row.completedAt ? new Date(row.completedAt) : null,
    effectiveK: row.effectiveK,
    warnings: [...row.warnings],
    randomSeed: row.randomSeed,
    routeBatchCount: row.routeBatchCount,
    routeElementCount: row.routeElementCount,
  };
}

function toCandidate(row: RecommendationCandidateEntity) {
  return cloneCandidate(row);
}

function cloneCandidate(candidate: RecommendationCandidateSnapshot) {
  return {
    ...candidate,
    providerTypes: [...candidate.providerTypes],
    sourceCategories: [...candidate.sourceCategories],
    sourcePages: [...candidate.sourcePages],
    normalizedTags: [...candidate.normalizedTags],
    createdAt: new Date(candidate.createdAt),
    openingEvidence: candidate.openingEvidence
      ? structuredClone(candidate.openingEvidence)
      : null,
    weatherEvidence: candidate.weatherEvidence
      ? structuredClone(candidate.weatherEvidence)
      : null,
  };
}

function cloneMemberFeature(feature: RecommendationMemberFeatureSnapshot) {
  return {
    ...feature,
    matchedTags: feature.matchedTags.map((tag) => ({ ...tag })),
    missingFlags: [...feature.missingFlags],
    createdAt: new Date(feature.createdAt),
  };
}

function clonePlace(place: RecommendationPlaceSnapshot) {
  return {
    ...place,
    createdAt: new Date(place.createdAt),
    explanation: structuredClone(place.explanation),
    openingEvidence: place.openingEvidence
      ? structuredClone(place.openingEvidence)
      : null,
    weatherEvidence: place.weatherEvidence
      ? structuredClone(place.weatherEvidence)
      : null,
  };
}

function isUniqueViolation(error: unknown): boolean {
  return (
    error instanceof QueryFailedError &&
    (error.driverError as { code?: unknown }).code === '23505'
  );
}
