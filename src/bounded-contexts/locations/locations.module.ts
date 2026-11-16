import { Module } from '@nestjs/common';
import { RealtimeModule } from '../../infrastructure/realtime/realtime.module';
import { AuthModule } from '../auth/auth.module';
import { FriendsModule } from '../friends/friends.module';
import { MeetupsModule } from '../meetups/meetups.module';
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
import { ListFriendLiveLocationsQuery } from './application/queries/list-friend-live-locations.query';
import {
  LocationMeetupReader,
  MeetupLocationReader,
} from './application/public/meetup-location-reader';
import { LocationAccessService } from './application/services/location-access.service';
import { FriendLiveLocationFanoutService } from './application/services/friend-live-location-fanout.service';
import { PublishLocationUseCase } from './application/use-cases/publish-location.use-case';
import { MeetupLocationAdapter } from './infrastructure/adapters/meetup-location.adapter';
import {
  AuthLocationPrivacyAdapter,
  FriendsLocationAccessAdapter,
} from './infrastructure/adapters/location-access.adapters';
import { RedisLocationAdapter } from './infrastructure/adapters/redis-location.adapter';
import { RedisFriendLiveLocationThrottle } from './infrastructure/adapters/redis-friend-live-location-throttle';
import { LocationController } from './presentation/http/location.controller';
import { LocationPermissionController } from './presentation/http/location-permission.controller';
import { LocationGateway } from './presentation/websocket/location.gateway';
import { FriendLiveLocationsController } from './presentation/http/friend-live-locations.controller';
import { NearbyModule } from '../nearby/nearby.module';
import { NearbyDetector } from '../nearby/application/nearby-detector';
import { FriendshipReader } from '../friends/application/public/friendship-reader';
import {
  REALTIME_PUBLISHER,
  type RealtimePublisherPort,
} from '../../shared-kernel/application/realtime-publisher.port';

@Module({
  imports: [
    AuthModule,
    FriendsModule,
    MeetupsModule,
    RealtimeModule,
    NearbyModule,
  ],
  controllers: [
    LocationController,
    LocationPermissionController,
    FriendLiveLocationsController,
  ],
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
      provide: FriendLiveLocationFanoutService,
      useFactory: (
        friends: FriendshipReader,
        locations: LocationPort,
        access: LocationAccessService,
        throttle: RedisFriendLiveLocationThrottle,
        realtime: RealtimePublisherPort,
      ) =>
        new FriendLiveLocationFanoutService(
          friends,
          locations,
          access,
          throttle,
          realtime,
        ),
      inject: [
        FriendshipReader,
        LOCATION_STORE,
        LocationAccessService,
        RedisFriendLiveLocationThrottle,
        REALTIME_PUBLISHER,
      ],
    },
    RedisFriendLiveLocationThrottle,
    {
      provide: PublishLocationUseCase,
      useFactory: (
        access: LocationAccessService,
        locations: LocationPort,
        nearby: NearbyDetector,
        fanout: FriendLiveLocationFanoutService,
      ) => new PublishLocationUseCase(access, locations, nearby, fanout),
      inject: [
        LocationAccessService,
        LOCATION_STORE,
        NearbyDetector,
        FriendLiveLocationFanoutService,
      ],
    },
    {
      provide: ListFriendLiveLocationsQuery,
      useFactory: (
        friends: FriendshipReader,
        locations: LocationPort,
        access: LocationAccessService,
      ) => new ListFriendLiveLocationsQuery(friends, locations, access),
      inject: [FriendshipReader, LOCATION_STORE, LocationAccessService],
    },
    {
      provide: GetLatestLocationQuery,
      useFactory: (access: LocationAccessService, locations: LocationPort) =>
        new GetLatestLocationQuery(access, locations),
      inject: [LocationAccessService, LOCATION_STORE],
    },
    {
      provide: MeetupLocationReader,
      useFactory: (access: LocationAccessService, locations: LocationPort) =>
        new LocationMeetupReader(access, locations),
      inject: [LocationAccessService, LOCATION_STORE],
    },
    LocationGateway,
  ],
  exports: [
    LocationAccessService,
    PublishLocationUseCase,
    GetLatestLocationQuery,
    MeetupLocationReader,
  ],
})
export class LocationsModule {}
