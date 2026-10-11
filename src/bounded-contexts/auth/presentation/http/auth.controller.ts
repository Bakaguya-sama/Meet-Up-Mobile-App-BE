import {
  Body,
  Controller,
  Get,
  Header,
  HttpCode,
  Patch,
  Post,
  Put,
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
import { RolesGuard } from '../../../../presentation/http/guards/roles.guard';
import { CurrentUser } from '../../../../presentation/http/decorators/current-user.decorator';
import { Public } from '../../../../presentation/http/decorators/public.decorator';
import { Roles } from '../../../../presentation/http/decorators/roles.decorator';
import type { AuthenticatedUser } from '../../../../shared-kernel/application/authenticated-user';
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

@ApiTags('Auth')
@Controller('auth')
@UseGuards(ThrottlerGuard, AccessTokenGuard, RolesGuard)
@Roles('user')
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
  @Public()
  @Header('Cache-Control', 'no-store')
  @ApiBody({ schema: registerBodySchema })
  @ApiCreatedResponse({ schema: authResultSchema })
  registerAccount(@Body() input: RegisterRequest) {
    return this.register.execute(input);
  }

  @Post('login')
  @Public()
  @ApiBody({ schema: loginBodySchema })
  @HttpCode(200)
  @Header('Cache-Control', 'no-store')
  @ApiOkResponse({ schema: authResultSchema })
  loginAccount(@Body() input: LoginRequest) {
    return this.login.execute(input);
  }

  @Get('google')
  @Public()
  @UseGuards(GoogleOauthGuard)
  async googleAuth() {
    // Guards redirects
  }

  @Get('google/callback')
  @Public()
  @UseGuards(GoogleOauthGuard)
  @ApiOkResponse({ schema: authResultSchema })
  async googleAuthCallback(@CurrentUser() user: LoginWithGoogleInput) {
    return this.googleLogin.execute({
      email: user.email,
      providerAccountId: user.providerAccountId,
      emailVerified: user.emailVerified,
      displayName: user.displayName,
      avatarUrl: user.avatarUrl,
    });
  }

  @Post('refresh')
  @Public()
  @ApiBody({ schema: refreshTokenBodySchema })
  @HttpCode(200)
  @Throttle({ default: { limit: 30, ttl: 60000 } })
  @Header('Cache-Control', 'no-store')
  @ApiOkResponse({ schema: authResultSchema })
  refreshToken(@Body() input: RefreshTokenRequest) {
    return this.refresh.execute(input.refreshToken);
  }

  @Post('logout')
  @Public()
  @ApiBody({ schema: refreshTokenBodySchema })
  @HttpCode(204)
  @ApiNoContentResponse()
  logoutAccount(@Body() input: RefreshTokenRequest) {
    return this.logout.execute(input.refreshToken);
  }

  @Get('me')
  @Throttle({ default: { limit: 120, ttl: 60000 } })
  @ApiBearerAuth()
  @Header('Cache-Control', 'no-store')
  @ApiOkResponse({ schema: userProfileSchema })
  me(@CurrentUser() user: AuthenticatedUser) {
    const { id, email, displayName, avatarUrl } = user;
    return { id, email, displayName, avatarUrl };
  }

  @Patch('profile')
  @Throttle({ default: { limit: 60, ttl: 60000 } })
  @ApiBearerAuth()
  @ApiBody({ schema: updateProfileBodySchema })
  @Header('Cache-Control', 'no-store')
  @ApiOkResponse({ schema: userProfileSchema })
  updateProfile(
    @CurrentUser('id') userId: string,
    @Body() input: UpdateProfileRequest,
  ) {
    return this.updateProfileUseCase.execute({
      userId,
      ...input,
    });
  }

  @Patch('me')
  @Throttle({ default: { limit: 60, ttl: 60000 } })
  @ApiBearerAuth()
  @ApiBody({ schema: updateProfileBodySchema })
  @Header('Cache-Control', 'no-store')
  @ApiOkResponse({ schema: userProfileSchema })
  updateMe(
    @CurrentUser('id') userId: string,
    @Body() input: UpdateProfileRequest,
  ) {
    return this.updateProfileUseCase.execute({
      userId,
      ...input,
    });
  }

  @Get('preferences')
  @Throttle({ default: { limit: 120, ttl: 60000 } })
  @ApiBearerAuth()
  @Header('Cache-Control', 'no-store')
  @ApiOkResponse({ schema: userPreferenceSchema })
  getUserPreferences(@CurrentUser('id') userId: string) {
    return this.getUserPreferenceUseCase.execute(userId);
  }

  @Put('preferences')
  @Throttle({ default: { limit: 60, ttl: 60000 } })
  @ApiBearerAuth()
  @ApiBody({ schema: saveUserPreferenceBodySchema })
  @Header('Cache-Control', 'no-store')
  @ApiOkResponse({ schema: userPreferenceSchema })
  saveUserPreferences(
    @CurrentUser('id') userId: string,
    @Body() input: SaveUserPreferenceRequest,
  ) {
    return this.saveUserPreferenceUseCase.execute({
      userId,
      tags: input.tags,
    });
  }

  @Get('activity-tags')
  @Public()
  @Header('Cache-Control', 'public, max-age=300')
  @ApiOkResponse({ schema: activityTagsSchema })
  getActivityTags() {
    return this.getActivityTagsUseCase.execute();
  }
}
