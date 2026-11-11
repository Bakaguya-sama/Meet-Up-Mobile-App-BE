import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { RecommendationHistoryReader } from './application/public/recommendation-history-reader';
import { TypeOrmRecommendationHistoryReader } from './infrastructure/adapters/typeorm-recommendation-history-reader';
import { RecommendationCandidateEntity } from './infrastructure/persistence/typeorm/entities/recommendation-candidate.typeorm-entity';
import { RecommendationPlaceEntity } from './infrastructure/persistence/typeorm/entities/recommendation-place.typeorm-entity';
import { RecommendationRunEntity } from './infrastructure/persistence/typeorm/entities/recommendation-run.typeorm-entity';

@Module({
  imports: [TypeOrmModule.forFeature([RecommendationCandidateEntity, RecommendationPlaceEntity, RecommendationRunEntity])],
  providers: [{ provide: RecommendationHistoryReader, useClass: TypeOrmRecommendationHistoryReader }],
  exports: [RecommendationHistoryReader],
})
export class RecommendationHistoryModule {}
