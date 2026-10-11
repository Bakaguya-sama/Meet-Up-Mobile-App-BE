import {
  Controller,
  Get,
  Header,
  Param,
  ParseUUIDPipe,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiBearerAuth,
  ApiForbiddenResponse,
  ApiOkResponse,
  ApiOperation,
  ApiQuery,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import type { Request } from 'express';
import { AccessTokenGuard } from '../../../../presentation/http/guards/access-token.guard';
import { LocationAccessService } from '../../application/services/location-access.service';
import { LocationPermissionRequest } from '../../application/dto/location-permission.dto';

@ApiTags('Location privacy')
@ApiBearerAuth()
@UseGuards(AccessTokenGuard)
@Controller('locations/permissions')
export class LocationPermissionController {
  constructor(private readonly access: LocationAccessService) {}

  @Get(':ownerId')
  @Header('Cache-Control', 'no-store')
  @ApiOperation({
    summary:
      'Check whether you may view a user location; this is not a reusable grant',
  })
  @ApiQuery({ name: 'scope', required: false, enum: ['friends', 'meetup'] })
  @ApiQuery({
    name: 'meetupId',
    required: false,
    type: String,
    format: 'uuid',
    description:
      'Required for meetup scope; access is denied until membership verification is connected.',
  })
  @ApiOkResponse({
    schema: {
      type: 'object',
      required: ['allowed', 'precision', 'expiresAt'],
      properties: {
        allowed: { type: 'boolean' },
        precision: {
          type: 'string',
          enum: ['precise', 'approximate'],
          nullable: true,
        },
        expiresAt: { type: 'string', format: 'date-time', nullable: true },
      },
    },
  })
  @ApiUnauthorizedResponse({ description: 'Invalid or missing access token' })
  @ApiForbiddenResponse({ description: 'Account locked' })
  @ApiBadRequestResponse({ description: 'Invalid UUID, scope or query fields' })
  check(
    @Req() req: Request & { user: { id: string } },
    @Param('ownerId', new ParseUUIDPipe()) ownerId: string,
    @Query() input: LocationPermissionRequest,
  ) {
    return this.access.checkRead({
      ownerId,
      viewerId: req.user.id,
      scope: input.scope,
      meetupId: input.meetupId,
    });
  }
}
