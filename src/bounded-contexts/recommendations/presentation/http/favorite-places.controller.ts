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
import {
  AddFavoritePlaceRequest,
  FavoritePlaceParams,
} from '../../application/dto/favorite-place.dto';
import { AddFavoritePlaceUseCase } from '../../application/use-cases/add-favorite-place.use-case';
import { ListFavoritePlacesUseCase } from '../../application/use-cases/list-favorite-places.use-case';
import { RemoveFavoritePlaceUseCase } from '../../application/use-cases/remove-favorite-place.use-case';

@ApiTags('Favorite places')
@ApiBearerAuth()
@ApiNotFoundResponse({
  description: 'Place ID is not present in known recommendation candidates',
})
@UseGuards(AccessTokenGuard, RolesGuard)
@Roles('user')
@Controller('favorites/places')
export class FavoritePlacesController {
  constructor(
    private readonly addFavorite: AddFavoritePlaceUseCase,
    private readonly listFavorites: ListFavoritePlacesUseCase,
    private readonly removeFavorite: RemoveFavoritePlaceUseCase,
  ) {}

  @Get()
  @Header('Cache-Control', 'no-store')
  list(@CurrentUser('id') userId: string) {
    return this.listFavorites.execute(userId);
  }

  @Post()
  @Header('Cache-Control', 'no-store')
  add(
    @CurrentUser('id') userId: string,
    @Body() body: AddFavoritePlaceRequest,
  ) {
    return this.addFavorite.execute(userId, body.placeId);
  }

  @Delete(':placeId')
  @HttpCode(204)
  remove(
    @CurrentUser('id') userId: string,
    @Param() params: FavoritePlaceParams,
  ) {
    return this.removeFavorite.execute(userId, params.placeId);
  }
}
