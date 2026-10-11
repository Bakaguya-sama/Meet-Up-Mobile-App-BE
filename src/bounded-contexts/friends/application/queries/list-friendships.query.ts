import type { FriendshipStorePort } from '../ports/persistence/friendship-store.port';
import type { FriendUserDirectoryPort } from '../ports/user-directory.port';
import type {
  FriendshipListItemDto,
  PageDto,
} from '../dto/friends-response.dto';

export class ListFriendshipsQuery {
  constructor(
    private readonly store: FriendshipStorePort,
    private readonly users: FriendUserDirectoryPort,
  ) {}

  async execute(input: {
    actorId: string;
    kind: 'accepted' | 'received' | 'sent';
    offset: number;
    limit: number;
  }): Promise<PageDto<FriendshipListItemDto>> {
    const page = await this.store.list(input);
    const otherId = (item: { userAId: string; userBId: string }) =>
      item.userAId === input.actorId ? item.userBId : item.userAId;
    const profiles = await this.users.findActiveByIds(page.items.map(otherId));
    const byId = new Map(profiles.map((user) => [user.id, user]));
    return {
      items: page.items.map((item) => ({
        ...item,
        user: byId.get(otherId(item)) ?? null,
      })),
      total: page.total,
      offset: input.offset,
      limit: input.limit,
    };
  }
}
