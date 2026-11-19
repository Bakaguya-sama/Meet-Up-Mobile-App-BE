import { Injectable } from '@nestjs/common';
import { DataSource } from 'typeorm';
import type { OfflineEvaluationSource } from '../../../application/offline/offline-evaluation.types';
import { RecommendationRunEntity } from './entities/recommendation-run.typeorm-entity';
import { RecommendationCandidateEntity } from './entities/recommendation-candidate.typeorm-entity';
import { RecommendationMemberFeatureEntity } from './entities/recommendation-member-feature.typeorm-entity';
import { RecommendationImpressionEntity } from './entities/recommendation-impression.typeorm-entity';
import { RecommendationFeedbackEventEntity } from './entities/recommendation-feedback-event.typeorm-entity';

/** Read-only source for offline work. It deliberately imports no provider adapters. */
@Injectable()
export class TypeOrmOfflineEvaluationSource implements OfflineEvaluationSource {
  constructor(private readonly dataSource: DataSource) {}

  async readCompletedRuns(input: {
    from: Date;
    to: Date;
    algorithmVersion?: string;
    configVersion?: string;
  }) {
    const runs = await this.dataSource
      .getRepository(RecommendationRunEntity)
      .createQueryBuilder('run')
      .where('run.status = :status', { status: 'COMPLETED' })
      .andWhere('run.requested_at >= :from AND run.requested_at < :to', input)
      .andWhere(
        input.algorithmVersion
          ? 'run.algorithm_version = :algorithmVersion'
          : 'TRUE',
        input,
      )
      .andWhere(
        input.configVersion ? 'run.config_version = :configVersion' : 'TRUE',
        input,
      )
      .orderBy('run.requested_at', 'ASC')
      .addOrderBy('run.id', 'ASC')
      .getMany();
    if (!runs.length) return [];
    const ids = runs.map((run) => run.id);
    const [candidates, memberFeatures, impressions, feedback] =
      await Promise.all([
        this.dataSource
          .getRepository(RecommendationCandidateEntity)
          .createQueryBuilder('candidate')
          .where('candidate.run_id IN (:...ids)', { ids })
          .orderBy('candidate.run_id')
          .addOrderBy('candidate.canonical_candidate_key')
          .getMany(),
        this.dataSource
          .getRepository(RecommendationMemberFeatureEntity)
          .createQueryBuilder('feature')
          .where('feature.run_id IN (:...ids)', { ids })
          .orderBy('feature.run_id')
          .addOrderBy('feature.participant_id')
          .addOrderBy('feature.canonical_candidate_key')
          .getMany(),
        this.dataSource
          .getRepository(RecommendationImpressionEntity)
          .createQueryBuilder('impression')
          .where('impression.run_id IN (:...ids)', { ids })
          .orderBy('impression.run_id')
          .addOrderBy('impression.meetup_participant_id')
          .addOrderBy('impression.rank')
          .getMany(),
        this.dataSource
          .getRepository(RecommendationFeedbackEventEntity)
          .createQueryBuilder('feedback')
          .where('feedback.run_id IN (:...ids)', { ids })
          .orderBy('feedback.run_id')
          .addOrderBy('feedback.occurred_at')
          .addOrderBy('feedback.event_id')
          .getMany(),
      ]);
    const byRun = <T extends { runId: string }>(values: T[]) =>
      values.reduce((map, value) => {
        map.set(value.runId, [...(map.get(value.runId) ?? []), value]);
        return map;
      }, new Map<string, T[]>());
    const candidateMap = byRun(candidates);
    const featureMap = byRun(memberFeatures);
    const impressionMap = byRun(impressions);
    const feedbackMap = byRun(feedback);
    return runs.map((run) => ({
      id: run.id,
      requestedAt: run.requestedAt,
      algorithmVersion: run.algorithmVersion,
      configVersion: run.configVersion,
      featureSchemaVersion: run.featureSchemaVersion,
      rankingStrategy: run.rankingStrategy,
      randomSeed: run.randomSeed,
      effectiveK: run.effectiveK,
      routeElementCount: run.routeElementCount,
      candidates: (candidateMap.get(run.id) ?? []).map((value) => ({
        canonicalCandidateKey: value.canonicalCandidateKey,
        sourceCategories: value.sourceCategories,
        rating0To5: value.rating0To5,
        userRatingCount: value.userRatingCount,
        finalRank: value.finalRank,
        groupUtility: value.groupUtility,
        candidateLeastMiseryUtility: value.candidateLeastMiseryUtility,
        avgEtaSeconds: value.avgEtaSeconds,
        maxEtaSeconds: value.maxEtaSeconds,
        etaRangeSeconds: value.etaRangeSeconds,
        scheduledOpeningStatus: value.scheduledOpeningStatus,
      })),
      memberFeatures: (featureMap.get(run.id) ?? []).map((value) => ({
        participantId: value.participantId,
        canonicalCandidateKey: value.canonicalCandidateKey,
        etaSeconds: value.etaSeconds,
        distanceMeters: value.distanceMeters,
        staticDurationSeconds: value.staticDurationSeconds,
        travelUtility: value.travelUtility,
        preferenceUtility: value.preferenceUtility,
        placeQualityUtility: value.placeQualityUtility,
        memberUtility: value.memberUtility,
        rankingUtility: value.rankingUtility,
        missingFlags: value.missingFlags,
      })),
      impressions: (impressionMap.get(run.id) ?? []).map((value) => ({
        eventId: value.eventId,
        participantId: value.meetupParticipantId,
        canonicalCandidateKey: value.canonicalCandidateKey,
        rank: value.rank,
      })),
      feedback: (feedbackMap.get(run.id) ?? []).map((value) => ({
        eventId: value.eventId,
        participantId: value.meetupParticipantId,
        canonicalCandidateKey: value.canonicalCandidateKey,
        eventType: value.eventType,
      })),
    }));
  }
}
