import {
  Body,
  Controller,
  Delete,
  Get,
  Header,
  HttpCode,
  Param,
  Post,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiNotFoundResponse, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../../../../presentation/http/decorators/current-user.decorator';
import { Roles } from '../../../../presentation/http/decorators/roles.decorator';
import { AccessTokenGuard } from '../../../../presentation/http/guards/access-token.guard';
import { RolesGuard } from '../../../../presentation/http/guards/roles.guard';
import { AddFavoritePlaceRequest } from '../../application/dto/favorite-place.dto';
import { ManageFavoritePlaceUseCase } from '../../application/use-cases/manage-favorite-place.use-case';

@ApiTags('Favorite places')
@ApiBearerAuth()
@ApiNotFoundResponse({
  description: 'Place ID is not present in known recommendation candidates',
})
@UseGuards(AccessTokenGuard, RolesGuard)
@Roles('user')
@Controller('favorites/places')
export class FavoritePlacesController {
  constructor(private readonly favorites: ManageFavoritePlaceUseCase) {}

  @Get()
  @Header('Cache-Control', 'no-store')
  list(@CurrentUser('id') userId: string) {
    return this.favorites.list(userId);
  }

  @Post()
  @Header('Cache-Control', 'no-store')
  add(
    @CurrentUser('id') userId: string,
    @Body() body: AddFavoritePlaceRequest,
  ) {
    return this.favorites.add(userId, body.placeId);
  }

  @Delete(':placeId')
  @HttpCode(204)
  remove(
    @CurrentUser('id') userId: string,
    @Param('placeId') placeId: string,
  ) {
    return this.favorites.remove(userId, placeId);
  }
}
