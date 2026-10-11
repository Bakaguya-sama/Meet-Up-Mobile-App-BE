import type { FriendshipStorePort } from '../ports/persistence/friendship-store.port';
import type { FriendUserDirectoryPort } from '../ports/user-directory.port';
import type {
  FriendSearchResultDto,
  PageDto,
} from '../dto/friends-response.dto';

export class SearchUsersQuery {
  constructor(
    private readonly store: FriendshipStorePort,
    private readonly users: FriendUserDirectoryPort,
  ) {}

  async execute(input: {
    actorId: string;
    query: string;
    offset: number;
    limit: number;
  }): Promise<PageDto<FriendSearchResultDto>> {
    const page = await this.users.search(input);
    const friendships = await this.store.findForUsers(
      input.actorId,
      page.items.map((user) => user.id),
    );
    const byUser = new Map(
      friendships.map((item) => [
        item.userAId === input.actorId ? item.userBId : item.userAId,
        item,
      ]),
    );
    return {
      items: page.items.map((user) => ({
        ...user,
        friendship: byUser.get(user.id) ?? null,
      })),
      total: page.total,
      offset: input.offset,
      limit: input.limit,
    };
  }
}
