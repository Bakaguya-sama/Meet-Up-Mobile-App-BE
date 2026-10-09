import { UserAccountEntity } from './user-account.typeorm-entity';
import { UserSessionEntity } from './user-session.typeorm-entity';

export const authEntities = [UserAccountEntity, UserSessionEntity];
