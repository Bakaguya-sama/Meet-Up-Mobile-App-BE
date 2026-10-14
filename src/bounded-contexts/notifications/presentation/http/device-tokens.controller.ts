import {
  Body,
  Controller,
  Delete,
  Header,
  HttpCode,
  Param,
  ParseUUIDPipe,
  Post,
  Put,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiCreatedResponse,
  ApiNoContentResponse,
  ApiOkResponse,
  ApiTags,
} from '@nestjs/swagger';
import { CurrentUser } from '../../../../presentation/http/decorators/current-user.decorator';
import { Roles } from '../../../../presentation/http/decorators/roles.decorator';
import { AccessTokenGuard } from '../../../../presentation/http/guards/access-token.guard';
import { RolesGuard } from '../../../../presentation/http/guards/roles.guard';
import {
  RegisterDeviceTokenRequest,
  UpdateDeviceTokenRequest,
} from '../../application/dto/device-token.dto';
import { RegisterDeviceTokenUseCase } from '../../application/use-cases/register-device-token.use-case';
import { RevokeDeviceTokenUseCase } from '../../application/use-cases/revoke-device-token.use-case';
import { UpdateDeviceTokenUseCase } from '../../application/use-cases/update-device-token.use-case';

@ApiTags('Notifications')
@ApiBearerAuth()
@UseGuards(AccessTokenGuard, RolesGuard)
@Roles('user')
@Controller('notifications/devices')
export class DeviceTokensController {
  constructor(
    private readonly register: RegisterDeviceTokenUseCase,
    private readonly update: UpdateDeviceTokenUseCase,
    private readonly revoke: RevokeDeviceTokenUseCase,
  ) {}

  @Post()
  @Header('Cache-Control', 'no-store')
  @ApiCreatedResponse({
    schema: {
      type: 'object',
      required: ['id'],
      properties: { id: { type: 'string', format: 'uuid' } },
    },
  })
  registerToken(
    @CurrentUser('id') userId: string,
    @Body() input: RegisterDeviceTokenRequest,
  ) {
    return this.register.execute(userId, input);
  }

  @Put(':deviceTokenId')
  @Header('Cache-Control', 'no-store')
  @ApiOkResponse({
    schema: {
      type: 'object',
      required: ['id'],
      properties: { id: { type: 'string', format: 'uuid' } },
    },
  })
  updateToken(
    @CurrentUser('id') userId: string,
    @Param('deviceTokenId', new ParseUUIDPipe()) deviceTokenId: string,
    @Body() input: UpdateDeviceTokenRequest,
  ) {
    return this.update.execute(userId, deviceTokenId, input);
  }

  @Delete(':deviceTokenId')
  @HttpCode(204)
  @ApiNoContentResponse()
  async revokeToken(
    @CurrentUser('id') userId: string,
    @Param('deviceTokenId', new ParseUUIDPipe()) deviceTokenId: string,
  ): Promise<void> {
    await this.revoke.execute(userId, deviceTokenId);
  }
}
