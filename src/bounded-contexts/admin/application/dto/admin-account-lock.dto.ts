import { Transform } from 'class-transformer';
import { IsOptional, IsString, MaxLength } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class AdminAccountLockRequest {
  @IsOptional()
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim() : value,
  )
  @IsString()
  @MaxLength(500)
  reason?: string;
}

export class AdminAccountLockResponse {
  @ApiProperty({ format: 'uuid' }) id: string;
  @ApiProperty() locked: boolean;
  @ApiProperty({ format: 'date-time' }) updatedAt: Date;
}
