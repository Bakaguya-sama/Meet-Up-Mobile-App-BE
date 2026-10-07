import {
  Body,
  Controller,
  Get,
  Header,
  HttpCode,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiCreatedResponse,
  ApiNoContentResponse,
  ApiOkResponse,
  ApiTags,
} from '@nestjs/swagger';
import { Throttle, ThrottlerGuard } from '@nestjs/throttler';
import type { Request } from 'express';
import {
  LoginUseCase,
  LogoutUseCase,
  RefreshTokenUseCase,
  RegisterUseCase,
} from '../../../../bounded-contexts/auth/application/use-cases/auth.use-cases';
import { AccessTokenGuard } from '../../guards/access-token.guard';
import {
  LoginRequest,
  RefreshTokenRequest,
  RegisterRequest,
} from '../../requests/auth/auth.request';
import {
  AuthResponse,
  UserProfileResponse,
} from '../../responses/auth/auth.response';

@ApiTags('Auth')
@Controller('auth')
@UseGuards(ThrottlerGuard)
@Throttle({ default: { limit: 10, ttl: 60000 } })
export class AuthController {
  constructor(
    private readonly register: RegisterUseCase,
    private readonly login: LoginUseCase,
    private readonly refresh: RefreshTokenUseCase,
    private readonly logout: LogoutUseCase,
  ) {}

  @Post('register')
  @Header('Cache-Control', 'no-store')
  @ApiCreatedResponse({ type: AuthResponse })
  registerAccount(@Body() input: RegisterRequest) {
    return this.register.execute(input);
  }

  @Post('login')
  @HttpCode(200)
  @Header('Cache-Control', 'no-store')
  @ApiOkResponse({ type: AuthResponse })
  loginAccount(@Body() input: LoginRequest) {
    return this.login.execute(input);
  }

  @Post('refresh')
  @HttpCode(200)
  @Throttle({ default: { limit: 30, ttl: 60000 } })
  @Header('Cache-Control', 'no-store')
  @ApiOkResponse({ type: AuthResponse })
  refreshToken(@Body() input: RefreshTokenRequest) {
    return this.refresh.execute(input.refreshToken);
  }

  @Post('logout')
  @HttpCode(204)
  @ApiNoContentResponse()
  logoutAccount(@Body() input: RefreshTokenRequest) {
    return this.logout.execute(input.refreshToken);
  }

  @Get('me')
  @UseGuards(AccessTokenGuard)
  @Throttle({ default: { limit: 120, ttl: 60000 } })
  @ApiBearerAuth()
  @Header('Cache-Control', 'no-store')
  @ApiOkResponse({ type: UserProfileResponse })
  me(@Req() request: Request & { user: UserProfileResponse }) {
    const { id, email, displayName, avatarUrl } = request.user;
    return { id, email, displayName, avatarUrl };
  }
}
