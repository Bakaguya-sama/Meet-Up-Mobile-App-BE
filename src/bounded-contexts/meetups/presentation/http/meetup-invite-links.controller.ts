import {
  Body,
  Controller,
  Delete,
  Get,
  Header,
  HttpCode,
  Param,
  ParseUUIDPipe,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  ApiBadRequestResponse,
  ApiBearerAuth,
  ApiBody,
  ApiConflictResponse,
  ApiCreatedResponse,
  ApiForbiddenResponse,
  ApiNoContentResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
  ApiTooManyRequestsResponse,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import type { Request } from 'express';
import { CurrentUser } from '../../../../presentation/http/decorators/current-user.decorator';
import { Roles } from '../../../../presentation/http/decorators/roles.decorator';
import { AccessTokenGuard } from '../../../../presentation/http/guards/access-token.guard';
import { RolesGuard } from '../../../../presentation/http/guards/roles.guard';
import { AcceptMeetupInviteLinkUseCase } from '../../application/use-cases/accept-meetup-invite-link.use-case';
import { CreateMeetupInviteLinkUseCase } from '../../application/use-cases/create-meetup-invite-link.use-case';
import { PreviewMeetupInviteLinkUseCase } from '../../application/use-cases/preview-meetup-invite-link.use-case';
import { RevokeMeetupInviteLinkUseCase } from '../../application/use-cases/revoke-meetup-invite-link.use-case';
import { CreateMeetupInviteLinkRequest } from '../../application/dto/meetup-invite-link-request.dto';
import { MeetupInviteLinkToken } from '../../domain/aggregates/meetup-invite-link';
import { RedisRateLimiter } from '../../../../infrastructure/redis/redis-rate-limiter.service';

const inviteLinkSchema = {
  type: 'object' as const,
  required: ['id', 'inviteUrl', 'expiresAt', 'revokedAt'],
  properties: {
    id: { type: 'string', format: 'uuid' },
    inviteUrl: { type: 'string', format: 'uri' },
    expiresAt: { type: 'string', format: 'date-time' },
    revokedAt: { type: 'null' },
  },
};

const inviteLinkPreviewSchema = {
  type: 'object' as const,
  required: ['title', 'scheduledAt', 'expiresAt'],
  properties: {
    title: { type: 'string' },
    scheduledAt: { type: 'string', format: 'date-time' },
    expiresAt: { type: 'string', format: 'date-time' },
  },
};

@ApiTags('Meetup invite links')
@ApiBearerAuth()
@ApiUnauthorizedResponse({ description: 'Missing or invalid access token' })
@ApiForbiddenResponse({
  description: 'Only the meetup organizer may manage links',
})
@ApiNotFoundResponse({ description: 'Meetup or invite link is unavailable' })
@UseGuards(AccessTokenGuard, RolesGuard)
@Roles('user')
@Controller('meetups/:meetupId/invite-links')
export class MeetupInviteLinksController {
  constructor(
    private readonly createLink: CreateMeetupInviteLinkUseCase,
    private readonly revokeLink: RevokeMeetupInviteLinkUseCase,
    private readonly rateLimiter: RedisRateLimiter,
    private readonly config: ConfigService,
  ) {}

  @Post()
  @Header('Cache-Control', 'no-store')
  @ApiOperation({
    summary: 'Create an expiring meetup invite link; raw URL is returned once',
  })
  @ApiBody({
    schema: {
      type: 'object',
      required: ['expiresAt'],
      properties: {
        expiresAt: { type: 'string', format: 'date-time' },
        revokePrevious: { type: 'boolean', default: false },
      },
    },
  })
  @ApiCreatedResponse({ schema: inviteLinkSchema })
  @ApiBadRequestResponse({
    description: 'Expiry is invalid or past invitation deadline',
  })
  @ApiConflictResponse({ description: 'Meetup no longer accepts participants' })
  @ApiTooManyRequestsResponse({
    description: 'Invite link rate limit exceeded',
  })
  async create(
    @CurrentUser('id') actorId: string,
    @Param('meetupId', new ParseUUIDPipe()) meetupId: string,
    @Body() input: CreateMeetupInviteLinkRequest,
    @Req() request: Request,
  ) {
    await assertInviteRateLimit(
      this.rateLimiter,
      this.config,
      request,
      actorId,
    );
    return this.createLink.execute({ meetupId, actorId, ...input });
  }

  @Delete(':linkId')
  @HttpCode(204)
  @Header('Cache-Control', 'no-store')
  @ApiOperation({ summary: 'Revoke a meetup invite link' })
  @ApiNoContentResponse({ description: 'Invite link revoked' })
  @ApiTooManyRequestsResponse({
    description: 'Invite link rate limit exceeded',
  })
  async revoke(
    @CurrentUser('id') actorId: string,
    @Param('meetupId', new ParseUUIDPipe()) meetupId: string,
    @Param('linkId', new ParseUUIDPipe()) linkId: string,
    @Req() request: Request,
  ) {
    await assertInviteRateLimit(
      this.rateLimiter,
      this.config,
      request,
      actorId,
    );
    return this.revokeLink.execute({ meetupId, linkId, actorId });
  }
}

@ApiTags('Meetup invite links')
@Controller('meetup-invites/:token')
export class MeetupInviteLinkPreviewController {
  constructor(
    private readonly previewLink: PreviewMeetupInviteLinkUseCase,
    private readonly rateLimiter: RedisRateLimiter,
    private readonly config: ConfigService,
  ) {}

  @Get('preview')
  @Header('Cache-Control', 'no-store')
  @ApiOperation({
    summary: 'Preview a meetup invite without participant or location data',
  })
  @ApiOkResponse({ schema: inviteLinkPreviewSchema })
  @ApiNotFoundResponse({ description: 'Invite link is unavailable' })
  @ApiTooManyRequestsResponse({
    description: 'Invite link rate limit exceeded',
  })
  async preview(@Param('token') token: string, @Req() request: Request) {
    await assertInviteRateLimit(
      this.rateLimiter,
      this.config,
      request,
      undefined,
      token,
    );
    return this.previewLink.execute(token);
  }
}

@ApiTags('Meetup invite links')
@ApiBearerAuth()
@ApiUnauthorizedResponse({ description: 'Missing or invalid access token' })
@UseGuards(AccessTokenGuard, RolesGuard)
@Roles('user')
@Controller('meetup-invites/:token')
export class MeetupInviteLinkAcceptController {
  constructor(
    private readonly acceptLink: AcceptMeetupInviteLinkUseCase,
    private readonly rateLimiter: RedisRateLimiter,
    private readonly config: ConfigService,
  ) {}

  @Post('accept')
  @HttpCode(200)
  @Header('Cache-Control', 'no-store')
  @ApiOperation({ summary: 'Accept a meetup invite link while signed in' })
  @ApiOkResponse({
    schema: {
      type: 'object',
      required: ['meetupId', 'status', 'alreadyMember'],
      properties: {
        meetupId: { type: 'string', format: 'uuid' },
        status: { type: 'string', enum: ['accepted'] },
        alreadyMember: { type: 'boolean' },
      },
    },
  })
  @ApiNotFoundResponse({ description: 'Invite link is unavailable' })
  @ApiTooManyRequestsResponse({
    description: 'Invite link rate limit exceeded',
  })
  async accept(
    @CurrentUser('id') actorId: string,
    @Param('token') token: string,
    @Req() request: Request,
  ) {
    await assertInviteRateLimit(
      this.rateLimiter,
      this.config,
      request,
      actorId,
      token,
    );
    const result = await this.acceptLink.execute(token, actorId);
    return {
      meetupId: result.meetupId,
      status: 'accepted' as const,
      alreadyMember: !result.acceptedNow,
    };
  }
}

async function assertInviteRateLimit(
  limiter: RedisRateLimiter,
  config: ConfigService,
  request: Request,
  actorId?: string,
  rawToken?: string,
): Promise<void> {
  const limit = config.getOrThrow<number>('meetupInvites.rateLimit');
  const ip = request.ip || request.socket.remoteAddress || 'unknown';
  await limiter.assertAllowed('meetup-invite:ip', ip, limit);
  if (actorId) {
    await limiter.assertAllowed('meetup-invite:account', actorId, limit);
  }
  if (rawToken) {
    await limiter.assertAllowed(
      'meetup-invite:token',
      MeetupInviteLinkToken.hash(rawToken),
      limit,
    );
  }
}
