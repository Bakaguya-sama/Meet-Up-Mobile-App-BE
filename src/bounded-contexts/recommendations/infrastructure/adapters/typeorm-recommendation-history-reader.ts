import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { RecommendationPlaceEntity } from '../persistence/typeorm/entities/recommendation-place.typeorm-entity';
import {
  RecommendationHistoryReader,
  type SelectedPlaceHistorySnapshot,
  type SelectedPlaceReference,
} from '../../application/public/recommendation-history-reader';

@Injectable()
export class TypeOrmRecommendationHistoryReader extends RecommendationHistoryReader {
  constructor(
    @InjectRepository(RecommendationPlaceEntity)
    private readonly places: Repository<RecommendationPlaceEntity>,
  ) {
    super();
  }

  async getSelectedPlaceSnapshots(
    references: SelectedPlaceReference[],
  ): Promise<SelectedPlaceHistorySnapshot[]> {
    const placeIds = [
      ...new Set(
        references.map((reference) => reference.recommendationPlaceId),
      ),
    ];
    if (!placeIds.length) return [];
    const places = await this.places
      .createQueryBuilder('place')
      .innerJoin('place.run', 'run')
      .innerJoin('place.candidate', 'candidate')
      .select('place.id', 'recommendationPlaceId')
      .addSelect('place.runId', 'runId')
      .addSelect('place.canonicalCandidateKey', 'canonicalCandidateKey')
      .addSelect('run.meetupId', 'meetupId')
      .addSelect('candidate.provider', 'provider')
      .addSelect('candidate.providerPlaceId', 'providerPlaceId')
      .addSelect('candidate.name', 'name')
      .where('place.id IN (:...placeIds)', { placeIds })
      .getRawMany<SelectedPlaceHistorySnapshot>();
    const referenceKeys = new Set(
      references.map((reference) => referenceKey(reference)),
    );
    return places.filter((place) => referenceKeys.has(referenceKey(place)));
  }
}

function referenceKey(reference: SelectedPlaceReference): string {
  return `${reference.meetupId}:${reference.runId}:${reference.recommendationPlaceId}`;
}
