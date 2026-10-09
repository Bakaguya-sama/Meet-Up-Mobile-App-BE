import { Transform } from 'class-transformer';
import {
  IsEmail,
  IsOptional,
  IsString,
  Length,
  MaxLength,
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
