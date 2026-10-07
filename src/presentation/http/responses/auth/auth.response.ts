import { ApiProperty } from '@nestjs/swagger';

export class UserProfileResponse {
  @ApiProperty({ format: 'uuid' }) id: string;
  @ApiProperty() email: string;
  @ApiProperty() displayName: string;
  @ApiProperty({ type: String, nullable: true }) avatarUrl: string | null;
}

export class AuthResponse {
  @ApiProperty() accessToken: string;
  @ApiProperty() refreshToken: string;
  @ApiProperty({ example: 'Bearer' }) tokenType: string;
  @ApiProperty({ example: 900 }) expiresIn: number;
  @ApiProperty({ example: 2592000 }) refreshExpiresIn: number;
  @ApiProperty({ type: UserProfileResponse }) user: UserProfileResponse;
}
