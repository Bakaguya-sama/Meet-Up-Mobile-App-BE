import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { RecommendationVotingReader } from './application/public/recommendation-voting-reader';
import { TypeOrmRecommendationVotingReader } from './infrastructure/adapters/typeorm-recommendation-voting-reader';
import { RecommendationRunEntity } from './infrastructure/persistence/typeorm/entities/recommendation-run.typeorm-entity';
import { RecommendationPlaceEntity } from './infrastructure/persistence/typeorm/entities/recommendation-place.typeorm-entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      RecommendationRunEntity,
      RecommendationPlaceEntity,
    ]),
  ],
  providers: [
    {
      provide: RecommendationVotingReader,
      useClass: TypeOrmRecommendationVotingReader,
    },
  ],
  exports: [RecommendationVotingReader],
})
export class RecommendationVotingModule {}
