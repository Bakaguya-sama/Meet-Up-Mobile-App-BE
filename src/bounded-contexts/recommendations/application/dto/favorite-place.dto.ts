import { Transform } from 'class-transformer';
import { IsString, Length } from 'class-validator';

export class AddFavoritePlaceRequest {
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim() : value,
  )
  @IsString()
  @Length(1, 300)
  placeId: string;
}

export class FavoritePlaceParams {
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim() : value,
  )
  @IsString()
  @Length(1, 300)
  placeId: string;
}
