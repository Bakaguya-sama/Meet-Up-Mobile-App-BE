import { createHash } from 'node:crypto';
import type { MeetupMembershipReader } from '../../../meetups/application/public/meetup-membership-reader';
import { RecommendationError } from '../../domain/recommendation.error';
import type { RecommendationConfig } from '../recommendation-config';
import type { RecommendationRunStore } from '../ports/recommendation-run-store.port';
import { GroupRankerService } from '../services/group-ranker.service';
import { ExplanationBuilder } from '../services/explanation-builder';
import type { MemberFeature } from '../services/member-utility.service';
import { RecommendationObservabilityService } from '../services/recommendation-observability.service';

/** Re-ranks immutable feature snapshots only; no external provider or mutation is allowed. */
export class ReplayRecommendationRunUseCase {
  constructor(
    private readonly store: RecommendationRunStore,
    private readonly memberships: MeetupMembershipReader,
    private readonly ranker: GroupRankerService,
    private readonly explanations: ExplanationBuilder,
    private readonly config: RecommendationConfig,
    private readonly observability: RecommendationObservabilityService,
  ) {}

  async execute(actorId: string, meetupId: string, runId: string) {
    const run = await this.store.findById(meetupId, runId);
    if (!run || run.status !== 'COMPLETED') {
      throw new RecommendationError(
        'RECOMMENDATION_RUN_NOT_FOUND',
        'Completed recommendation run not found',
      );
    }
    const participantId = await this.memberships.findAcceptedParticipantId(
      meetupId,
      actorId,
    );
    if (!participantId) {
      throw new RecommendationError(
        'RECOMMENDATION_RUN_FORBIDDEN',
        'Accepted meetup membership is required',
      );
    }
    if (!run.randomSeed || !run.effectiveK) {
      throw new RecommendationError(
        'RECOMMENDATION_REPLAY_UNAVAILABLE',
        'Run is missing replay seed or effective K',
      );
    }
    if (
      run.algorithmVersion !== 'fair-pareto-v1' ||
      run.configVersion !== this.config.version
    ) {
      throw new RecommendationError(
        'RECOMMENDATION_REPLAY_VERSION_MISMATCH',
        'Stored algorithm/config does not match this replay runtime',
      );
    }
    const replayed = this.ranker.rank(
      run.memberFeatures.map((feature): MemberFeature => ({
        participantId: feature.participantId,
        canonicalCandidateKey: feature.canonicalCandidateKey,
        etaSeconds: feature.etaSeconds,
        distanceMeters: feature.distanceMeters,
        staticDurationSeconds: feature.staticDurationSeconds ?? undefined,
        placeTags: [],
        preferences: [],
        rating0To5: null,
        userRatingCount: null,
        matchedTags: feature.matchedTags,
        missingFlags: feature.missingFlags,
        travelUtility: feature.travelUtility,
        preferenceUtility: feature.preferenceUtility,
        placeQualityUtility: feature.placeQualityUtility,
        memberUtility: feature.memberUtility,
        rankingUtility: feature.rankingUtility,
      })),
      'fair-pareto-v1',
      run.effectiveK,
      run.randomSeed,
    );
    const persisted = [...run.places].sort(
      (a, b) =>
        a.rank - b.rank ||
        a.canonicalCandidateKey.localeCompare(b.canonicalCandidateKey),
    );
    const replayConsistent =
      replayed.length === persisted.length &&
      replayed.every((item, index) => {
        const original = persisted[index];
        const explanation = this.explanations.build(
          'fair-pareto-v1',
          {
            rank: item.finalRank,
            groupUtility: item.groupUtility,
            candidateLeastMiseryUtility: item.leastMiseryUtility,
            paretoLevel: item.paretoLevel,
            inclusionProbability: item.inclusionProbability,
            avgEtaSeconds: item.avgEtaSeconds,
            maxEtaSeconds: item.maxEtaSeconds,
            scheduledOpeningStatus: original.scheduledOpeningStatus,
            closingEvidence: original.closingEvidence,
          },
          run.effectiveK!,
          run.warnings,
        );
        return (
          item.canonicalCandidateKey === original.canonicalCandidateKey &&
          item.finalRank === original.rank &&
          numericEqual(item.groupUtility, original.groupUtility) &&
          numericEqual(
            item.leastMiseryUtility,
            original.candidateLeastMiseryUtility,
          ) &&
          numericEqual(item.paretoLevel, original.paretoLevel) &&
          numericEqual(
            item.inclusionProbability,
            original.inclusionProbability,
          ) &&
          numericEqual(item.avgEtaSeconds, original.avgEtaSeconds) &&
          numericEqual(item.maxEtaSeconds, original.maxEtaSeconds) &&
          numericEqual(item.etaRangeSeconds, original.etaRangeSeconds) &&
          JSON.stringify(explanation) === JSON.stringify(original.explanation)
        );
      });
    this.observability.recordReplay(replayConsistent);
    if (!replayConsistent) {
      throw new RecommendationError(
        'RECOMMENDATION_REPLAY_MISMATCH',
        'Snapshot rank does not match deterministic replay',
      );
    }
    return {
      runId: run.id,
      algorithmVersion: run.algorithmVersion,
      configVersion: run.configVersion,
      featureSchemaVersion: run.featureSchemaVersion,
      randomSeed: run.randomSeed,
      fullRankFingerprint: createHash('sha256')
        .update(
          JSON.stringify(
            persisted.map((place) => ({
              rank: place.rank,
              canonicalCandidateKey: place.canonicalCandidateKey,
              explanation: place.explanation,
            })),
          ),
        )
        .digest('hex'),
      replayConsistent,
      providerCalls: 0,
    };
  }
}

function numericEqual(left: number | null, right: number | null): boolean {
  return (
    left === right ||
    (left !== null && right !== null && Math.abs(left - right) < 1e-12)
  );
}
