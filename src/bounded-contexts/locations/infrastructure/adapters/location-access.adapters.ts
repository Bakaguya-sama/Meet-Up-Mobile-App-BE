import { Injectable } from '@nestjs/common';
import { LocationPrivacyReader } from '../../../auth/application/public/location-privacy-reader';
import { FriendshipReader } from '../../../friends/application/public/friendship-reader';
import type {
  LocationPrivacyPort,
  LocationFriendshipsPort,
} from '../../application/ports/location-access.port';

@Injectable()
export class AuthLocationPrivacyAdapter implements LocationPrivacyPort {
  constructor(private readonly reader: LocationPrivacyReader) {}

  async read(userId: string) {
    const result = await this.reader.read(userId);
    if (!result) return null;
    return {
      sharingMode: result.sharingMode,
      sharingExpiresAt: result.sharingExpiresAt,
      useApproximateLocation: result.useApproximateLocation,
      selectedFriendIds: result.selectedFriendIds,
      updatedAt: result.updatedAt,
    };
  }
}

@Injectable()
export class FriendsLocationAccessAdapter implements LocationFriendshipsPort {
  constructor(private readonly reader: FriendshipReader) {}
  areAccepted(userId: string, otherId: string) {
    return this.reader.areAccepted(userId, otherId);
  }
}
