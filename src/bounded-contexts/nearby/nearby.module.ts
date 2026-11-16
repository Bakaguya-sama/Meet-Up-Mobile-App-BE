import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AuthModule } from '../auth/auth.module';
import { FriendsModule } from '../friends/friends.module';
import { FriendshipReader } from '../friends/application/public/friendship-reader';
import { LocationPrivacyReader } from '../auth/application/public/location-privacy-reader';
import { RedisLocationAdapter } from '../locations/infrastructure/adapters/redis-location.adapter';
import { NearbyDetector } from './application/nearby-detector';
import { RedisNearbyPairState } from './infrastructure/redis-nearby-pair-state';
import { TypeOrmNearbyOutbox } from './infrastructure/typeorm-nearby-outbox';

@Module({
  imports: [AuthModule, FriendsModule],
  providers: [
    RedisLocationAdapter,
    RedisNearbyPairState,
    TypeOrmNearbyOutbox,
    {
      provide: NearbyDetector,
      useFactory: (
        friends: FriendshipReader,
        privacy: LocationPrivacyReader,
        locations: RedisLocationAdapter,
        pairs: RedisNearbyPairState,
        outbox: TypeOrmNearbyOutbox,
        config: ConfigService,
      ) =>
        new NearbyDetector(
          friends,
          privacy,
          locations,
          pairs,
          outbox,
          config.get<number>('nearby.radiusMeters') ?? 3_000,
        ),
      inject: [
        FriendshipReader,
        LocationPrivacyReader,
        RedisLocationAdapter,
        RedisNearbyPairState,
        TypeOrmNearbyOutbox,
        ConfigService,
      ],
    },
  ],
  exports: [NearbyDetector],
})
export class NearbyModule {}
