import {
  Controller,
  Body,
  Get,
  Header,
  Headers,
  HttpCode,
  Param,
  ParseUUIDPipe,
  Post,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiForbiddenResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
  ApiUnauthorizedResponse,
  type ApiResponseOptions,
} from '@nestjs/swagger';
import { CurrentUser } from '../../../../presentation/http/decorators/current-user.decorator';
import { Roles } from '../../../../presentation/http/decorators/roles.decorator';
import { AccessTokenGuard } from '../../../../presentation/http/guards/access-token.guard';
import { RolesGuard } from '../../../../presentation/http/guards/roles.guard';
import { FindPlaceCandidatesUseCase } from '../../application/use-cases/find-place-candidates.use-case';
import { CreateRecommendationRunRequest } from '../../application/dto/recommendation-run.dto';
import { CreateRecommendationRunUseCase } from '../../application/use-cases/create-recommendation-run.use-case';
import { GetRecommendationRunUseCase } from '../../application/use-cases/get-recommendation-run.use-case';
import { RecordRecommendationFeedbackUseCase } from '../../application/use-cases/record-recommendation-feedback.use-case';
import {
  RecordRecommendationFeedbackRequest,
  RecordRecommendationImpressionRequest,
} from '../../application/dto/recommendation-feedback.dto';
import { ReplayRecommendationRunUseCase } from '../../application/use-cases/replay-recommendation-run.use-case';

@ApiTags('Recommendations')
@ApiBearerAuth()
@ApiUnauthorizedResponse({ description: 'Missing or invalid access token' })
@ApiForbiddenResponse({
  description: 'Only the organizer of an active meetup can search candidates',
})
@UseGuards(AccessTokenGuard, RolesGuard)
@Roles('user')
@Controller('meetups')
export class RecommendationsController {
  constructor(
    private readonly findCandidates: FindPlaceCandidatesUseCase,
    private readonly createRun: CreateRecommendationRunUseCase,
    private readonly getRun: GetRecommendationRunUseCase,
    private readonly feedback: RecordRecommendationFeedbackUseCase,
    private readonly replay: ReplayRecommendationRunUseCase,
  ) {}

  @Post(':meetupId/recommendations/candidates')
  @Header('Cache-Control', 'no-store')
  @ApiOperation({
    summary:
      'Search Google Places candidates around the server-calculated meetup center',
  })
  @ApiOkResponse({
    schema: {
      type: 'object',
      required: ['meetupId', 'placeType', 'searchedAround', 'candidates'],
      properties: {
        meetupId: { type: 'string', format: 'uuid' },
        placeType: { type: 'string', example: 'cafe' },
        searchedAround: {
          type: 'object',
          properties: {
            latitude: { type: 'number' },
            longitude: { type: 'number' },
          },
        },
        candidates: {
          type: 'array',
          items: {
            type: 'object',
            required: [
              'providerPlaceId',
              'name',
              'categories',
              'latitude',
              'longitude',
            ],
            properties: {
              providerPlaceId: { type: 'string' },
              name: { type: 'string' },
              categories: { type: 'array', items: { type: 'string' } },
              latitude: { type: 'number' },
              longitude: { type: 'number' },
              formattedAddress: { type: 'string' },
              rating: { type: 'number' },
              openingHours: {
                type: 'object',
                properties: { openNow: { type: 'boolean' } },
              },
            },
          },
        },
      },
    },
  })
  find(
    @CurrentUser('id') actorId: string,
    @Param('meetupId', new ParseUUIDPipe()) meetupId: string,
  ) {
    return this.findCandidates.execute(actorId, meetupId);
  }

  @Post(':meetupId/recommendation-runs')
  @HttpCode(200)
  @Header('Cache-Control', 'no-store')
  @ApiOperation({
    summary: 'Create an idempotent synchronous recommendation run',
  })
  @ApiOkResponse({
    description: 'Completed recommendation run snapshot',
    schema: recommendationRunSchema(),
  })
  create(
    @CurrentUser('id') actorId: string,
    @Param('meetupId', new ParseUUIDPipe()) meetupId: string,
    @Headers('idempotency-key') idempotencyKey: string | undefined,
    @Body() body: CreateRecommendationRunRequest,
  ) {
    return this.createRun.execute(actorId, meetupId, {
      ...body,
      requestId: idempotencyKey ?? body.requestId,
    });
  }

  @Get(':meetupId/recommendation-runs/:runId')
  @Header('Cache-Control', 'no-store')
  @ApiOperation({ summary: 'Get a persisted recommendation run snapshot' })
  @ApiOkResponse({
    description: 'Persisted recommendation run snapshot with freshness status',
    schema: recommendationRunSchema(),
  })
  get(
    @CurrentUser('id') actorId: string,
    @Param('meetupId', new ParseUUIDPipe()) meetupId: string,
    @Param('runId', new ParseUUIDPipe()) runId: string,
  ) {
    return this.getRun.execute(actorId, meetupId, runId);
  }

  @Post(':meetupId/recommendation-runs/:runId/impressions')
  @HttpCode(200)
  @Header('Cache-Control', 'no-store')
  @ApiOperation({
    summary: 'Record one idempotent displayed recommendation item',
  })
  impression(
    @CurrentUser('id') actorId: string,
    @Param('meetupId', new ParseUUIDPipe()) meetupId: string,
    @Param('runId', new ParseUUIDPipe()) runId: string,
    @Body() body: RecordRecommendationImpressionRequest,
  ) {
    return this.feedback.impression(actorId, meetupId, runId, body);
  }

  @Post(':meetupId/recommendation-runs/:runId/feedback-events')
  @HttpCode(200)
  @Header('Cache-Control', 'no-store')
  @ApiOperation({
    summary: 'Record an idempotent post-display recommendation event',
  })
  feedbackEvent(
    @CurrentUser('id') actorId: string,
    @Param('meetupId', new ParseUUIDPipe()) meetupId: string,
    @Param('runId', new ParseUUIDPipe()) runId: string,
    @Body() body: RecordRecommendationFeedbackRequest,
  ) {
    return this.feedback.feedback(actorId, meetupId, runId, body);
  }

  @Post(':meetupId/recommendation-runs/:runId/replay')
  @HttpCode(200)
  @Header('Cache-Control', 'no-store')
  @ApiOperation({
    summary:
      'Verify an immutable full recommendation snapshot without providers',
  })
  replayRun(
    @CurrentUser('id') actorId: string,
    @Param('meetupId', new ParseUUIDPipe()) meetupId: string,
    @Param('runId', new ParseUUIDPipe()) runId: string,
  ) {
    return this.replay.execute(actorId, meetupId, runId);
  }
}

function recommendationRunSchema(): Extract<
  ApiResponseOptions,
  { schema: unknown }
>['schema'] {
  return {
    type: 'object',
    required: [
      'id',
      'meetupId',
      'requestId',
      'status',
      'requestedAt',
      'scheduledAtSnapshot',
      'openingFilter',
      'openingEvaluatorVersion',
      'routingPreferenceRequested',
      'routingPreferenceEffective',
      'weatherPolicyRequested',
      'weatherPolicyEffective',
      'contextStatus',
      'results',
    ],
    properties: {
      id: { type: 'string', format: 'uuid' },
      meetupId: { type: 'string', format: 'uuid' },
      requestId: { type: 'string', format: 'uuid' },
      status: { type: 'string', enum: ['RUNNING', 'COMPLETED', 'FAILED'] },
      requestedAt: { type: 'string', format: 'date-time' },
      scheduledAtSnapshot: { type: 'string', format: 'date-time' },
      openingFilter: {
        type: 'string',
        enum: ['ANY', 'OPEN_AT_REQUEST_TIME', 'OPEN_AT_SCHEDULED_TIME'],
      },
      openingEvaluatorVersion: { type: 'string' },
      routingPreferenceRequested: {
        type: 'string',
        enum: ['TRAFFIC_UNAWARE', 'TRAFFIC_AWARE'],
      },
      routingPreferenceEffective: {
        type: 'string',
        enum: ['TRAFFIC_UNAWARE', 'TRAFFIC_AWARE'],
      },
      weatherPolicyRequested: {
        type: 'string',
        enum: ['OFF', 'WARN_ONLY', 'FILTER_OUTDOOR'],
      },
      weatherPolicyEffective: {
        type: 'string',
        enum: ['OFF', 'WARN_ONLY', 'FILTER_OUTDOOR'],
      },
      contextStatus: {
        type: 'string',
        enum: ['CURRENT_CONTEXT', 'STALE_CONTEXT'],
      },
      warnings: { type: 'array', items: { type: 'string' } },
      results: {
        type: 'array',
        items: {
          type: 'object',
          required: [
            'rank',
            'avgEtaSeconds',
            'maxEtaSeconds',
            'candidate',
            'memberEtas',
            'viewerFeature',
            'explanation',
          ],
          properties: {
            rank: { type: 'integer' },
            avgEtaSeconds: { type: 'number' },
            maxEtaSeconds: { type: 'number' },
            etaRangeSeconds: { type: 'number' },
            scheduledOpeningStatus: {
              type: 'string',
              enum: ['OPEN', 'CLOSED', 'UNKNOWN'],
              nullable: true,
            },
            openingEvidence: { type: 'object', nullable: true },
            candidate: {
              type: 'object',
              required: ['canonicalCandidateKey', 'providerPlaceId', 'name'],
              properties: {
                canonicalCandidateKey: { type: 'string' },
                providerPlaceId: { type: 'string' },
                name: { type: 'string' },
              },
            },
            memberEtas: {
              type: 'array',
              items: {
                type: 'object',
                required: ['participantId', 'etaSeconds'],
                properties: {
                  participantId: { type: 'string', format: 'uuid' },
                  etaSeconds: { type: 'number' },
                },
              },
            },
            viewerFeature: {
              type: 'object',
              nullable: true,
              properties: {
                participantId: { type: 'string', format: 'uuid' },
                matchedTags: { type: 'array', items: { type: 'object' } },
                travelUtility: { type: 'number' },
                preferenceUtility: { type: 'number' },
                placeQualityUtility: { type: 'number' },
                memberUtility: { type: 'number' },
              },
            },
            explanation: {
              type: 'object',
              required: ['summaryCode', 'facts', 'warnings'],
              properties: {
                summaryCode: { type: 'string' },
                facts: {
                  type: 'array',
                  items: {
                    type: 'object',
                    required: ['key', 'value', 'source'],
                    properties: {
                      key: { type: 'string' },
                      value: {
                        oneOf: [{ type: 'string' }, { type: 'number' }],
                      },
                      unit: {
                        type: 'string',
                        enum: [
                          'SECOND',
                          'METER',
                          'UTILITY_0_1',
                          'PROBABILITY_0_1',
                          'COUNT',
                        ],
                      },
                      source: {
                        type: 'string',
                        enum: ['ROUTES', 'PLACES', 'WEATHER', 'ENGINE'],
                      },
                    },
                  },
                },
                warnings: { type: 'array', items: { type: 'string' } },
              },
            },
          },
        },
      },
    },
  };
}
