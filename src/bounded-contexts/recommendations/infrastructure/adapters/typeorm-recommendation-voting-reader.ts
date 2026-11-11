import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { RecommendationRunEntity } from '../persistence/typeorm/entities/recommendation-run.typeorm-entity';
import { RecommendationPlaceEntity } from '../persistence/typeorm/entities/recommendation-place.typeorm-entity';
import {
  RecommendationVotingReader,
  type VotingRecommendationRun,
} from '../../application/public/recommendation-voting-reader';
import { LEGACY_TEMPORAL_PROVIDER_OPTIONS_VERSION } from '../../domain/recommendation-run';

@Injectable()
export class TypeOrmRecommendationVotingReader extends RecommendationVotingReader {
  constructor(
    @InjectRepository(RecommendationRunEntity)
    private readonly runs: Repository<RecommendationRunEntity>,
    @InjectRepository(RecommendationPlaceEntity)
    private readonly places: Repository<RecommendationPlaceEntity>,
  ) {
    super();
  }

  async getDisplayedRun(
    meetupId: string,
    runId: string,
  ): Promise<VotingRecommendationRun | null> {
    const run = await this.runs.findOne({
      where: {
        id: runId.toLowerCase(),
        meetupId: meetupId.toLowerCase(),
        status: 'COMPLETED',
      },
    });
    if (!run || !run.effectiveK) return null;
    const candidates = await this.places.find({
      where: { runId: run.id },
      order: { rank: 'ASC' },
      take: run.effectiveK,
      select: {
        id: true,
        canonicalCandidateKey: true,
        rank: true,
        maxEtaSeconds: true,
        groupUtility: true,
      },
    });
    return {
      meetupId: run.meetupId,
      runId: run.id,
      scheduledAtSnapshot: run.scheduledAtSnapshot,
      isStale:
        run.providerRequestOptionsVersion ===
        LEGACY_TEMPORAL_PROVIDER_OPTIONS_VERSION,
      candidates: candidates.map((candidate) => ({
        recommendationPlaceId: candidate.id,
        canonicalCandidateKey: candidate.canonicalCandidateKey,
        rank: candidate.rank,
        maxEtaSeconds: candidate.maxEtaSeconds,
        groupUtility: candidate.groupUtility,
      })),
    };
  }
}
