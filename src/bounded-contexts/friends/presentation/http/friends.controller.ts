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
  Query,
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
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
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
import { SendFriendRequestUseCase } from '../../application/use-cases/send-friend-request.use-case';
import { RespondFriendRequestUseCase } from '../../application/use-cases/respond-friend-request.use-case';
import { UnfriendUseCase } from '../../application/use-cases/unfriend.use-case';
import {
  ApiFriendPage,
  friendshipPageSchema,
  friendshipSchema,
  searchPageSchema,
  sendFriendRequestSchema,
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

  @Post('requests')
  @Header('Cache-Control', 'no-store')
  @ApiOperation({ summary: 'Send a friend request' })
  @ApiBody({ schema: sendFriendRequestSchema })
  @ApiCreatedResponse({ schema: friendshipSchema })
  @ApiNotFoundResponse({ description: 'Recipient unavailable' })
  @ApiConflictResponse({
    description: 'This pair already has a friendship or request',
  })
  send(@CurrentUser('id') actorId: string, @Body() input: SendFriendRequest) {
    return this.sendRequest.execute({
      actorId,
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
