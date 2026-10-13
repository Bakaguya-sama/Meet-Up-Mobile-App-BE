import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { FriendsModule } from '../friends/friends.module';
import {
  LOCATION_FRIENDSHIPS,
  LOCATION_PRIVACY,
  MEETUP_LOCATION_ACCESS,
} from './application/ports/location-access.port';
import type {
  LocationFriendshipsPort,
  LocationPrivacyPort,
  MeetupLocationAccessPort,
} from './application/ports/location-access.port';
import { LOCATION_STORE } from './application/ports/location.port';
import type { LocationPort } from './application/ports/location.port';
import { GetLatestLocationQuery } from './application/queries/get-latest-location.query';
import { LocationAccessService } from './application/services/location-access.service';
import { PublishLocationUseCase } from './application/use-cases/publish-location.use-case';
import { MeetupLocationAdapter } from './infrastructure/adapters/meetup-location.adapter';
import {
  AuthLocationPrivacyAdapter,
  FriendsLocationAccessAdapter,
} from './infrastructure/adapters/location-access.adapters';
import { RedisLocationAdapter } from './infrastructure/adapters/redis-location.adapter';
import { LocationController } from './presentation/http/location.controller';
import { LocationPermissionController } from './presentation/http/location-permission.controller';

@Module({
  imports: [AuthModule, FriendsModule],
  controllers: [LocationController, LocationPermissionController],
  providers: [
    { provide: LOCATION_PRIVACY, useClass: AuthLocationPrivacyAdapter },
    { provide: LOCATION_FRIENDSHIPS, useClass: FriendsLocationAccessAdapter },
    {
      provide: MEETUP_LOCATION_ACCESS,
      useClass: MeetupLocationAdapter,
    },
    {
      provide: LOCATION_STORE,
      useClass: RedisLocationAdapter,
    },
    {
      provide: LocationAccessService,
      useFactory: (
        privacy: LocationPrivacyPort,
        friendships: LocationFriendshipsPort,
        meetups: MeetupLocationAccessPort,
      ) => new LocationAccessService(privacy, friendships, meetups),
      inject: [LOCATION_PRIVACY, LOCATION_FRIENDSHIPS, MEETUP_LOCATION_ACCESS],
    },
    {
      provide: PublishLocationUseCase,
      useFactory: (access: LocationAccessService, locations: LocationPort) =>
        new PublishLocationUseCase(access, locations),
      inject: [LocationAccessService, LOCATION_STORE],
    },
    {
      provide: GetLatestLocationQuery,
      useFactory: (access: LocationAccessService, locations: LocationPort) =>
        new GetLatestLocationQuery(access, locations),
      inject: [LocationAccessService, LOCATION_STORE],
    },
  ],
  exports: [
    LocationAccessService,
    PublishLocationUseCase,
    GetLatestLocationQuery,
  ],
})
export class LocationsModule {}
