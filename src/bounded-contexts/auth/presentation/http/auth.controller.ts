import {
  Body,
  Controller,
  Get,
  Header,
  HttpCode,
  Patch,
  Post,
  Put,
  Req,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiBody,
  ApiCreatedResponse,
  ApiNoContentResponse,
  ApiOkResponse,
  ApiTags,
} from '@nestjs/swagger';
import { Throttle, ThrottlerGuard } from '@nestjs/throttler';
import type { Request } from 'express';
import { LoginAccountUseCase } from '../../application/use-cases/login-account.use-case';
import { LogoutAccountUseCase } from '../../application/use-cases/logout-account.use-case';
import { RefreshTokenUseCase } from '../../application/use-cases/refresh-token.use-case';
import { RegisterAccountUseCase } from '../../application/use-cases/register-account.use-case';
import { LoginWithGoogleUseCase } from '../../application/use-cases/login-with-google.use-case';
import type { LoginWithGoogleInput } from '../../application/use-cases/login-with-google.use-case';
import { UpdateProfileUseCase } from '../../application/use-cases/update-profile.use-case';
import { SaveUserPreferenceUseCase } from '../../application/use-cases/save-user-preference.use-case';
import { GetUserPreferenceUseCase } from '../../application/use-cases/get-user-preference.use-case';
import { GetActivityTagsUseCase } from '../../application/use-cases/get-activity-tags.use-case';
import { AccessTokenGuard } from '../../../../presentation/http/guards/access-token.guard';
import { GoogleOauthGuard } from './guards/google-oauth.guard';
import {
  activityTagsSchema,
  authResultSchema,
  loginBodySchema,
  refreshTokenBodySchema,
  registerBodySchema,
  saveUserPreferenceBodySchema,
  updateProfileBodySchema,
  userPreferenceSchema,
  userProfileSchema,
} from './auth.openapi';
import {
  LoginRequest,
  RefreshTokenRequest,
  RegisterRequest,
  SaveUserPreferenceRequest,
  UpdateProfileRequest,
} from '../../application/dto/auth-request.dto';
import type { UserProfileDto } from '../../application/dto/auth-response.dto';

@ApiTags('Auth')
@Controller('auth')
@UseGuards(ThrottlerGuard)
@Throttle({ default: { limit: 10, ttl: 60000 } })
export class AuthController {
  constructor(
    private readonly register: RegisterAccountUseCase,
    private readonly login: LoginAccountUseCase,
    private readonly refresh: RefreshTokenUseCase,
    private readonly logout: LogoutAccountUseCase,
    private readonly googleLogin: LoginWithGoogleUseCase,
    private readonly updateProfileUseCase: UpdateProfileUseCase,
    private readonly saveUserPreferenceUseCase: SaveUserPreferenceUseCase,
    private readonly getUserPreferenceUseCase: GetUserPreferenceUseCase,
    private readonly getActivityTagsUseCase: GetActivityTagsUseCase,
  ) {}

  @Post('register')
  @Header('Cache-Control', 'no-store')
  @ApiBody({ schema: registerBodySchema })
  @ApiCreatedResponse({ schema: authResultSchema })
  registerAccount(@Body() input: RegisterRequest) {
    return this.register.execute(input);
  }

  @Post('login')
  @ApiBody({ schema: loginBodySchema })
  @HttpCode(200)
  @Header('Cache-Control', 'no-store')
  @ApiOkResponse({ schema: authResultSchema })
  loginAccount(@Body() input: LoginRequest) {
    return this.login.execute(input);
  }

  @Get('google')
  @UseGuards(GoogleOauthGuard)
  async googleAuth() {
    // Guards redirects
  }

  @Get('google/callback')
  @UseGuards(GoogleOauthGuard)
  @ApiOkResponse({ schema: authResultSchema })
  async googleAuthCallback(
    @Req() req: Request & { user: LoginWithGoogleInput },
  ) {
    return this.googleLogin.execute({
      email: req.user.email,
      displayName: req.user.displayName,
      avatarUrl: req.user.avatarUrl,
    });
  }

  @Post('refresh')
  @ApiBody({ schema: refreshTokenBodySchema })
  @HttpCode(200)
  @Throttle({ default: { limit: 30, ttl: 60000 } })
  @Header('Cache-Control', 'no-store')
  @ApiOkResponse({ schema: authResultSchema })
  refreshToken(@Body() input: RefreshTokenRequest) {
    return this.refresh.execute(input.refreshToken);
  }

  @Post('logout')
  @ApiBody({ schema: refreshTokenBodySchema })
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
  @ApiOkResponse({ schema: userProfileSchema })
  me(@Req() request: Request & { user: UserProfileDto }) {
    const { id, email, displayName, avatarUrl } = request.user;
    return { id, email, displayName, avatarUrl };
  }

  @Patch('profile')
  @UseGuards(AccessTokenGuard)
  @Throttle({ default: { limit: 60, ttl: 60000 } })
  @ApiBearerAuth()
  @ApiBody({ schema: updateProfileBodySchema })
  @Header('Cache-Control', 'no-store')
  @ApiOkResponse({ schema: userProfileSchema })
  updateProfile(
    @Req() req: Request & { user: UserProfileDto },
    @Body() input: UpdateProfileRequest,
  ) {
    return this.updateProfileUseCase.execute({
      userId: req.user.id,
      ...input,
    });
  }

  @Patch('me')
  @UseGuards(AccessTokenGuard)
  @Throttle({ default: { limit: 60, ttl: 60000 } })
  @ApiBearerAuth()
  @ApiBody({ schema: updateProfileBodySchema })
  @Header('Cache-Control', 'no-store')
  @ApiOkResponse({ schema: userProfileSchema })
  updateMe(
    @Req() req: Request & { user: UserProfileDto },
    @Body() input: UpdateProfileRequest,
  ) {
    return this.updateProfileUseCase.execute({
      userId: req.user.id,
      ...input,
    });
  }

  @Get('preferences')
  @UseGuards(AccessTokenGuard)
  @Throttle({ default: { limit: 120, ttl: 60000 } })
  @ApiBearerAuth()
  @Header('Cache-Control', 'no-store')
  @ApiOkResponse({ schema: userPreferenceSchema })
  getUserPreferences(@Req() req: Request & { user: UserProfileDto }) {
    return this.getUserPreferenceUseCase.execute(req.user.id);
  }

  @Put('preferences')
  @UseGuards(AccessTokenGuard)
  @Throttle({ default: { limit: 60, ttl: 60000 } })
  @ApiBearerAuth()
  @ApiBody({ schema: saveUserPreferenceBodySchema })
  @Header('Cache-Control', 'no-store')
  @ApiOkResponse({ schema: userPreferenceSchema })
  saveUserPreferences(
    @Req() req: Request & { user: UserProfileDto },
    @Body() input: SaveUserPreferenceRequest,
  ) {
    return this.saveUserPreferenceUseCase.execute({
      userId: req.user.id,
      tags: input.tags,
    });
  }

  @Get('activity-tags')
  @Header('Cache-Control', 'public, max-age=300')
  @ApiOkResponse({ schema: activityTagsSchema })
  getActivityTags() {
    return this.getActivityTagsUseCase.execute();
  }
}
