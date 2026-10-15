import {
  Body,
  Controller,
  Delete,
  Get,
  Header,
  HttpCode,
  Param,
  ParseUUIDPipe,
  Patch,
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
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiQuery,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { CurrentUser } from '../../../../presentation/http/decorators/current-user.decorator';
import { Roles } from '../../../../presentation/http/decorators/roles.decorator';
import { AccessTokenGuard } from '../../../../presentation/http/guards/access-token.guard';
import { RolesGuard } from '../../../../presentation/http/guards/roles.guard';
import {
  CreateMeetupRequest,
  InviteParticipantsRequest,
  MeetupPageRequest,
  UpdateMeetupRequest,
} from '../../application/dto/meetup-request.dto';
import { GetMeetupDetailQuery } from '../../application/queries/get-meetup-detail.query';
import { ListMeetupsQuery } from '../../application/queries/list-meetups.query';
import { CreateMeetupUseCase } from '../../application/use-cases/create-meetup.use-case';
import { UpdateMeetupUseCase } from '../../application/use-cases/update-meetup.use-case';
import { InviteParticipantsUseCase } from '../../application/use-cases/invite-participants.use-case';
import { RespondInvitationUseCase } from '../../application/use-cases/respond-invitation.use-case';
import { LeaveMeetupUseCase } from '../../application/use-cases/leave-meetup.use-case';
import { RemoveParticipantUseCase } from '../../application/use-cases/remove-participant.use-case';
import { CancelMeetupUseCase } from '../../application/use-cases/cancel-meetup.use-case';
import { FinishMeetupUseCase } from '../../application/use-cases/finish-meetup.use-case';
import {
  createMeetupSchema,
  inviteParticipantsSchema,
  meetupDetailSchema,
  meetupPageSchema,
  updateMeetupSchema,
} from './meetups.openapi';

@ApiTags('Meetups')
@ApiBearerAuth()
@ApiUnauthorizedResponse({ description: 'Missing or invalid access token' })
@ApiForbiddenResponse({
  description: 'Locked account or organizer-only action',
})
@ApiBadRequestResponse({ description: 'Invalid input or unavailable invitees' })
@ApiNotFoundResponse({
  description: 'Meetup does not exist or is not visible to the actor',
})
@ApiConflictResponse({
  description:
    'Invalid state transition, duplicate response, or expired invitation',
})
@UseGuards(AccessTokenGuard, RolesGuard)
@Roles('user')
@Controller('meetups')
export class MeetupsController {
  constructor(
    private readonly createMeetup: CreateMeetupUseCase,
    private readonly updateMeetup: UpdateMeetupUseCase,
    private readonly inviteParticipants: InviteParticipantsUseCase,
    private readonly respondInvitation: RespondInvitationUseCase,
    private readonly leaveMeetup: LeaveMeetupUseCase,
    private readonly removeParticipant: RemoveParticipantUseCase,
    private readonly cancelMeetup: CancelMeetupUseCase,
    private readonly finishMeetup: FinishMeetupUseCase,
    private readonly getDetail: GetMeetupDetailQuery,
    private readonly listMeetups: ListMeetupsQuery,
  ) {}

  @Post()
  @Header('Cache-Control', 'no-store')
  @ApiOperation({
    summary: 'Create an inviting meetup; organizer is accepted automatically',
  })
  @ApiBody({ schema: createMeetupSchema })
  @ApiCreatedResponse({ schema: meetupDetailSchema })
  create(
    @CurrentUser('id') actorId: string,
    @Body() body: CreateMeetupRequest,
  ) {
    return this.createMeetup.execute(actorId, body);
  }

  @Get()
  @Header('Cache-Control', 'no-store')
  @ApiOperation({
    summary:
      'List meetups where you are invited or accepted, including closed meetups',
  })
  @ApiQuery({
    name: 'offset',
    required: false,
    schema: { type: 'integer', default: 0, minimum: 0, maximum: 100000 },
  })
  @ApiQuery({
    name: 'limit',
    required: false,
    schema: { type: 'integer', default: 20, minimum: 1, maximum: 100 },
  })
  @ApiOkResponse({ schema: meetupPageSchema })
  list(@CurrentUser('id') actorId: string, @Query() query: MeetupPageRequest) {
    return this.listMeetups.execute(actorId, query.offset, query.limit);
  }

  @Get(':meetupId')
  @Header('Cache-Control', 'no-store')
  @ApiOkResponse({ schema: meetupDetailSchema })
  detail(
    @CurrentUser('id') actorId: string,
    @Param('meetupId', new ParseUUIDPipe()) meetupId: string,
  ) {
    return this.getDetail.execute(actorId, meetupId);
  }

  @Patch(':meetupId')
  @Header('Cache-Control', 'no-store')
  @ApiOperation({
    summary:
      'Update details or recommendationMode as organizer before finalization',
  })
  @ApiBody({ schema: updateMeetupSchema })
  @ApiOkResponse({ schema: meetupDetailSchema })
  update(
    @CurrentUser('id') actorId: string,
    @Param('meetupId', new ParseUUIDPipe()) meetupId: string,
    @Body() body: UpdateMeetupRequest,
  ) {
    return this.updateMeetup.execute(actorId, meetupId, body);
  }

  @Post(':meetupId/invitations')
  @HttpCode(200)
  @Header('Cache-Control', 'no-store')
  @ApiOperation({
    summary: 'Invite or reinvite active accepted friends as organizer',
  })
  @ApiBody({ schema: inviteParticipantsSchema })
  @ApiOkResponse({ schema: meetupDetailSchema })
  invite(
    @CurrentUser('id') actorId: string,
    @Param('meetupId', new ParseUUIDPipe()) meetupId: string,
    @Body() body: InviteParticipantsRequest,
  ) {
    return this.inviteParticipants.execute(actorId, meetupId, body.inviteeIds);
  }

  @Post(':meetupId/invitations/accept')
  @HttpCode(200)
  @Header('Cache-Control', 'no-store')
  @ApiOkResponse({ schema: meetupDetailSchema })
  accept(
    @CurrentUser('id') actorId: string,
    @Param('meetupId', new ParseUUIDPipe()) meetupId: string,
  ) {
    return this.respondInvitation.execute(actorId, meetupId, 'accepted');
  }

  @Post(':meetupId/invitations/reject')
  @HttpCode(200)
  @Header('Cache-Control', 'no-store')
  @ApiOkResponse({ schema: meetupDetailSchema })
  reject(
    @CurrentUser('id') actorId: string,
    @Param('meetupId', new ParseUUIDPipe()) meetupId: string,
  ) {
    return this.respondInvitation.execute(actorId, meetupId, 'declined');
  }

  @Post(':meetupId/leave')
  @HttpCode(200)
  @Header('Cache-Control', 'no-store')
  @ApiOkResponse({ schema: meetupDetailSchema })
  leave(
    @CurrentUser('id') actorId: string,
    @Param('meetupId', new ParseUUIDPipe()) meetupId: string,
  ) {
    return this.leaveMeetup.execute(actorId, meetupId);
  }

  @Delete(':meetupId/participants/:userId')
  @Header('Cache-Control', 'no-store')
  @ApiOkResponse({ schema: meetupDetailSchema })
  remove(
    @CurrentUser('id') actorId: string,
    @Param('meetupId', new ParseUUIDPipe()) meetupId: string,
    @Param('userId', new ParseUUIDPipe()) userId: string,
  ) {
    return this.removeParticipant.execute(actorId, meetupId, userId);
  }

  @Post(':meetupId/cancel')
  @HttpCode(200)
  @Header('Cache-Control', 'no-store')
  @ApiOkResponse({ schema: meetupDetailSchema })
  cancel(
    @CurrentUser('id') actorId: string,
    @Param('meetupId', new ParseUUIDPipe()) meetupId: string,
  ) {
    return this.cancelMeetup.execute(actorId, meetupId);
  }

  @Post(':meetupId/finish')
  @HttpCode(200)
  @Header('Cache-Control', 'no-store')
  @ApiOperation({
    summary: 'Finish a finalized meetup after its scheduled start',
  })
  @ApiOkResponse({ schema: meetupDetailSchema })
  finish(
    @CurrentUser('id') actorId: string,
    @Param('meetupId', new ParseUUIDPipe()) meetupId: string,
  ) {
    return this.finishMeetup.execute(actorId, meetupId);
  }
}
