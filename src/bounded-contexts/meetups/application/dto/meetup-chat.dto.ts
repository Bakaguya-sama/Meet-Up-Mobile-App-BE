import { Transform } from 'class-transformer';
import {
  IsInt,
  IsISO8601,
  IsOptional,
  IsString,
  Length,
  Max,
  Min,
} from 'class-validator';

export class SendMeetupChatMessageRequest {
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim() : value,
  )
  @IsString()
  @Length(1, 2000)
  text: string;
}

export class ListMeetupChatMessagesRequest {
  @IsOptional()
  @IsISO8601({ strict: true })
  before?: string;

  @Transform(({ value }: { value: unknown }) =>
    value === undefined ? 50 : Number(value),
  )
  @IsInt()
  @Min(1)
  @Max(100)
  limit = 50;
}
