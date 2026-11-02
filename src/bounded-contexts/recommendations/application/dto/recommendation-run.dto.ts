import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  ArrayUnique,
  IsArray,
  IsIn,
  IsInt,
  IsOptional,
  IsUUID,
  Matches,
  Max,
  Min,
  ValidateNested,
} from 'class-validator';

export class RecommendationFiltersRequest {
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(3)
  @ArrayUnique()
  @Matches(/^[a-z][a-z0-9_]{0,99}$/, { each: true })
  categories: string[];

  @IsIn(['ANY', 'OPEN_AT_REQUEST_TIME', 'OPEN_AT_SCHEDULED_TIME'])
  openingFilter: 'ANY' | 'OPEN_AT_REQUEST_TIME' | 'OPEN_AT_SCHEDULED_TIME';

  @IsInt()
  @Min(1)
  @Max(10_000)
  radiusMeters: number;
}

export class CreateRecommendationRunRequest {
  @IsOptional()
  @IsUUID('4')
  requestId?: string;

  @IsInt()
  @Min(1)
  @Max(5)
  topK: number;

  @ValidateNested()
  @Type(() => RecommendationFiltersRequest)
  filters: RecommendationFiltersRequest;
}
