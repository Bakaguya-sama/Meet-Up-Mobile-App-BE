import {
  Body,
  Controller,
  Get,
  Header,
  HttpCode,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
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
import { LocationPermissionRequest } from '../../application/dto/location-permission.dto';
import { PublishLocationRequest } from '../../application/dto/location-response.dto';
import { GetLatestLocationQuery } from '../../application/queries/get-latest-location.query';
import { PublishLocationUseCase } from '../../application/use-cases/publish-location.use-case';

@ApiTags('Locations')
@ApiBearerAuth()
@ApiUnauthorizedResponse({ description: 'Invalid or missing access token' })
@ApiForbiddenResponse({
  description: 'Location privacy or meetup access denied',
})
@UseGuards(AccessTokenGuard, RolesGuard)
@Roles('user')
@Controller('locations')
export class LocationController {
  constructor(
    private readonly publishLocation: PublishLocationUseCase,
    private readonly getLatestLocation: GetLatestLocationQuery,
  ) {}

  @Post()
  @HttpCode(200)
  @Header('Cache-Control', 'no-store')
  @ApiOperation({
    summary: 'Publish the caller latest location with a five-minute TTL',
  })
  @ApiOkResponse({
    schema: {
      type: 'object',
      required: ['accepted', 'expiresInSeconds'],
      properties: {
        accepted: { type: 'boolean', example: true },
        expiresInSeconds: { type: 'number', example: 300 },
      },
    },
  })
  publish(
    @CurrentUser('id') ownerId: string,
    @Body() input: PublishLocationRequest,
  ) {
    return this.publishLocation.execute({ ...input, ownerId });
  }

  @Get(':ownerId')
  @Header('Cache-Control', 'no-store')
  @ApiOperation({
    summary: 'Get a location projected for the requesting viewer',
  })
  @ApiOkResponse({
    description: 'Projected location, or null when no live sample exists',
  })
  get(
    @CurrentUser('id') viewerId: string,
    @Param('ownerId', new ParseUUIDPipe()) ownerId: string,
    @Query() input: LocationPermissionRequest,
  ) {
    return this.getLatestLocation.execute({
      ownerId,
      viewerId,
      scope: input.scope,
      meetupId: input.meetupId,
    });
  }
}
