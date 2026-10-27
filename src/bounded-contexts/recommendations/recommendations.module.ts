import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { LocationsModule } from '../locations/locations.module';
import { MeetupLocationReader } from '../locations/application/public/meetup-location-reader';
import { MeetupsModule } from '../meetups/meetups.module';
import { MeetupCandidateSearchReader } from '../meetups/application/public/meetup-candidate-search-reader';
import {
  MEETUP_CANDIDATE_SEARCH,
  type MeetupCandidateSearchPort,
} from './application/ports/meetup-candidate-search.port';
import {
  MEETUP_LOCATION,
  type MeetupLocationPort,
} from './application/ports/meetup-location.port';
import {
  PLACE_SEARCH,
  type PlaceSearchPort,
} from './application/ports/place-search.port';
import { FindPlaceCandidatesUseCase } from './application/use-cases/find-place-candidates.use-case';
import { CreateRecommendationRunUseCase } from './application/use-cases/create-recommendation-run.use-case';
import { GetRecommendationRunUseCase } from './application/use-cases/get-recommendation-run.use-case';
import { RecommendationContextBuilder } from './application/services/recommendation-context.builder';
import { CandidateGenerator } from './application/services/candidate-generator';
import { RECOMMENDATION_CONFIG_DEV_V1 } from './application/recommendation-config';
import {
  RECOMMENDATION_RUN_STORE,
  type RecommendationRunStore,
} from './application/ports/recommendation-run-store.port';
import { GooglePlacesAdapter } from './infrastructure/adapters/google-places.adapter';
import { LocationsMeetupLocationAdapter } from './infrastructure/adapters/locations-meetup-location.adapter';
import { MeetupsCandidateSearchAdapter } from './infrastructure/adapters/meetups-candidate-search.adapter';
import { RecommendationsController } from './presentation/http/recommendations.controller';
import { RecommendationRunEntity } from './infrastructure/persistence/typeorm/entities/recommendation-run.typeorm-entity';
import { RecommendationCandidateEntity } from './infrastructure/persistence/typeorm/entities/recommendation-candidate.typeorm-entity';
import { TypeOrmRecommendationRunRepository } from './infrastructure/persistence/typeorm/typeorm-recommendation-run.repository';

@Module({
  imports: [
    MeetupsModule,
    LocationsModule,
    TypeOrmModule.forFeature([
      RecommendationRunEntity,
      RecommendationCandidateEntity,
    ]),
  ],
  controllers: [RecommendationsController],
  providers: [
    {
      provide: MEETUP_CANDIDATE_SEARCH,
      useFactory: (meetups: MeetupCandidateSearchReader) =>
        new MeetupsCandidateSearchAdapter(meetups),
      inject: [MeetupCandidateSearchReader],
    },
    {
      provide: RECOMMENDATION_RUN_STORE,
      useClass: TypeOrmRecommendationRunRepository,
    },
    {
      provide: RecommendationContextBuilder,
      useFactory: (
        meetups: MeetupCandidateSearchPort,
        locations: MeetupLocationPort,
      ) => new RecommendationContextBuilder(meetups, locations),
      inject: [MEETUP_CANDIDATE_SEARCH, MEETUP_LOCATION],
    },
    {
      provide: CandidateGenerator,
      useFactory: (places: PlaceSearchPort) =>
        new CandidateGenerator(places, RECOMMENDATION_CONFIG_DEV_V1),
      inject: [PLACE_SEARCH],
    },
    {
      provide: CreateRecommendationRunUseCase,
      useFactory: (
        store: RecommendationRunStore,
        contexts: RecommendationContextBuilder,
        candidates: CandidateGenerator,
      ) => new CreateRecommendationRunUseCase(store, contexts, candidates),
      inject: [
        RECOMMENDATION_RUN_STORE,
        RecommendationContextBuilder,
        CandidateGenerator,
      ],
    },
    {
      provide: GetRecommendationRunUseCase,
      useFactory: (store: RecommendationRunStore) =>
        new GetRecommendationRunUseCase(store),
      inject: [RECOMMENDATION_RUN_STORE],
    },
    {
      provide: MEETUP_LOCATION,
      useFactory: (locations: MeetupLocationReader) =>
        new LocationsMeetupLocationAdapter(locations),
      inject: [MeetupLocationReader],
    },
    {
      provide: PLACE_SEARCH,
      useFactory: (config: ConfigService) =>
        new GooglePlacesAdapter(config.get<string>('googleMaps.apiKey') ?? ''),
      inject: [ConfigService],
    },
    {
      provide: FindPlaceCandidatesUseCase,
      useFactory: (
        meetups: MeetupCandidateSearchPort,
        locations: MeetupLocationPort,
        places: PlaceSearchPort,
      ) => new FindPlaceCandidatesUseCase(meetups, locations, places),
      inject: [MEETUP_CANDIDATE_SEARCH, MEETUP_LOCATION, PLACE_SEARCH],
    },
  ],
})
export class RecommendationsModule {}
