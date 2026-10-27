import { randomUUID } from 'node:crypto';
import { RecommendationError } from '../../domain/recommendation.error';
import type { RecommendationRun } from '../../domain/recommendation-run';
import type { CreateRecommendationRunRequest } from '../dto/recommendation-run.dto';
import type { RecommendationRunStore } from '../ports/recommendation-run-store.port';
import {
  RECOMMENDATION_CONFIG_DEV_V1,
  type RecommendationConfig,
} from '../recommendation-config';
import { filterCandidates } from '../services/candidate-filter';
import { CandidateGenerator } from '../services/candidate-generator';
import { RecommendationContextBuilder } from '../services/recommendation-context.builder';
import { validateRecommendationRequest } from '../services/recommendation-request-validator';

export class CreateRecommendationRunUseCase {
  constructor(
    private readonly store: RecommendationRunStore,
    private readonly contexts: RecommendationContextBuilder,
    private readonly candidates: CandidateGenerator,
    private readonly config: RecommendationConfig = RECOMMENDATION_CONFIG_DEV_V1,
    private readonly now: () => Date = () => new Date(),
  ) {}

  async execute(
    actorId: string,
    meetupId: string,
    input: CreateRecommendationRunRequest,
  ) {
    const request = validateRecommendationRequest(input, meetupId, this.config);
    const existing = await this.store.findByRequest(
      request.meetupId,
      request.requestId,
    );
    if (existing) {
      this.assertIdempotent(existing, actorId, request.payloadHash);
      return existing;
    }
    const context = await this.contexts.build(actorId, request.meetupId);
    const createdAt = this.now();
    const run: RecommendationRun = {
      id: randomUUID(),
      meetupId: request.meetupId,
      requestId: request.requestId,
      payloadHash: request.payloadHash,
      requestedById: actorId.toLowerCase(),
      requestedK: request.topK,
      status: 'RUNNING',
      failureCode: null,
      rankingStrategy: 'fair-pareto-v1',
      algorithmVersion: 'recommendation-engine-v1',
      configVersion: this.config.version,
      featureSchemaVersion: 'recommendation-features-v1',
      providerMappingVersion: this.config.providerMappingVersion,
      createdAt,
      completedAt: null,
    };
    const persisted = await this.store.create(run);
    if (persisted.id !== run.id) {
      this.assertIdempotent(persisted, actorId, request.payloadHash);
      return persisted;
    }
    try {
      const raw = await this.candidates.generate({
        categories: request.requiredCategories,
        openingFilter: request.openingFilter,
        center: context.searchCenter,
        radiusMeters: request.searchRadiusMeters,
      });
      const eligible = filterCandidates(
        raw,
        context.searchCenter,
        request.searchRadiusMeters,
        request.requiredCategories,
      );
      if (!eligible.length) {
        throw new RecommendationError(
          'NO_ELIGIBLE_CANDIDATES',
          'No candidate satisfies the required constraints',
        );
      }
      const completedAt = this.now();
      return await this.store.complete(
        run.id,
        eligible.map((candidate) => ({
          id: randomUUID(),
          runId: run.id,
          canonicalCandidateKey: candidate.canonicalCandidateKey,
          provider: candidate.provider,
          providerPlaceId: candidate.providerPlaceId,
          name: candidate.name,
          latitude: candidate.latitude,
          longitude: candidate.longitude,
          providerTypes: [...candidate.providerTypes],
          sourceCategories: [...candidate.sourceCategories],
          sourcePages: [...candidate.sourcePages],
          filterStatus: 'ELIGIBLE' as const,
          filterReason: null,
          createdAt: completedAt,
        })),
        completedAt,
      );
    } catch (error) {
      const code =
        error instanceof RecommendationError
          ? error.code
          : 'PLACE_SEARCH_UNAVAILABLE';
      await this.store.fail(run.id, code, this.now());
      if (error instanceof RecommendationError) throw error;
      throw new RecommendationError(
        'PLACE_SEARCH_UNAVAILABLE',
        'Place search failed',
      );
    }
  }

  private assertIdempotent(
    existing: RecommendationRun,
    actorId: string,
    payloadHash: string,
  ) {
    if (existing.requestedById !== actorId.toLowerCase()) {
      throw new RecommendationError(
        'RECOMMENDATION_RUN_FORBIDDEN',
        'Recommendation run is unavailable to this actor',
      );
    }
    if (existing.payloadHash !== payloadHash) {
      throw new RecommendationError(
        'IDEMPOTENCY_KEY_REUSED',
        'Idempotency key was used with a different payload',
      );
    }
    if (existing.status === 'RUNNING') {
      throw new RecommendationError(
        'RECOMMENDATION_RUN_IN_PROGRESS',
        'Recommendation run is in progress',
      );
    }
    if (existing.status === 'FAILED') {
      throw new RecommendationError(
        existing.failureCode ?? 'RECOMMENDATION_RUN_FAILED',
        'The previous recommendation run failed',
      );
    }
  }
}
