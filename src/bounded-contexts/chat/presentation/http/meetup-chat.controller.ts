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
  UploadedFiles,
  UseInterceptors,
} from '@nestjs/common';
import { FilesInterceptor } from '@nestjs/platform-express';
import {
  ApiBearerAuth,
  ApiBody,
  ApiConsumes,
  ApiForbiddenResponse,
  ApiTags,
} from '@nestjs/swagger';
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
import {
  IncomingChatFile,
  MAX_CHAT_ATTACHMENT_BYTES,
  MAX_CHAT_ATTACHMENT_COUNT,
} from '../../application/services/chat-attachment.service';

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
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        text: { type: 'string', maxLength: 2000 },
        files: { type: 'array', items: { type: 'string', format: 'binary' } },
      },
    },
  })
  @UseInterceptors(
    FilesInterceptor('files', MAX_CHAT_ATTACHMENT_COUNT, {
      limits: {
        fileSize: MAX_CHAT_ATTACHMENT_BYTES,
        files: MAX_CHAT_ATTACHMENT_COUNT,
      },
    }),
  )
  @Header('Cache-Control', 'no-store')
  send(
    @CurrentUser('id') actorId: string,
    @Param('meetupId', new ParseUUIDPipe()) meetupId: string,
    @Body() body: SendMeetupChatMessageRequest,
    @UploadedFiles() files: Express.Multer.File[] = [],
  ) {
    return this.sendMessage.execute({
      actorId,
      meetupId,
      text: body.text,
      files: files.map(toIncomingChatFile),
    });
  }
}

function toIncomingChatFile(file: Express.Multer.File): IncomingChatFile {
  return {
    buffer: file.buffer,
    originalName: file.originalname,
    mimeType: file.mimetype,
    size: file.size,
  };
}
