import {
  Body,
  Controller,
  Delete,
  Get,
  Header,
  HttpCode,
  Param,
  ParseUUIDPipe,
  Put,
  Req,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiBearerAuth,
  ApiBody,
  ApiForbiddenResponse,
  ApiNoContentResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import type { Request } from 'express';
import { AccessTokenGuard } from '../../../../presentation/http/guards/access-token.guard';
import { SavePrivacySettingsRequest } from '../../application/dto/privacy-settings.dto';
import { GetPrivacySettingsUseCase } from '../../application/use-cases/get-privacy-settings.use-case';
import { SavePrivacySettingsUseCase } from '../../application/use-cases/save-privacy-settings.use-case';
import { RemoveSelectedFriendUseCase } from '../../application/use-cases/remove-selected-friend.use-case';
import {
  privacySettingsBodySchema,
  privacySettingsSchema,
} from './privacy.openapi';

@ApiTags('Location privacy')
@ApiBearerAuth()
@ApiUnauthorizedResponse({ description: 'Invalid or missing access token' })
@ApiForbiddenResponse({ description: 'Account is locked' })
@ApiNotFoundResponse({ description: 'Account is unavailable' })
@UseGuards(AccessTokenGuard)
@Controller('auth/privacy')
export class PrivacyController {
  constructor(
    private readonly getSettings: GetPrivacySettingsUseCase,
    private readonly saveSettings: SavePrivacySettingsUseCase,
    private readonly removeSelectedFriend: RemoveSelectedFriendUseCase,
  ) {}

  @Get()
  @Header('Cache-Control', 'no-store')
  @ApiOperation({
    summary: 'Read your location privacy settings (defaults to off)',
  })
  @ApiOkResponse({ schema: privacySettingsSchema })
  get(@Req() req: Request & { user: { id: string } }) {
    return this.getSettings.execute(req.user.id);
  }

  @Put()
  @Header('Cache-Control', 'no-store')
  @ApiOperation({ summary: 'Replace your location privacy settings' })
  @ApiBody({ schema: privacySettingsBodySchema })
  @ApiOkResponse({ schema: privacySettingsSchema })
  @ApiBadRequestResponse({
    description: 'Invalid mode, expiry, selection or input fields',
  })
  save(
    @Req() req: Request & { user: { id: string } },
    @Body() input: SavePrivacySettingsRequest,
  ) {
    return this.saveSettings.execute(req.user.id, input);
  }

  @Delete('selected-friends/:friendId')
  @HttpCode(204)
  @Header('Cache-Control', 'no-store')
  @ApiOperation({
    summary:
      'Remove one user from your selected audience (idempotent). ' +
      "If this was the last selected friend the mode is automatically downgraded to 'friends'.",
  })
  @ApiParam({ name: 'friendId', type: String, format: 'uuid' })
  @ApiNoContentResponse({ description: 'Friend removed (or was not in list)' })
  @ApiBadRequestResponse({ description: 'friendId is not a valid UUID' })
  async deleteSelectedFriend(
    @Req() req: Request & { user: { id: string } },
    @Param('friendId', new ParseUUIDPipe()) friendId: string,
  ) {
    await this.removeSelectedFriend.execute({
      ownerId: req.user.id,
      selectedFriendId: friendId,
    });
  }
}
