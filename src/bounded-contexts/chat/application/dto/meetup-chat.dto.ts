import { Transform } from 'class-transformer';
import {
  IsInt,
  IsISO8601,
  IsOptional,
  IsString,
  IsUUID,
  Length,
  Max,
  Min,
} from 'class-validator';

export class SendMeetupChatMessageRequest {
  @IsOptional()
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim() : value,
  )
  @IsString()
  @Length(0, 2000)
  text?: string;
}

export class ListMeetupChatMessagesRequest {
  @IsOptional()
  @IsISO8601({ strict: true })
  before?: string;

  @IsOptional()
  @IsUUID()
  beforeId?: string;

  @Transform(({ value }: { value: unknown }) =>
    value === undefined ? 50 : Number(value),
  )
  @IsInt()
  @Min(1)
  @Max(100)
  limit = 50;
}
