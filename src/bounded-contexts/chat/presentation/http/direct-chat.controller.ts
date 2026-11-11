import {
  Body,
  Controller,
  Get,
  Header,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
  UploadedFiles,
  UseGuards,
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
import {
  ListMeetupChatMessagesRequest,
  SendMeetupChatMessageRequest,
} from '../../application/dto/meetup-chat.dto';
import { ListDirectChatMessagesQuery } from '../../application/queries/list-direct-chat-messages.query';
import { SendDirectChatMessageUseCase } from '../../application/use-cases/send-direct-chat-message.use-case';
import {
  IncomingChatFile,
  MAX_CHAT_ATTACHMENT_BYTES,
  MAX_CHAT_ATTACHMENT_COUNT,
} from '../../application/services/chat-attachment.service';

@ApiTags('Direct chat')
@ApiBearerAuth()
@ApiForbiddenResponse({
  description: 'Only accepted friends can use direct chat',
})
@UseGuards(AccessTokenGuard, RolesGuard)
@Roles('user')
@Controller('chats/direct/:peerId/messages')
export class DirectChatController {
  constructor(
    private readonly sendMessage: SendDirectChatMessageUseCase,
    private readonly listMessages: ListDirectChatMessagesQuery,
  ) {}

  @Get()
  @Header('Cache-Control', 'no-store')
  list(
    @CurrentUser('id') actorId: string,
    @Param('peerId', new ParseUUIDPipe()) peerId: string,
    @Query() query: ListMeetupChatMessagesRequest,
  ) {
    return this.listMessages.execute({
      actorId,
      peerId,
      before: query.before ? new Date(query.before) : undefined,
      beforeId: query.beforeId,
      limit: query.limit,
    });
  }

  @Post()
  @Header('Cache-Control', 'no-store')
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
  send(
    @CurrentUser('id') actorId: string,
    @Param('peerId', new ParseUUIDPipe()) peerId: string,
    @Body() body: SendMeetupChatMessageRequest,
    @UploadedFiles() files: Express.Multer.File[] = [],
  ) {
    return this.sendMessage.execute({
      actorId,
      peerId,
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
