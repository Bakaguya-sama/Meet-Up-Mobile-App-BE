import { IsIn, IsString, Length, Matches } from 'class-validator';

const DEVICE_TOKEN_PATTERN = /^[A-Za-z0-9_:\-.]+$/;

export class RegisterDeviceTokenRequest {
  @IsString()
  @Length(20, 4096)
  @Matches(DEVICE_TOKEN_PATTERN)
  token: string;

  @IsIn(['android', 'ios'])
  platform: 'android' | 'ios';
}

export class UpdateDeviceTokenRequest extends RegisterDeviceTokenRequest {}
