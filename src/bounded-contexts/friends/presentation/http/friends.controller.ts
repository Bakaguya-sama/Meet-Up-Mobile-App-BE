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
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiQuery,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import type { Request } from 'express';
import { AccessTokenGuard } from '../../../../presentation/http/guards/access-token.guard';
import {
  FriendPageRequest,
  ListFriendRequestsRequest,
  SearchFriendsRequest,
  SendFriendRequest,
} from '../../application/dto/friends-request.dto';
import { SearchUsersQuery } from '../../application/queries/search-users.query';
import { ListFriendshipsQuery } from '../../application/queries/list-friendships.query';
import { SendFriendRequestUseCase } from '../../application/use-cases/send-friend-request.use-case';
import { RespondFriendRequestUseCase } from '../../application/use-cases/respond-friend-request.use-case';
import {
  ApiFriendPage,
  friendshipPageSchema,
  friendshipSchema,
  searchPageSchema,
  sendFriendRequestSchema,
} from './friends.openapi';

type AuthenticatedRequest = Request & { user: { id: string } };

@ApiTags('Friends')
@ApiBearerAuth()
@ApiUnauthorizedResponse({
  description: 'Missing, invalid or expired access token',
})
@ApiForbiddenResponse({
  description: 'Account locked or actor is not the recipient',
})
@ApiBadRequestResponse({ description: 'Invalid input or self-friendship' })
@UseGuards(AccessTokenGuard)
@Controller('friends')
export class FriendsController {
  constructor(
    private readonly searchUsers: SearchUsersQuery,
    private readonly listFriendships: ListFriendshipsQuery,
    private readonly sendRequest: SendFriendRequestUseCase,
    private readonly respondRequest: RespondFriendRequestUseCase,
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
    @Req() req: AuthenticatedRequest,
    @Query() query: SearchFriendsRequest,
  ) {
    return this.searchUsers.execute({
      actorId: req.user.id,
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
  list(@Req() req: AuthenticatedRequest, @Query() query: FriendPageRequest) {
    return this.listFriendships.execute({
      actorId: req.user.id,
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
    @Req() req: AuthenticatedRequest,
    @Query() query: ListFriendRequestsRequest,
  ) {
    return this.listFriendships.execute({
      actorId: req.user.id,
      kind: query.direction,
      offset: query.offset,
      limit: query.limit,
    });
  }

  @Post('requests')
  @Header('Cache-Control', 'no-store')
  @ApiOperation({ summary: 'Send a friend request' })
  @ApiBody({ schema: sendFriendRequestSchema })
  @ApiCreatedResponse({ schema: friendshipSchema })
  @ApiNotFoundResponse({ description: 'Recipient unavailable' })
  @ApiConflictResponse({
    description: 'This pair already has a friendship or request',
  })
  send(@Req() req: AuthenticatedRequest, @Body() input: SendFriendRequest) {
    return this.sendRequest.execute({
      actorId: req.user.id,
      recipientId: input.recipientId,
    });
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
    @Req() req: AuthenticatedRequest,
    @Param('requestId', new ParseUUIDPipe()) requestId: string,
  ) {
    return this.respondRequest.execute({
      actorId: req.user.id,
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
    @Req() req: AuthenticatedRequest,
    @Param('requestId', new ParseUUIDPipe()) requestId: string,
  ) {
    return this.respondRequest.execute({
      actorId: req.user.id,
      requestId,
      decision: 'rejected',
    });
  }
}
