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
  @ApiOkResponse({ description: 'Completed recommendation run snapshot' })
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
  @ApiOkResponse({ description: 'Persisted recommendation run snapshot' })
  get(
    @CurrentUser('id') actorId: string,
    @Param('meetupId', new ParseUUIDPipe()) meetupId: string,
    @Param('runId', new ParseUUIDPipe()) runId: string,
  ) {
    return this.getRun.execute(actorId, meetupId, runId);
  }
}
