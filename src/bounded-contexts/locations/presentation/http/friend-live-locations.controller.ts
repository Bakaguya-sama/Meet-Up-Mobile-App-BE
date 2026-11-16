import { Controller, Get, Header, UseGuards } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { CurrentUser } from '../../../../presentation/http/decorators/current-user.decorator';
import { Roles } from '../../../../presentation/http/decorators/roles.decorator';
import { AccessTokenGuard } from '../../../../presentation/http/guards/access-token.guard';
import { RolesGuard } from '../../../../presentation/http/guards/roles.guard';
import { ListFriendLiveLocationsQuery } from '../../application/queries/list-friend-live-locations.query';

@ApiTags('Friend live locations')
@ApiBearerAuth()
@UseGuards(AccessTokenGuard, RolesGuard)
@Roles('user')
@Controller('friends/live-locations')
export class FriendLiveLocationsController {
  constructor(private readonly query: ListFriendLiveLocationsQuery) {}

  @Get()
  @Header('Cache-Control', 'no-store')
  @ApiOperation({
    summary: 'Read currently visible live locations of accepted friends',
  })
  @ApiOkResponse({
    description: 'Only unexpired, privacy-projected friend locations',
  })
  list(@CurrentUser('id') viewerId: string) {
    return this.query.execute(viewerId);
  }
}
