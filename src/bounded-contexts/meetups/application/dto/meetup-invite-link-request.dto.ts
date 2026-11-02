import { Type } from 'class-transformer';
import { IsBoolean, IsDateString, IsOptional } from 'class-validator';

export class CreateMeetupInviteLinkRequest {
  @Type(() => String)
  @IsDateString({ strict: true })
  expiresAt: string;

  @IsOptional()
  @IsBoolean()
  revokePrevious = false;
}
