import {
  Body,
  Controller,
  Get,
  Header,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiForbiddenResponse, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../../../../presentation/http/decorators/current-user.decorator';
import { Roles } from '../../../../presentation/http/decorators/roles.decorator';
import { AccessTokenGuard } from '../../../../presentation/http/guards/access-token.guard';
import { RolesGuard } from '../../../../presentation/http/guards/roles.guard';
import { ListMeetupChatMessagesQuery } from '../../application/queries/list-meetup-chat-messages.query';
import { SendMeetupChatMessageUseCase } from '../../application/use-cases/send-meetup-chat-message.use-case';
import {
  ListMeetupChatMessagesRequest,
  SendMeetupChatMessageRequest,
} from '../../application/dto/meetup-chat.dto';

@ApiTags('Meetup chat')
@ApiBearerAuth()
@ApiForbiddenResponse({
  description: 'Only accepted members of an active meetup can use chat',
})
@UseGuards(AccessTokenGuard, RolesGuard)
@Roles('user')
@Controller('meetups/:meetupId/chat/messages')
export class MeetupChatController {
  constructor(
    private readonly sendMessage: SendMeetupChatMessageUseCase,
    private readonly listMessages: ListMeetupChatMessagesQuery,
  ) {}

  @Get()
  @Header('Cache-Control', 'no-store')
  list(
    @CurrentUser('id') actorId: string,
    @Param('meetupId', new ParseUUIDPipe()) meetupId: string,
    @Query() query: ListMeetupChatMessagesRequest,
  ) {
    return this.listMessages.execute({
      actorId,
      meetupId,
      before: query.before ? new Date(query.before) : undefined,
      beforeId: query.beforeId,
      limit: query.limit,
    });
  }

  @Post()
  @Header('Cache-Control', 'no-store')
  send(
    @CurrentUser('id') actorId: string,
    @Param('meetupId', new ParseUUIDPipe()) meetupId: string,
    @Body() body: SendMeetupChatMessageRequest,
  ) {
    return this.sendMessage.execute({
      actorId,
      meetupId,
      text: body.text,
    });
  }
}
