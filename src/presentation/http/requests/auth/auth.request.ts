import { Transform } from 'class-transformer';
import {
  IsEmail,
  IsOptional,
  IsString,
  Length,
  MaxLength,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

const trim = ({ value }: { value: unknown }) =>
  typeof value === 'string' ? value.trim() : value;
const email = ({ value }: { value: unknown }) =>
  typeof value === 'string' ? value.trim().toLowerCase() : value;

class DeviceRequest {
  @ApiPropertyOptional({ maxLength: 150, example: 'Android' })
  @IsOptional()
  @IsString()
  @Transform(trim)
  @Length(1, 150)
  deviceName?: string;
}

export class LoginRequest extends DeviceRequest {
  @ApiProperty({ example: 'user@example.com', maxLength: 255 })
  @Transform(email)
  @IsEmail()
  @MaxLength(255)
  email: string;

  @ApiProperty({ minLength: 8, maxLength: 128, format: 'password' })
  @IsString()
  @Length(8, 128)
  password: string;
}

export class RegisterRequest extends LoginRequest {
  @ApiProperty({ example: 'Nguyen An', maxLength: 100 })
  @Transform(trim)
  @IsString()
  @Length(1, 100)
  displayName: string;
}

export class RefreshTokenRequest {
  @ApiProperty({ description: 'Refresh token returned by this API' })
  @IsString()
  @Length(1, 4096)
  refreshToken: string;
}
