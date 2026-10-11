import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { FriendsModule } from '../friends/friends.module';
import {
  LOCATION_FRIENDSHIPS,
  LOCATION_PRIVACY,
} from './application/ports/location-access.port';
import type {
  LocationFriendshipsPort,
  LocationPrivacyPort,
} from './application/ports/location-access.port';
import { LocationAccessService } from './application/services/location-access.service';
import {
  AuthLocationPrivacyAdapter,
  FriendsLocationAccessAdapter,
} from './infrastructure/adapters/location-access.adapters';
import { LocationPermissionController } from './presentation/http/location-permission.controller';

@Module({
  imports: [AuthModule, FriendsModule],
  controllers: [LocationPermissionController],
  providers: [
    { provide: LOCATION_PRIVACY, useClass: AuthLocationPrivacyAdapter },
    { provide: LOCATION_FRIENDSHIPS, useClass: FriendsLocationAccessAdapter },
    {
      provide: LocationAccessService,
      useFactory: (
        privacy: LocationPrivacyPort,
        friendships: LocationFriendshipsPort,
      ) => new LocationAccessService(privacy, friendships),
      inject: [LOCATION_PRIVACY, LOCATION_FRIENDSHIPS],
    },
  ],
  exports: [LocationAccessService],
})
export class LocationsModule {}
