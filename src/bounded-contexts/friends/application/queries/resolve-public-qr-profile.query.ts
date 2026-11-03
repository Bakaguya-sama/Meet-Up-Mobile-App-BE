import { FriendshipError } from '../../domain/errors/friendship.error';
import type { FriendshipStorePort } from '../ports/persistence/friendship-store.port';
import type { FriendUserDirectoryPort } from '../ports/user-directory.port';
import type { PublicQrProfileDto } from '../dto/friends-response.dto';

export class ResolvePublicQrProfileQuery {
  constructor(
    private readonly store: FriendshipStorePort,
    private readonly users: FriendUserDirectoryPort,
  ) {}

  async execute(input: {
    actorId: string;
    publicHandle: string;
  }): Promise<PublicQrProfileDto> {
    const profile = await this.users.findActiveByPublicHandle(
      input.publicHandle,
    );
    if (!profile) {
      throw new FriendshipError(
        'FRIEND_USER_NOT_FOUND',
        'An active user account could not be found',
      );
    }

    const relationship =
      profile.id === input.actorId
        ? []
        : await this.store.findForUsers(input.actorId, [profile.id]);
    return {
      publicHandle: input.publicHandle,
      displayName: profile.displayName,
      avatarUrl: profile.avatarUrl,
      friendship: relationship[0]?.status ?? null,
      // The public handle is the navigation-safe selector; internal IDs stay private.
    };
  }
}
