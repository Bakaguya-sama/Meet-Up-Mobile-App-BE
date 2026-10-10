import { Transform, Type } from 'class-transformer';
import {
  IsArray,
  IsEmail,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Length,
  MaxLength,
  ValidateNested,
} from 'class-validator';

const trim = ({ value }: { value: unknown }) =>
  typeof value === 'string' ? value.trim() : value;
const email = ({ value }: { value: unknown }) =>
  typeof value === 'string' ? value.trim().toLowerCase() : value;

class DeviceRequest {
  @IsOptional()
  @IsString()
  @Transform(trim)
  @Length(1, 150)
  deviceName?: string;
}

export class LoginRequest extends DeviceRequest {
  @Transform(email)
  @IsEmail()
  @MaxLength(255)
  email: string;

  @IsString()
  @Length(8, 128)
  password: string;
}

export class RegisterRequest extends LoginRequest {
  @Transform(trim)
  @IsString()
  @Length(1, 100)
  displayName: string;
}

export class RefreshTokenRequest {
  @IsString()
  @Length(1, 4096)
  refreshToken: string;
}

export class PreferenceTagItemRequest {
  @IsOptional()
  @IsInt()
  activityTagId?: number;

  @IsOptional()
  @IsString()
  @Transform(trim)
  @Length(1, 50)
  tagCode?: string;

  @IsString()
  @Transform(trim)
  @IsIn(['high', 'normal', 'avoid'], {
    message: "level must be 'high', 'normal', or 'avoid'",
  })
  level: 'high' | 'normal' | 'avoid';
}

export class UpdateProfileRequest {
  @IsOptional()
  @Transform(trim)
  @IsString()
  @Length(1, 100)
  displayName?: string;

  @IsOptional()
  @Transform(({ value }: { value: unknown }) =>
    value === null || value === ''
      ? null
      : typeof value === 'string'
        ? value.trim()
        : value,
  )
  @IsString()
  @MaxLength(1000)
  avatarUrl?: string | null;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => PreferenceTagItemRequest)
  preferences?: PreferenceTagItemRequest[];
}

export class SaveUserPreferenceRequest {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => PreferenceTagItemRequest)
  tags: PreferenceTagItemRequest[];
}
