import { Transform } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayUnique,
  IsArray,
  IsBoolean,
  IsIn,
  IsISO8601,
  IsUUID,
  Matches,
  ValidateIf,
} from 'class-validator';
import {
  sharingModes,
  type SharingMode,
} from '../../domain/aggregates/privacy-settings.aggregate';

/** PUT replaces the complete configuration; expiry must be explicit, including null. */
export class SavePrivacySettingsRequest {
  @IsIn(sharingModes)
  sharingMode: SharingMode;

  @ValidateIf((_object, value: unknown) => value !== null)
  @IsISO8601({ strict: true })
  @Matches(/T.*(?:Z|[+-]\d{2}:\d{2})$/i, {
    message: 'sharingExpiresAt must include a timezone',
  })
  sharingExpiresAt: string | null;

  @IsBoolean()
  useApproximateLocation: boolean;

  @IsBoolean()
  nearbyFeatureEnabled: boolean = false;

  @Transform(({ value }: { value: unknown }) =>
    Array.isArray(value)
      ? value.map((id: unknown) =>
          typeof id === 'string' ? id.toLowerCase() : id,
        )
      : value,
  )
  @IsArray()
  @ArrayMaxSize(100)
  @ArrayUnique()
  @IsUUID('all', { each: true })
  selectedFriendIds: string[] = [];
}

export interface PrivacySettingsDto {
  sharingMode: SharingMode;
  sharingExpiresAt: Date | null;
  isLocationSharingEnabled: boolean;
  useApproximateLocation: boolean;
  nearbyFeatureEnabled: boolean;
  selectedFriendIds: string[];
  updatedAt: Date | null;
}
