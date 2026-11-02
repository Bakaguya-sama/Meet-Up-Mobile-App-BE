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
            'groupUtility',
            'candidateLeastMiseryUtility',
            'candidate',
            'memberResults',
            'explanation',
          ],
          properties: {
            rank: { type: 'integer' },
            avgEtaSeconds: { type: 'number' },
            maxEtaSeconds: { type: 'number' },
            etaRangeSeconds: { type: 'number' },
            groupUtility: { type: 'number', minimum: 0, maximum: 1 },
            candidateLeastMiseryUtility: {
              type: 'number',
              minimum: 0,
              maximum: 1,
            },
            paretoLevel: { type: 'integer' },
            inclusionProbability: {
              type: 'number',
              minimum: 0,
              maximum: 1,
              nullable: true,
            },
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
            memberResults: {
              type: 'array',
              items: {
                type: 'object',
                required: [
                  'participantId',
                  'etaSeconds',
                  'distanceMeters',
                  'memberUtility',
                  'routeStatus',
                ],
                properties: {
                  participantId: { type: 'string', format: 'uuid' },
                  etaSeconds: { type: 'number' },
                  distanceMeters: { type: 'number' },
                  memberUtility: { type: 'number' },
                  routeStatus: { type: 'string', enum: ['OK'] },
                },
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
