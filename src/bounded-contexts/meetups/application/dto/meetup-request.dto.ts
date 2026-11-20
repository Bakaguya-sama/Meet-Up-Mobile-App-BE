import { Transform, Type } from 'class-transformer';
import {
  ArrayMinSize,
  ArrayMaxSize,
  ArrayUnique,
  IsArray,
  IsBase64,
  IsIn,
  IsInt,
  IsISO8601,
  IsString,
  IsUUID,
  Length,
  Matches,
  Max,
  MaxLength,
  Min,
  ValidateIf,
  ValidateNested,
} from 'class-validator';

const trim = ({ value }: { value: unknown }) =>
  typeof value === 'string' ? value.trim() : value;
const optional = (_: unknown, value: unknown) => value !== undefined;

export class InviteParticipantsRequest {
  @Transform(({ value }: { value: unknown }) =>
    Array.isArray(value)
      ? value.map((id: unknown) =>
          typeof id === 'string' ? id.toLowerCase() : id,
        )
      : value,
  )
  @IsArray()
  @ArrayMinSize(1)
  @ArrayUnique()
  @IsUUID('all', { each: true })
  inviteeIds: string[];
}

export class CreateMeetupRequest extends InviteParticipantsRequest {
  @Transform(trim)
  @IsString()
  @Length(1, 150)
  title: string;

  @ValidateIf((_, value: unknown) => value !== undefined && value !== null)
  @IsString()
  @MaxLength(1000)
  description?: string | null;

  @IsISO8601({ strict: true })
  @Matches(/T.*(?:Z|[+-]\d{2}:\d{2})$/)
  scheduledAt: string;

  @IsISO8601({ strict: true })
  @Matches(/T.*(?:Z|[+-]\d{2}:\d{2})$/)
  invitationDeadlineAt: string;

  @ValidateIf((_, value: unknown) => value !== undefined && value !== null)
  @IsISO8601({ strict: true })
  @Matches(/T.*(?:Z|[+-]\d{2}:\d{2})$/)
  voteDeadlineAt?: string | null;

  @IsInt()
  @Min(100)
  @Max(50000)
  searchRadiusM: number;

  @IsString()
  @Matches(/^[a-z][a-z0-9_]{0,99}$/)
  placeType: string;
}

export class UpdateMeetupRequest {
  @ValidateIf((_, value: unknown) => value !== undefined && value !== null)
  @Transform(trim)
  @IsString()
  @Length(1, 150)
  title?: string;

  @ValidateIf((_, value: unknown) => value !== undefined && value !== null)
  @IsString()
  @MaxLength(1000)
  description?: string | null;

  @ValidateIf(optional)
  @IsISO8601({ strict: true })
  @Matches(/T.*(?:Z|[+-]\d{2}:\d{2})$/)
  scheduledAt?: string;

  @ValidateIf(optional)
  @IsISO8601({ strict: true })
  @Matches(/T.*(?:Z|[+-]\d{2}:\d{2})$/)
  invitationDeadlineAt?: string;

  @ValidateIf((_, value: unknown) => value !== undefined && value !== null)
  @IsISO8601({ strict: true })
  @Matches(/T.*(?:Z|[+-]\d{2}:\d{2})$/)
  voteDeadlineAt?: string | null;

  @ValidateIf(optional)
  @IsInt()
  @Min(100)
  @Max(50000)
  searchRadiusM?: number;

  @ValidateIf(optional)
  @IsString()
  @Matches(/^[a-z][a-z0-9_]{0,99}$/)
  placeType?: string;
}

export class MeetupPageRequest {
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(100000)
  offset: number = 0;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit: number = 20;
}

export class PreferenceTagInput {
  @IsInt()
  @Min(1)
  activityTagId: number;

  @IsIn(['high', 'normal', 'avoid'])
  level: 'high' | 'normal' | 'avoid';
}

export class SetMeetupPreferencesRequest {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => PreferenceTagInput)
  preferences: PreferenceTagInput[];

  @ValidateIf((_, value: unknown) => value !== undefined && value !== null)
  @IsInt()
  @Min(0)
  @Max(2147483647)
  budgetVnd?: number | null;

  @ValidateIf((_, value: unknown) => value !== undefined)
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.toLowerCase() : value,
  )
  @IsUUID('all')
  aiSuggestionId?: string;
}

export class SuggestMeetupPreferencesRequest {
  @ValidateIf((_, value: unknown) => value !== undefined && value !== null)
  @Transform(trim)
  @IsString()
  @MaxLength(2000)
  message?: string;

  @ValidateIf((_, value: unknown) => value !== undefined)
  @IsArray()
  @ArrayMaxSize(12)
  @ValidateNested({ each: true })
  @Type(() => PreferenceConversationTurnRequest)
  conversation?: PreferenceConversationTurnRequest[];

  @ValidateIf((_, value: unknown) => value !== undefined)
  @IsBase64()
  @MaxLength(2_800_000)
  audioBase64?: string;

  @ValidateIf((_, value: unknown) => value !== undefined)
  @IsIn([
    'audio/wav',
    'audio/mp3',
    'audio/mpeg',
    'audio/ogg',
    'audio/webm',
    'audio/flac',
    'audio/aac',
  ])
  audioMimeType?: string;
}

export class PreferenceConversationTurnRequest {
  @IsIn(['user', 'assistant'])
  role: 'user' | 'assistant';

  @IsString()
  @MaxLength(2000)
  text: string;
}

export class CastMeetupVoteRequest {
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.toLowerCase() : value,
  )
  @IsUUID('all')
  recommendationPlaceId: string;
}

export class FinalizeMeetupRequest {
  @ValidateIf(optional)
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.toLowerCase() : value,
  )
  @IsUUID('all')
  recommendationPlaceId?: string;
}
