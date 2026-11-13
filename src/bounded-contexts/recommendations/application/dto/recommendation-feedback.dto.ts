import {
  IsIn,
  IsISO8601,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  Min,
} from 'class-validator';
import type { RecommendationFeedbackEventType } from '../ports/recommendation-feedback-ledger.port';

export class RecordRecommendationImpressionRequest {
  @IsUUID()
  eventId: string;

  @IsString()
  @MaxLength(300)
  canonicalCandidateKey: string;

  @IsInt()
  @Min(1)
  rank: number;

  @IsISO8601({ strict: true })
  shownAt: string;
}

export class RecordRecommendationFeedbackRequest {
  @IsUUID()
  eventId: string;

  @IsIn([
    'PLACE_VOTED',
    'VOTE_CHANGED',
    'MEETUP_PLACE_SELECTED',
    'NAVIGATION_OPENED',
    'FAVORITE_ADDED',
    'MEETUP_COMPLETED',
  ])
  eventType: RecommendationFeedbackEventType;

  @IsOptional()
  @IsString()
  @MaxLength(300)
  canonicalCandidateKey?: string;

  @IsOptional()
  @IsString()
  @MaxLength(300)
  fromCanonicalCandidateKey?: string;

  @IsISO8601({ strict: true })
  occurredAt: string;
}
