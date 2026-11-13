import { randomUUID } from 'node:crypto';
import { RecommendationError } from '../../domain/recommendation.error';
import type {
  RecommendationCandidateSnapshot,
  RecommendationRun,
} from '../../domain/recommendation-run';
import type { CreateRecommendationRunRequest } from '../dto/recommendation-run.dto';
import type { RecommendationRunStore } from '../ports/recommendation-run-store.port';
import {
  RECOMMENDATION_CONFIG_DEV_V1,
  type RecommendationConfig,
} from '../recommendation-config';
import { filterCandidatesWithAudit } from '../services/candidate-filter';
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
import { ExplanationBuilder } from '../services/explanation-builder';
import { presentForViewer } from '../services/recommendation-result.presenter';
import { ClosingSoonEvaluator } from '../services/closing-soon.evaluator';
import { applyClosingPenalty } from '../services/closing-soon-adjuster';
import {
  applyWeatherPolicy,
  WEATHER_POLICY_VERSION,
  type WeatherEligibleCandidate,
  type WeatherPolicy,
} from '../services/weather-policy';
import type { WeatherContextPort } from '../ports/weather-context.port';
import { MeetupMembershipReader } from '../../../meetups/application/public/meetup-membership-reader';
import { RecommendationObservabilityService } from '../services/recommendation-observability.service';

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
    private readonly explanations: ExplanationBuilder = new ExplanationBuilder(),
    private readonly routingPreference:
      'TRAFFIC_UNAWARE' | 'TRAFFIC_AWARE' = 'TRAFFIC_UNAWARE',
    private readonly weatherPolicy: WeatherPolicy = 'OFF',
    private readonly weather?: WeatherContextPort,
    private readonly memberships?: MeetupMembershipReader,
    private readonly observability?: RecommendationObservabilityService,
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
      return this.present(existing, actorId, request.meetupId);
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
      algorithmVersion: 'recommendation-engine-v2',
      configVersion: this.config.version,
      featureSchemaVersion: 'recommendation-features-v1',
      providerMappingVersion: this.config.providerMappingVersion,
      providerRequestOptionsVersion: PLACE_SEARCH_REQUEST_OPTIONS_VERSION,
      openingFilter: request.openingFilter,
      openingEvaluatorVersion: SCHEDULED_OPENING_EVALUATOR_VERSION,
      routingPreferenceRequested: this.routingPreference,
      routingPreferenceEffective: this.routingPreference,
      weatherPolicyRequested: this.weatherPolicy,
      weatherPolicyEffective: this.weatherPolicy,
      weatherPolicyVersion: WEATHER_POLICY_VERSION,
      closingPolicyVersion: this.config.closingPolicy.version,
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
      return this.present(persisted, actorId, request.meetupId);
    }
    try {
      const raw = await this.candidates.generate({
        categories: request.requiredCategories,
        openingFilter: request.openingFilter,
        center: context.searchCenter,
        radiusMeters: request.searchRadiusMeters,
      });
      const residualOutcome = filterCandidatesWithAudit(
        raw,
        context.searchCenter,
        request.searchRadiusMeters,
        request.requiredCategories,
      );
      const openingPolicy =
        request.openingFilter === 'OPEN_AT_SCHEDULED_TIME'
          ? applyScheduledOpeningPolicy(
              residualOutcome.eligible,
              scheduledAt,
              this.openingEvaluator,
            )
          : {
              candidates: residualOutcome.eligible,
              filtered: [],
              warnings: [],
            };
      const closingEvaluator = new ClosingSoonEvaluator(
        this.config.closingPolicy,
      );
      const closingCandidates = openingPolicy.candidates.map((candidate) => ({
        ...candidate,
        closingEvidence: closingEvaluator.evaluate(candidate, scheduledAt),
      }));
      const weatherPolicy = await applyWeatherPolicy(
        closingCandidates,
        scheduledAt,
        this.weatherPolicy,
        this.weather,
      );
      const eligible = weatherPolicy.candidates;
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
          travelMode: member.travelMode,
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
      const baseFeatures = this.featureBuilder
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
      const features = applyClosingPenalty(
        baseFeatures,
        new Map(
          eligible.flatMap((candidate) =>
            candidate.closingEvidence
              ? [
                  [
                    candidate.canonicalCandidateKey,
                    candidate.closingEvidence,
                  ] as const,
                ]
              : [],
          ),
        ),
      );
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
      const completionWarnings = [
        ...new Set([
          ...routeOutcome.warnings,
          ...openingPolicy.warnings,
          ...weatherPolicy.warnings,
          ...eligible
            .filter(
              (candidate) =>
                candidate.closingEvidence?.status === 'CLOSING_SOON',
            )
            .map(() => 'CLOSING_SOON'),
        ]),
      ];
      const candidatesByKey = new Map<string, string>();
      const candidateSnapshots: RecommendationCandidateSnapshot[] =
        routeOutcome.candidates.map((routable) => {
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
            weatherEvidence: candidate.weatherEvidence
              ? structuredClone(candidate.weatherEvidence)
              : null,
            closingEvidence: candidate.closingEvidence
              ? structuredClone(candidate.closingEvidence)
              : null,
          };
        });
      const routableKeys = new Set(
        routeOutcome.candidates.map(
          (candidate) => candidate.canonicalCandidateKey,
        ),
      );
      const filteredCandidates = [
        ...residualOutcome.filtered,
        ...openingPolicy.filtered,
        ...weatherPolicy.filtered,
        ...eligible
          .filter(
            (candidate) => !routableKeys.has(candidate.canonicalCandidateKey),
          )
          .map((candidate) => ({ candidate, reason: 'NO_ROUTE' as const })),
      ];
      for (const audit of filteredCandidates) {
        const id = randomUUID();
        candidatesByKey.set(audit.candidate.canonicalCandidateKey, id);
        candidateSnapshots.push(
          filteredSnapshot(
            run.id,
            id,
            audit.candidate,
            audit.reason,
            completedAt,
          ),
        );
      }
      const places = ranking.map((ranked) => {
        const candidate = eligibleByKey.get(ranked.canonicalCandidateKey)!;
        const candidateId = candidatesByKey.get(ranked.canonicalCandidateKey)!;
        return {
          id: randomUUID(),
          runId: run.id,
          candidateId,
          canonicalCandidateKey: ranked.canonicalCandidateKey,
          rank: ranked.finalRank,
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
          weatherEvidence: candidate.weatherEvidence
            ? structuredClone(candidate.weatherEvidence)
            : null,
          closingEvidence: candidate.closingEvidence
            ? structuredClone(candidate.closingEvidence)
            : null,
          explanation: this.explanations.build(
            run.rankingStrategy,
            {
              rank: ranked.finalRank,
              groupUtility: ranked.groupUtility,
              candidateLeastMiseryUtility: ranked.leastMiseryUtility,
              paretoLevel: ranked.paretoLevel,
              inclusionProbability: ranked.inclusionProbability,
              avgEtaSeconds: ranked.avgEtaSeconds,
              maxEtaSeconds: ranked.maxEtaSeconds,
              scheduledOpeningStatus: candidate.scheduledOpeningStatus ?? null,
              closingEvidence: candidate.closingEvidence
                ? structuredClone(candidate.closingEvidence)
                : null,
            },
            routeOutcome.effectiveK,
            completionWarnings,
          ),
          createdAt: completedAt,
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
            staticDurationSeconds: feature.staticDurationSeconds ?? null,
            matchedTags: feature.matchedTags,
            missingFlags: feature.missingFlags,
            travelUtility: feature.travelUtility,
            preferenceUtility: feature.preferenceUtility,
            placeQualityUtility: feature.placeQualityUtility,
            memberUtility: feature.memberUtility,
            rankingUtility: feature.rankingUtility,
            routeStatus: 'OK' as const,
            createdAt: completedAt,
          })),
          places,
          effectiveK: routeOutcome.effectiveK,
          warnings: completionWarnings,
          randomSeed: seed,
          routeBatchCount: routeOutcome.batchCount,
          routeElementCount: routeOutcome.elementCount,
          routingPreferenceEffective: routeOutcome.effectiveRoutingPreference,
          weatherPolicyEffective: weatherPolicy.effectivePolicy,
          readyEventId: randomUUID(),
        },
        completedAt,
      );
      this.observability?.recordCompleted(completed);
      return this.present(completed, actorId, request.meetupId);
    } catch (error) {
      const code =
        error instanceof RecommendationError
          ? error.code
          : 'PLACE_SEARCH_UNAVAILABLE';
      await this.store.fail(run.id, code, this.now());
      this.observability?.recordFailure(code);
      if (error instanceof RecommendationError) throw error;
      throw new RecommendationError(
        'PLACE_SEARCH_UNAVAILABLE',
        'Place search failed',
      );
    }
  }

  private async present(
    run: RecommendationRunResult,
    actorId: string,
    meetupId: string,
  ) {
    const participantId = this.memberships
      ? await this.memberships.findAcceptedParticipantId(meetupId, actorId)
      : run.requestedById;
    if (!participantId) {
      throw new RecommendationError(
        'RECOMMENDATION_RUN_FORBIDDEN',
        'Recommendation run is unavailable to this actor',
      );
    }
    const status = this.freshness
      ? await this.freshness.status(run)
      : 'CURRENT_CONTEXT';
    return presentForViewer(participantId, run, status);
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

function filteredSnapshot(
  runId: string,
  id: string,
  candidate: WeatherEligibleCandidate,
  reason: string,
  createdAt: Date,
) {
  return {
    id,
    runId,
    canonicalCandidateKey: candidate.canonicalCandidateKey,
    provider: candidate.provider,
    providerPlaceId: candidate.providerPlaceId,
    name: candidate.name,
    latitude: candidate.latitude,
    longitude: candidate.longitude,
    providerTypes: [...candidate.providerTypes],
    sourceCategories: [...candidate.sourceCategories],
    sourcePages: [...candidate.sourcePages],
    filterStatus: 'FILTERED' as const,
    filterReason: reason,
    createdAt,
    normalizedTags: [...candidate.normalizedTags],
    rating0To5: candidate.rating0To5 ?? null,
    userRatingCount: candidate.userRatingCount ?? null,
    finalRank: null,
    groupUtility: null,
    candidateLeastMiseryUtility: null,
    paretoLevel: null,
    inclusionProbability: null,
    avgEtaSeconds: null,
    maxEtaSeconds: null,
    etaRangeSeconds: null,
    scheduledOpeningStatus: candidate.scheduledOpeningStatus ?? null,
    openingEvidence: candidate.openingEvidence
      ? structuredClone(candidate.openingEvidence)
      : null,
    weatherEvidence: candidate.weatherEvidence
      ? structuredClone(candidate.weatherEvidence)
      : null,
    closingEvidence: candidate.closingEvidence
      ? structuredClone(candidate.closingEvidence)
      : null,
  };
}
