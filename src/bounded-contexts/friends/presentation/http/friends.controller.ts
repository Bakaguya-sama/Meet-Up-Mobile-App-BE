import {
  Body,
  BadRequestException,
  Controller,
  Delete,
  Get,
  Header,
  HttpCode,
  Inject,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
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
  ApiQuery,
  ApiTags,
  ApiTooManyRequestsResponse,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { ConfigService } from '@nestjs/config';
import type { Request } from 'express';
import { AccessTokenGuard } from '../../../../presentation/http/guards/access-token.guard';
import { RolesGuard } from '../../../../presentation/http/guards/roles.guard';
import { CurrentUser } from '../../../../presentation/http/decorators/current-user.decorator';
import { Roles } from '../../../../presentation/http/decorators/roles.decorator';
import {
  FriendPageRequest,
  ListFriendRequestsRequest,
  SearchFriendsRequest,
  SendFriendRequest,
} from '../../application/dto/friends-request.dto';
import { SearchUsersQuery } from '../../application/queries/search-users.query';
import { ListFriendshipsQuery } from '../../application/queries/list-friendships.query';
import { ResolvePublicQrProfileQuery } from '../../application/queries/resolve-public-qr-profile.query';
import { SendFriendRequestUseCase } from '../../application/use-cases/send-friend-request.use-case';
import { RespondFriendRequestUseCase } from '../../application/use-cases/respond-friend-request.use-case';
import { UnfriendUseCase } from '../../application/use-cases/unfriend.use-case';
import { FRIEND_USER_DIRECTORY } from '../../application/ports/user-directory.port';
import type { FriendUserDirectoryPort } from '../../application/ports/user-directory.port';
import { FriendshipError } from '../../domain/errors/friendship.error';
import { CreateFriendQrSessionUseCase } from '../../application/use-cases/create-friend-qr-session.use-case';
import { ManageFriendQrSessionUseCase } from '../../application/use-cases/manage-friend-qr-session.use-case';
import { RedisRateLimiter } from '../../../../infrastructure/redis/redis-rate-limiter.service';
import { ManagePublicHandleUseCase } from '../../../auth/application/use-cases/manage-public-handle.use-case';
import {
  ApiFriendPage,
  friendshipPageSchema,
  friendshipSchema,
  searchPageSchema,
  sendFriendRequestSchema,
  publicQrProfileSchema,
  qrFriendRequestCreatedSchema,
  temporaryQrProfileSchema,
} from './friends.openapi';

@ApiTags('Friends')
@ApiBearerAuth()
@ApiUnauthorizedResponse({
  description: 'Missing, invalid or expired access token',
})
@ApiForbiddenResponse({
  description: 'Account locked or actor is not the recipient',
})
@ApiBadRequestResponse({ description: 'Invalid input or self-friendship' })
@UseGuards(AccessTokenGuard, RolesGuard)
@Roles('user')
@Controller('friends')
export class FriendsController {
  constructor(
    private readonly searchUsers: SearchUsersQuery,
    private readonly listFriendships: ListFriendshipsQuery,
    private readonly sendRequest: SendFriendRequestUseCase,
    private readonly respondRequest: RespondFriendRequestUseCase,
    private readonly unfriendUseCase: UnfriendUseCase,
    private readonly publicHandle: ManagePublicHandleUseCase,
    private readonly resolvePublicQrProfile: ResolvePublicQrProfileQuery,
    @Inject(FRIEND_USER_DIRECTORY)
    private readonly friendUsers: FriendUserDirectoryPort,
    private readonly createQrSession: CreateFriendQrSessionUseCase,
    private readonly manageQrSession: ManageFriendQrSessionUseCase,
    private readonly rateLimiter: RedisRateLimiter,
    private readonly config: ConfigService,
  ) {}

  @Get('search')
  @Header('Cache-Control', 'no-store')
  @ApiOperation({ summary: 'Search active users by display name or email' })
  @ApiFriendPage()
  @ApiQuery({
    name: 'q',
    schema: { type: 'string', minLength: 1, maxLength: 255 },
  })
  @ApiOkResponse({ schema: searchPageSchema })
  search(
    @CurrentUser('id') actorId: string,
    @Query() query: SearchFriendsRequest,
  ) {
    return this.searchUsers.execute({
      actorId,
      query: query.q,
      offset: query.offset,
      limit: query.limit,
    });
  }

  @Get()
  @Header('Cache-Control', 'no-store')
  @ApiOperation({ summary: 'List accepted friendships' })
  @ApiFriendPage()
  @ApiOkResponse({ schema: friendshipPageSchema })
  list(@CurrentUser('id') actorId: string, @Query() query: FriendPageRequest) {
    return this.listFriendships.execute({
      actorId,
      kind: 'accepted',
      ...query,
    });
  }

  @Get('requests')
  @Header('Cache-Control', 'no-store')
  @ApiOperation({ summary: 'List pending friend requests' })
  @ApiFriendPage()
  @ApiQuery({
    name: 'direction',
    required: false,
    enum: ['received', 'sent'],
    schema: { default: 'received' },
  })
  @ApiOkResponse({ schema: friendshipPageSchema })
  requests(
    @CurrentUser('id') actorId: string,
    @Query() query: ListFriendRequestsRequest,
  ) {
    return this.listFriendships.execute({
      actorId,
      kind: query.direction,
      offset: query.offset,
      limit: query.limit,
    });
  }

  @Get('qr-profiles/:publicHandle')
  @Header('Cache-Control', 'no-store')
  @ApiOperation({ summary: 'Resolve a stable public QR profile' })
  @ApiOkResponse({ schema: publicQrProfileSchema })
  @ApiNotFoundResponse({ description: 'Public profile is unavailable' })
  @ApiTooManyRequestsResponse({ description: 'QR profile rate limit exceeded' })
  async resolveQrProfile(
    @CurrentUser('id') actorId: string,
    @Param('publicHandle') publicHandle: string,
    @Req() request: Request,
  ) {
    await assertFriendQrRateLimit(
      this.rateLimiter,
      this.config,
      request,
      actorId,
      publicHandle,
    );
    return this.resolvePublicQrProfile.execute({ actorId, publicHandle });
  }

  @Get('qr-sessions/:token')
  @Header('Cache-Control', 'no-store')
  @ApiOperation({ summary: 'Resolve an active temporary friend QR session' })
  @ApiOkResponse({ schema: temporaryQrProfileSchema })
  @ApiNotFoundResponse({ description: 'QR session is unavailable' })
  @ApiTooManyRequestsResponse({ description: 'QR session rate limit exceeded' })
  async previewTemporaryQr(
    @CurrentUser('id') actorId: string,
    @Param('token') token: string,
    @Req() request: Request,
  ) {
    await assertFriendQrRateLimit(
      this.rateLimiter,
      this.config,
      request,
      actorId,
      token,
    );
    return this.manageQrSession.preview(actorId, token);
  }

  @Delete('qr-sessions/:sessionId')
  @HttpCode(204)
  @Header('Cache-Control', 'no-store')
  @ApiOperation({ summary: 'Revoke an owned temporary friend QR session' })
  @ApiNoContentResponse({ description: 'QR session revoked' })
  @ApiNotFoundResponse({ description: 'QR session is unavailable' })
  @ApiTooManyRequestsResponse({ description: 'QR session rate limit exceeded' })
  async revokeTemporaryQr(
    @CurrentUser('id') actorId: string,
    @Param('sessionId', new ParseUUIDPipe()) sessionId: string,
    @Req() request: Request,
  ) {
    await assertFriendQrRateLimit(
      this.rateLimiter,
      this.config,
      request,
      actorId,
    );
    await this.manageQrSession.revoke(actorId, sessionId);
  }

  @Post('qr-sessions')
  @Header('Cache-Control', 'no-store')
  @ApiOperation({ summary: 'Create a temporary friend QR session' })
  @ApiCreatedResponse({
    schema: {
      type: 'object',
      required: ['sessionId', 'qrUrl', 'expiresAt'],
      properties: {
        sessionId: { type: 'string', format: 'uuid' },
        qrUrl: { type: 'string', format: 'uri' },
        expiresAt: { type: 'string', format: 'date-time' },
      },
    },
  })
  @ApiTooManyRequestsResponse({ description: 'QR session rate limit exceeded' })
  async createTemporaryQr(
    @CurrentUser('id') actorId: string,
    @Req() request: Request,
  ) {
    const limit = this.config.getOrThrow<number>('friendQr.rateLimit');
    const ip = request.ip || request.socket.remoteAddress || 'unknown';
    await this.rateLimiter.assertAllowed('friend-qr:create:ip', ip, limit);
    await this.rateLimiter.assertAllowed(
      'friend-qr:create:account',
      actorId,
      limit,
    );
    return this.createQrSession.execute(actorId);
  }

  @Post('public-handle/rotate')
  @HttpCode(200)
  @Header('Cache-Control', 'no-store')
  @ApiOperation({
    summary: 'Rotate the authenticated user’s stable QR handle',
  })
  @ApiOkResponse({
    schema: {
      type: 'object',
      required: ['publicHandle'],
      properties: {
        publicHandle: { type: 'string', minLength: 43, maxLength: 43 },
      },
    },
  })
  @ApiTooManyRequestsResponse({ description: 'QR handle rate limit exceeded' })
  async rotatePublicHandle(
    @CurrentUser('id') actorId: string,
    @Req() request: Request,
  ) {
    await assertFriendQrRateLimit(
      this.rateLimiter,
      this.config,
      request,
      actorId,
    );
    return this.publicHandle.rotate(actorId);
  }

  @Get('public-handle')
  @Header('Cache-Control', 'no-store')
  @ApiOperation({
    summary: 'Get the current stable QR handle for this account',
  })
  @ApiOkResponse({
    schema: {
      type: 'object',
      required: ['publicHandle'],
      properties: {
        publicHandle: {
          type: 'string',
          minLength: 43,
          maxLength: 43,
          nullable: true,
        },
      },
    },
  })
  @ApiTooManyRequestsResponse({ description: 'QR handle rate limit exceeded' })
  async getPublicHandle(
    @CurrentUser('id') actorId: string,
    @Req() request: Request,
  ) {
    await assertFriendQrRateLimit(
      this.rateLimiter,
      this.config,
      request,
      actorId,
    );
    return this.publicHandle.current(actorId);
  }

  @Delete('public-handle')
  @HttpCode(204)
  @Header('Cache-Control', 'no-store')
  @ApiOperation({
    summary: 'Disable the authenticated user’s stable QR handle',
  })
  @ApiNoContentResponse({ description: 'Public handle disabled' })
  @ApiTooManyRequestsResponse({ description: 'QR handle rate limit exceeded' })
  async disablePublicHandle(
    @CurrentUser('id') actorId: string,
    @Req() request: Request,
  ) {
    await assertFriendQrRateLimit(
      this.rateLimiter,
      this.config,
      request,
      actorId,
    );
    await this.publicHandle.disable(actorId);
  }

  @Post('requests')
  @Header('Cache-Control', 'no-store')
  @ApiOperation({ summary: 'Send a friend request' })
  @ApiBody({ schema: sendFriendRequestSchema })
  @ApiCreatedResponse({
    schema: {
      oneOf: [friendshipSchema, qrFriendRequestCreatedSchema],
    },
  })
  @ApiNotFoundResponse({ description: 'Recipient unavailable' })
  @ApiConflictResponse({
    description: 'This pair already has a friendship or request',
  })
  @ApiTooManyRequestsResponse({
    description: 'QR friend request rate limit exceeded',
  })
  async send(
    @CurrentUser('id') actorId: string,
    @Body() input: SendFriendRequest,
    @Req() request: Request,
  ) {
    const hasRecipientId = typeof input.recipientId === 'string';
    const hasPublicHandle = typeof input.recipientPublicHandle === 'string';
    const hasQrSessionToken = typeof input.qrSessionToken === 'string';
    const selectorCount = [
      hasRecipientId,
      hasPublicHandle,
      hasQrSessionToken,
    ].filter(Boolean).length;
    if (selectorCount !== 1) {
      throw new BadRequestException('Provide exactly one recipient selector');
    }
    if (hasRecipientId) {
      return this.sendRequest.execute({
        actorId,
        recipientId: input.recipientId!,
      });
    }

    const qrSelector = input.recipientPublicHandle ?? input.qrSessionToken!;
    await assertFriendQrRateLimit(
      this.rateLimiter,
      this.config,
      request,
      actorId,
      qrSelector,
    );

    if (hasQrSessionToken) {
      const recipientId = await this.manageQrSession.resolveRecipientId(
        input.qrSessionToken!,
      );
      const result = await this.sendRequest.execute({ actorId, recipientId });
      return { status: result.status, requestedAt: result.requestedAt };
    }

    const recipient = await this.friendUsers.findActiveByPublicHandle(
      input.recipientPublicHandle!,
    );
    if (!recipient) {
      throw new FriendshipError(
        'FRIEND_USER_NOT_FOUND',
        'An active user account could not be found',
      );
    }
    const result = await this.sendRequest.execute({
      actorId,
      recipientId: recipient.id,
    });
    return { status: result.status, requestedAt: result.requestedAt };
  }

  @Post('requests/:requestId/accept')
  @HttpCode(200)
  @Header('Cache-Control', 'no-store')
  @ApiOperation({ summary: 'Accept a pending request as its recipient' })
  @ApiOkResponse({ schema: friendshipSchema })
  @ApiNotFoundResponse({
    description: 'Request does not exist or is not visible to actor',
  })
  @ApiConflictResponse({ description: 'Request is no longer pending' })
  accept(
    @CurrentUser('id') actorId: string,
    @Param('requestId', new ParseUUIDPipe()) requestId: string,
  ) {
    return this.respondRequest.execute({
      actorId,
      requestId,
      decision: 'accepted',
    });
  }

  @Post('requests/:requestId/reject')
  @HttpCode(200)
  @Header('Cache-Control', 'no-store')
  @ApiOperation({ summary: 'Reject a pending request as its recipient' })
  @ApiOkResponse({ schema: friendshipSchema })
  @ApiNotFoundResponse({
    description: 'Request does not exist or is not visible to actor',
  })
  @ApiConflictResponse({ description: 'Request is no longer pending' })
  reject(
    @CurrentUser('id') actorId: string,
    @Param('requestId', new ParseUUIDPipe()) requestId: string,
  ) {
    return this.respondRequest.execute({
      actorId,
      requestId,
      decision: 'rejected',
    });
  }

  @Delete(':friendshipId')
  @HttpCode(204)
  @Header('Cache-Control', 'no-store')
  @ApiOperation({
    summary:
      "Remove an accepted friendship. Both parties' selected-friend " +
      'privacy lists are purged automatically.',
  })
  @ApiNoContentResponse({ description: 'Friendship removed' })
  @ApiNotFoundResponse({
    description: 'Friendship does not exist or is not accepted',
  })
  @ApiForbiddenResponse({ description: 'Actor is not part of this friendship' })
  async unfriend(
    @CurrentUser('id') actorId: string,
    @Param('friendshipId', new ParseUUIDPipe()) friendshipId: string,
  ) {
    await this.unfriendUseCase.execute({
      actorId,
      requestId: friendshipId,
    });
  }
}

async function assertFriendQrRateLimit(
  limiter: RedisRateLimiter,
  config: ConfigService,
  request: Request,
  actorId: string,
  tokenOrHandle?: string,
) {
  const limit = config.getOrThrow<number>('friendQr.rateLimit');
  const ip = request.ip || request.socket.remoteAddress || 'unknown';
  await limiter.assertAllowed('friend-qr:ip', ip, limit);
  await limiter.assertAllowed('friend-qr:account', actorId, limit);
  if (tokenOrHandle) {
    await limiter.assertAllowed('friend-qr:token', tokenOrHandle, limit);
  }
}
