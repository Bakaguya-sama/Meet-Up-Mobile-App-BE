import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
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
import { GooglePlacesAdapter } from './infrastructure/adapters/google-places.adapter';
import { LocationsMeetupLocationAdapter } from './infrastructure/adapters/locations-meetup-location.adapter';
import { MeetupsCandidateSearchAdapter } from './infrastructure/adapters/meetups-candidate-search.adapter';
import { RecommendationsController } from './presentation/http/recommendations.controller';

@Module({
  imports: [MeetupsModule, LocationsModule],
  controllers: [RecommendationsController],
  providers: [
    {
      provide: MEETUP_CANDIDATE_SEARCH,
      useFactory: (meetups: MeetupCandidateSearchReader) =>
        new MeetupsCandidateSearchAdapter(meetups),
      inject: [MeetupCandidateSearchReader],
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
