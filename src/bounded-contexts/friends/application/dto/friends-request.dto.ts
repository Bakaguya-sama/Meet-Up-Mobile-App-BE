import { Transform, Type } from 'class-transformer';
import {
  IsIn,
  IsInt,
  IsString,
  IsUUID,
  Length,
  Max,
  Min,
} from 'class-validator';

export class FriendPageRequest {
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(100000)
  offset: number = 0;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(50)
  limit: number = 20;
}

export class SearchFriendsRequest extends FriendPageRequest {
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim() : value,
  )
  @IsString()
  @Length(1, 255)
  q: string;
}

export class ListFriendRequestsRequest extends FriendPageRequest {
  @IsIn(['received', 'sent'])
  direction: 'received' | 'sent' = 'received';
}

export class SendFriendRequest {
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.toLowerCase() : value,
  )
  @IsUUID()
  recipientId: string;
}
