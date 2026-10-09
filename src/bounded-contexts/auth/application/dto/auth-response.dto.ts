import type { TokenPair } from '../ports/auth-tokens.port';

export interface UserProfileDto {
  id: string;
  email: string;
  displayName: string;
  avatarUrl: string | null;
}

export interface AuthResultDto extends TokenPair {
  user: UserProfileDto;
}
