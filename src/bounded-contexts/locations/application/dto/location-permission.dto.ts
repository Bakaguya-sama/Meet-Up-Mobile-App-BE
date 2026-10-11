import { IsIn, IsUUID, ValidateIf } from 'class-validator';

export class LocationPermissionRequest {
  @IsIn(['friends', 'meetup'])
  scope: 'friends' | 'meetup' = 'friends';

  @ValidateIf(
    (object: LocationPermissionRequest) =>
      object.scope === 'meetup' || object.meetupId !== undefined,
  )
  @IsUUID()
  meetupId?: string;
}
