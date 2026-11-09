import {
  Body,
  Controller,
  Delete,
  HttpCode,
  Param,
  ParseUUIDPipe,
  Post,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiForbiddenResponse,
  ApiNotFoundResponse,
  ApiTags,
} from '@nestjs/swagger';
import { AccessTokenGuard } from '../../../../presentation/http/guards/access-token.guard';
import { RolesGuard } from '../../../../presentation/http/guards/roles.guard';
import { CurrentUser } from '../../../../presentation/http/decorators/current-user.decorator';
import { Roles } from '../../../../presentation/http/decorators/roles.decorator';
import { AdminAccountLockRequest } from '../../application/dto/admin-account-lock.dto';
import { ManageAccountLockUseCase } from '../../application/use-cases/manage-account-lock.use-case';

@ApiTags('Administration')
@ApiBearerAuth()
@ApiForbiddenResponse({ description: 'Admin role required' })
@ApiNotFoundResponse({ description: 'Account not found' })
@UseGuards(AccessTokenGuard, RolesGuard)
@Roles('admin')
@Controller('admin/accounts')
export class AdminAccountsController {
  constructor(private readonly manageLock: ManageAccountLockUseCase) {}

  @Post(':accountId/lock')
  @HttpCode(200)
  lock(
    @CurrentUser('id') actorId: string,
    @Param('accountId', new ParseUUIDPipe()) accountId: string,
    @Body() body: AdminAccountLockRequest,
  ) {
    return this.manageLock.execute({
      actorId,
      accountId,
      locked: true,
      reason: body.reason,
    });
  }

  @Delete(':accountId/lock')
  @HttpCode(200)
  unlock(
    @CurrentUser('id') actorId: string,
    @Param('accountId', new ParseUUIDPipe()) accountId: string,
  ) {
    return this.manageLock.execute({ actorId, accountId, locked: false });
  }
}
