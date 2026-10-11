import { ActivityTagEntity } from './activity-tag.typeorm-entity';
import { UserAccountEntity } from './user-account.typeorm-entity';
import { UserPreferenceEntity } from './user-preference.typeorm-entity';
import { UserPreferenceTagEntity } from './user-preference-tag.typeorm-entity';
import { UserSessionEntity } from './user-session.typeorm-entity';
import { PrivacySettingsEntity } from './privacy-settings.typeorm-entity';

export const authEntities = [
  PrivacySettingsEntity,
  UserAccountEntity,
  UserSessionEntity,
  ActivityTagEntity,
  UserPreferenceEntity,
  UserPreferenceTagEntity,
];
