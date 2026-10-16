import { Transform, Type } from 'class-transformer';
import {
  ArrayMinSize,
  ArrayUnique,
  IsArray,
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

  @IsInt()
  @Min(100)
  @Max(50000)
  searchRadiusM: number;

  @IsString()
  @Matches(/^[a-z][a-z0-9_]{0,99}$/)
  placeType: string;

  @IsIn(['balanced'])
  recommendationMode = 'balanced' as const;
}

export class UpdateMeetupRequest {
  @ValidateIf(optional)
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

  @ValidateIf(optional)
  @IsInt()
  @Min(100)
  @Max(50000)
  searchRadiusM?: number;

  @ValidateIf(optional)
  @IsString()
  @Matches(/^[a-z][a-z0-9_]{0,99}$/)
  placeType?: string;

  @ValidateIf(optional)
  @IsIn(['balanced'])
  recommendationMode?: 'balanced';
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
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => PreferenceTagInput)
  preferences: PreferenceTagInput[];
}
