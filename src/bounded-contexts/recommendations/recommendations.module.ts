import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { LocationsModule } from '../locations/locations.module';
import { MeetupLocationReader } from '../locations/application/public/meetup-location-reader';
import { MeetupsModule } from '../meetups/meetups.module';
import { MeetupCandidateSearchReader } from '../meetups/application/public/meetup-candidate-search-reader';
import { MeetupPreferenceReader } from '../meetups/application/public/meetup-preference-reader';
import { MeetupScheduleReader } from '../meetups/application/public/meetup-schedule-reader';
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
import {
  MEETUP_PREFERENCE,
  type MeetupPreferencePort,
} from './application/ports/meetup-preference.port';
import {
  ROUTE_MATRIX,
  type RouteMatrixPort,
} from './application/ports/route-matrix.port';
import { MeetupsPreferenceAdapter } from './infrastructure/adapters/meetups-preference.adapter';
import { GoogleRoutesAdapter } from './infrastructure/adapters/google-routes.adapter';
import { RouteBatchPlanner } from './application/services/route-batch-planner';
import { RouteMatrixService } from './application/services/route-matrix.service';
import { MemberUtilityService } from './application/services/member-utility.service';
import { GroupRankerService } from './application/services/group-ranker.service';
import { RecommendationMemberFeatureEntity } from './infrastructure/persistence/typeorm/entities/recommendation-member-feature.typeorm-entity';
import { FeatureBuilder } from './application/services/feature-builder';
import { ScheduledOpeningEvaluator } from './application/services/scheduled-opening.evaluator';
import {
  MEETUP_SCHEDULE,
  type MeetupSchedulePort,
} from './application/ports/meetup-schedule.port';
import { MeetupsScheduleAdapter } from './infrastructure/adapters/meetups-schedule.adapter';
import { RecommendationRunFreshnessGuard } from './application/public/recommendation-run-freshness.guard';
import { RecommendationPlaceEntity } from './infrastructure/persistence/typeorm/entities/recommendation-place.typeorm-entity';
import { ExplanationBuilder } from './application/services/explanation-builder';
import { OutboxEventTypeOrmEntity } from '../../infrastructure/outbox/persistence/outbox-event.typeorm-entity';
import { FavoritePlaceEntity } from './infrastructure/persistence/typeorm/entities/favorite-place.typeorm-entity';
import { TypeOrmFavoritePlaceStore } from './infrastructure/persistence/typeorm/typeorm-favorite-place-store';
import { FAVORITE_PLACE_STORE } from './application/ports/favorite-place-store.port';
import type { FavoritePlaceStore } from './application/ports/favorite-place-store.port';
import { ManageFavoritePlaceUseCase } from './application/use-cases/manage-favorite-place.use-case';
import { FavoritePlacesController } from './presentation/http/favorite-places.controller';

@Module({
  imports: [
    MeetupsModule,
    LocationsModule,
    TypeOrmModule.forFeature([
      RecommendationRunEntity,
      RecommendationCandidateEntity,
      RecommendationMemberFeatureEntity,
      RecommendationPlaceEntity,
      OutboxEventTypeOrmEntity,
      FavoritePlaceEntity,
    ]),
  ],
  controllers: [RecommendationsController, FavoritePlacesController],
  providers: [
    { provide: FAVORITE_PLACE_STORE, useClass: TypeOrmFavoritePlaceStore },
    {
      provide: ManageFavoritePlaceUseCase,
      useFactory: (store: FavoritePlaceStore) =>
        new ManageFavoritePlaceUseCase(store),
      inject: [FAVORITE_PLACE_STORE],
    },
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
      provide: MEETUP_SCHEDULE,
      useFactory: (reader: MeetupScheduleReader) =>
        new MeetupsScheduleAdapter(reader),
      inject: [MeetupScheduleReader],
    },
    {
      provide: MEETUP_PREFERENCE,
      useFactory: (reader: MeetupPreferenceReader) =>
        new MeetupsPreferenceAdapter(reader),
      inject: [MeetupPreferenceReader],
    },
    {
      provide: RecommendationContextBuilder,
      useFactory: (
        meetups: MeetupCandidateSearchPort,
        locations: MeetupLocationPort,
        preferences: MeetupPreferencePort,
      ) => new RecommendationContextBuilder(meetups, locations, preferences),
      inject: [MEETUP_CANDIDATE_SEARCH, MEETUP_LOCATION, MEETUP_PREFERENCE],
    },
    {
      provide: CandidateGenerator,
      useFactory: (places: PlaceSearchPort) =>
        new CandidateGenerator(places, RECOMMENDATION_CONFIG_DEV_V1),
      inject: [PLACE_SEARCH],
    },
    {
      provide: ROUTE_MATRIX,
      useFactory: (config: ConfigService) =>
        new GoogleRoutesAdapter(config.get<string>('googleMaps.apiKey') ?? ''),
      inject: [ConfigService],
    },
    {
      provide: RouteBatchPlanner,
      useFactory: () =>
        new RouteBatchPlanner(RECOMMENDATION_CONFIG_DEV_V1.routeElementLimit),
    },
    {
      provide: RouteMatrixService,
      useFactory: (routes: RouteMatrixPort, planner: RouteBatchPlanner) =>
        new RouteMatrixService(routes, planner),
      inject: [ROUTE_MATRIX, RouteBatchPlanner],
    },
    {
      provide: MemberUtilityService,
      useFactory: () => new MemberUtilityService(RECOMMENDATION_CONFIG_DEV_V1),
    },
    {
      provide: GroupRankerService,
      useFactory: () => new GroupRankerService(RECOMMENDATION_CONFIG_DEV_V1),
    },
    {
      provide: FeatureBuilder,
      useFactory: () => new FeatureBuilder(),
    },
    {
      provide: ScheduledOpeningEvaluator,
      useFactory: () => new ScheduledOpeningEvaluator(),
    },
    ExplanationBuilder,
    {
      provide: CreateRecommendationRunUseCase,
      useFactory: (
        store: RecommendationRunStore,
        contexts: RecommendationContextBuilder,
        candidates: CandidateGenerator,
        routes: RouteMatrixService,
        utilities: MemberUtilityService,
        ranker: GroupRankerService,
        featureBuilder: FeatureBuilder,
        openingEvaluator: ScheduledOpeningEvaluator,
        freshness: RecommendationRunFreshnessGuard,
        explanations: ExplanationBuilder,
      ) =>
        new CreateRecommendationRunUseCase(
          store,
          contexts,
          candidates,
          RECOMMENDATION_CONFIG_DEV_V1,
          undefined,
          routes,
          utilities,
          ranker,
          featureBuilder,
          openingEvaluator,
          freshness,
          explanations,
        ),
      inject: [
        RECOMMENDATION_RUN_STORE,
        RecommendationContextBuilder,
        CandidateGenerator,
        RouteMatrixService,
        MemberUtilityService,
        GroupRankerService,
        FeatureBuilder,
        ScheduledOpeningEvaluator,
        RecommendationRunFreshnessGuard,
        ExplanationBuilder,
      ],
    },
    {
      provide: RecommendationRunFreshnessGuard,
      useFactory: (
        store: RecommendationRunStore,
        schedules: MeetupSchedulePort,
      ) => new RecommendationRunFreshnessGuard(store, schedules),
      inject: [RECOMMENDATION_RUN_STORE, MEETUP_SCHEDULE],
    },
    {
      provide: GetRecommendationRunUseCase,
      useFactory: (
        store: RecommendationRunStore,
        freshness: RecommendationRunFreshnessGuard,
      ) => new GetRecommendationRunUseCase(store, freshness),
      inject: [RECOMMENDATION_RUN_STORE, RecommendationRunFreshnessGuard],
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
  exports: [RecommendationRunFreshnessGuard],
})
export class RecommendationsModule {}
