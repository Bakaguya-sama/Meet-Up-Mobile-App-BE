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
import { RouteMatrixService } from '../services/route-matrix.service';
import { MemberUtilityService } from '../services/member-utility.service';
import { GroupRankerService } from '../services/group-ranker.service';
import { FeatureBuilder } from '../services/feature-builder';
import {
  SCHEDULED_OPENING_EVALUATOR_VERSION,
  ScheduledOpeningEvaluator,
} from '../services/scheduled-opening.evaluator';
import { PLACE_SEARCH_REQUEST_OPTIONS_VERSION } from '../ports/place-search.port';
import { RecommendationRunFreshnessGuard } from '../public/recommendation-run-freshness.guard';
import type { RecommendationRunResult } from '../../domain/recommendation-run';
import { applyScheduledOpeningPolicy } from '../services/scheduled-opening-policy';

export class CreateRecommendationRunUseCase {
  constructor(
    private readonly store: RecommendationRunStore,
    private readonly contexts: RecommendationContextBuilder,
    private readonly candidates: CandidateGenerator,
    private readonly config: RecommendationConfig = RECOMMENDATION_CONFIG_DEV_V1,
    private readonly now: () => Date = () => new Date(),
    private readonly routes?: RouteMatrixService,
    private readonly utilities?: MemberUtilityService,
    private readonly ranker?: GroupRankerService,
    private readonly featureBuilder: FeatureBuilder = new FeatureBuilder(),
    private readonly openingEvaluator: ScheduledOpeningEvaluator = new ScheduledOpeningEvaluator(),
    private readonly freshness?: RecommendationRunFreshnessGuard,
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
      return this.present(existing);
    }
    const context = await this.contexts.build(actorId, request.meetupId);
    const createdAt = this.now();
    const requestedAt = new Date(context.requestedAt);
    const scheduledAt = new Date(context.scheduledAt);
    if (
      !Number.isFinite(requestedAt.getTime()) ||
      !Number.isFinite(scheduledAt.getTime())
    ) {
      throw new RecommendationError(
        'INVALID_RECOMMENDATION_CONTEXT',
        'Meetup temporal context is invalid',
      );
    }
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
      providerRequestOptionsVersion: PLACE_SEARCH_REQUEST_OPTIONS_VERSION,
      openingFilter: request.openingFilter,
      openingEvaluatorVersion: SCHEDULED_OPENING_EVALUATOR_VERSION,
      requestedAt,
      scheduledAtSnapshot: scheduledAt,
      createdAt,
      completedAt: null,
      effectiveK: null,
      warnings: [],
      randomSeed: null,
      routeBatchCount: null,
      routeElementCount: null,
    };
    const persisted = await this.store.create(run);
    if (persisted.id !== run.id) {
      this.assertIdempotent(persisted, actorId, request.payloadHash);
      return this.present(persisted);
    }
    try {
      const raw = await this.candidates.generate({
        categories: request.requiredCategories,
        openingFilter: request.openingFilter,
        center: context.searchCenter,
        radiusMeters: request.searchRadiusMeters,
      });
      const residualEligible = filterCandidates(
        raw,
        context.searchCenter,
        request.searchRadiusMeters,
        request.requiredCategories,
      );
      const openingPolicy =
        request.openingFilter === 'OPEN_AT_SCHEDULED_TIME'
          ? applyScheduledOpeningPolicy(
              residualEligible,
              scheduledAt,
              this.openingEvaluator,
            )
          : { candidates: residualEligible, warnings: [] };
      const eligible = openingPolicy.candidates;
      if (!eligible.length) {
        throw new RecommendationError(
          'NO_ELIGIBLE_CANDIDATES',
          'No candidate satisfies the required constraints',
        );
      }
      if (!this.routes || !this.utilities || !this.ranker) {
        throw new RecommendationError(
          'INVALID_RECOMMENDATION_CONFIG',
          'Recommendation ranking services are not configured',
        );
      }
      const routeOutcome = await this.routes.calculate(
        context.members.map((member) => ({
          participantId: member.participantId,
          latitude: member.latitude,
          longitude: member.longitude,
        })),
        eligible.map((candidate) => ({
          canonicalCandidateKey: candidate.canonicalCandidateKey,
          latitude: candidate.latitude,
          longitude: candidate.longitude,
        })),
        request.topK,
      );
      const eligibleByKey = new Map(
        eligible.map((candidate) => [
          candidate.canonicalCandidateKey,
          candidate,
        ]),
      );
      const features = this.featureBuilder
        .build(
          context.members.map((member) => ({
            participantId: member.participantId,
            preferences: member.preferences.map((value) => ({
              tagCode: value.tagCode,
              level: value.level,
            })),
          })),
          eligible,
          routeOutcome.candidates,
        )
        .map((feature) => this.utilities!.score(feature));
      const seed = request.payloadHash.slice(0, 16);
      const ranking = this.ranker.rank(
        features,
        run.rankingStrategy,
        routeOutcome.effectiveK,
        seed,
      );
      const rankByKey = new Map(
        ranking.map((value) => [value.canonicalCandidateKey, value]),
      );
      const completedAt = this.now();
      const candidatesByKey = new Map<string, string>();
      const candidateSnapshots = routeOutcome.candidates.map((routable) => {
        const candidate = eligibleByKey.get(routable.canonicalCandidateKey)!;
        const ranked = rankByKey.get(routable.canonicalCandidateKey)!;
        const id = randomUUID();
        candidatesByKey.set(candidate.canonicalCandidateKey, id);
        return {
          id,
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
          normalizedTags: [...candidate.normalizedTags],
          rating0To5: candidate.rating0To5 ?? null,
          userRatingCount: candidate.userRatingCount ?? null,
          finalRank: ranked.finalRank,
          groupUtility: ranked.groupUtility,
          candidateLeastMiseryUtility: ranked.leastMiseryUtility,
          paretoLevel: ranked.paretoLevel,
          inclusionProbability: ranked.inclusionProbability,
          avgEtaSeconds: ranked.avgEtaSeconds,
          maxEtaSeconds: ranked.maxEtaSeconds,
          etaRangeSeconds: ranked.etaRangeSeconds,
          scheduledOpeningStatus: candidate.scheduledOpeningStatus ?? null,
          openingEvidence: candidate.openingEvidence
            ? structuredClone(candidate.openingEvidence)
            : null,
        };
      });
      const completed = await this.store.complete(
        run.id,
        {
          candidates: candidateSnapshots,
          memberFeatures: features.map((feature) => ({
            id: randomUUID(),
            runId: run.id,
            candidateId: candidatesByKey.get(feature.canonicalCandidateKey)!,
            participantId: feature.participantId,
            canonicalCandidateKey: feature.canonicalCandidateKey,
            etaSeconds: feature.etaSeconds,
            distanceMeters: feature.distanceMeters,
            matchedTags: feature.matchedTags,
            missingFlags: feature.missingFlags,
            travelUtility: feature.travelUtility,
            preferenceUtility: feature.preferenceUtility,
            placeQualityUtility: feature.placeQualityUtility,
            memberUtility: feature.memberUtility,
            routeStatus: 'OK' as const,
            createdAt: completedAt,
          })),
          effectiveK: routeOutcome.effectiveK,
          warnings: [
            ...new Set([...routeOutcome.warnings, ...openingPolicy.warnings]),
          ],
          randomSeed: seed,
          routeBatchCount: routeOutcome.batchCount,
          routeElementCount: routeOutcome.elementCount,
        },
        completedAt,
      );
      return this.present(completed);
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

  private present(run: RecommendationRunResult) {
    return this.freshness
      ? this.freshness.toView(run)
      : Promise.resolve({ ...run, contextStatus: 'CURRENT_CONTEXT' as const });
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
