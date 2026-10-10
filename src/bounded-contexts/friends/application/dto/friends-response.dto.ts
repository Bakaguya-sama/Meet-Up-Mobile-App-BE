import type { FriendshipStatus } from '../../domain/aggregates/friendship.aggregate';

export interface FriendUserDto {
  id: string;
  displayName: string;
  avatarUrl: string | null;
}

export interface FriendshipDto {
  id: string;
  userAId: string;
  userBId: string;
  requestedById: string;
  status: FriendshipStatus;
  requestedAt: Date;
  respondedAt: Date | null;
  updatedAt: Date;
}

export interface PageDto<T> {
  items: T[];
  total: number;
  offset: number;
  limit: number;
}

export interface FriendSearchResultDto extends FriendUserDto {
  friendship: FriendshipDto | null;
}

export interface FriendshipListItemDto extends FriendshipDto {
  /** Null when the other account is no longer available. */
  user: FriendUserDto | null;
}
