import { Injectable } from '@nestjs/common';
import { UserDirectory } from '../../../auth/application/public/user-directory';
import { FriendshipReader } from '../../../friends/application/public/friendship-reader';
import type { InviteeEligibilityPort } from '../../application/ports/invitee-eligibility.port';

@Injectable()
export class InviteeEligibilityAdapter implements InviteeEligibilityPort {
  constructor(
    private readonly friendships: FriendshipReader,
    private readonly users: UserDirectory,
  ) {}
  async eligibleIds(organizerId: string, userIds: string[]): Promise<string[]> {
    const friends = await this.friendships.acceptedUserIds(
      organizerId,
      userIds,
    );
    const active: string[] = [];
    for (let offset = 0; offset < friends.length; offset += 500) {
      active.push(
        ...(
          await this.users.findActiveByIds(friends.slice(offset, offset + 500))
        ).map((user) => user.id),
      );
    }
    return active;
  }
}
