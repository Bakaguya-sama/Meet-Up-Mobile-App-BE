import type { FriendUserDto } from '../dto/friends-response.dto';

export const FRIEND_USER_DIRECTORY = Symbol('FRIEND_USER_DIRECTORY');

export interface FriendUserDirectoryPort {
  search(input: {
    actorId: string;
    query: string;
    offset: number;
    limit: number;
  }): Promise<{ items: FriendUserDto[]; total: number }>;
  findActiveByIds(ids: string[]): Promise<FriendUserDto[]>;
}
