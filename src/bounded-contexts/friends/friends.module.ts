import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuthModule } from '../auth/auth.module';
import { FRIENDSHIP_STORE } from './application/ports/persistence/friendship-store.port';
import type { FriendshipStorePort } from './application/ports/persistence/friendship-store.port';
import { FRIEND_USER_DIRECTORY } from './application/ports/user-directory.port';
import type { FriendUserDirectoryPort } from './application/ports/user-directory.port';
import { ListFriendshipsQuery } from './application/queries/list-friendships.query';
import { SearchUsersQuery } from './application/queries/search-users.query';
import { SendFriendRequestUseCase } from './application/use-cases/send-friend-request.use-case';
import { RespondFriendRequestUseCase } from './application/use-cases/respond-friend-request.use-case';
import { UnfriendUseCase } from './application/use-cases/unfriend.use-case';
import { AuthUserDirectoryAdapter } from './infrastructure/adapters/auth-user-directory.adapter';
import { FriendshipEntity } from './infrastructure/persistence/typeorm/entities/friendship.typeorm-entity';
import { TypeOrmFriendshipRepository } from './infrastructure/persistence/typeorm/typeorm-friendship-repository';
import { FriendsController } from './presentation/http/friends.controller';
import { FriendshipReader } from './application/public/friendship-reader';
import { PrivacySelectedFriendPurge } from '../auth/application/public/privacy-selected-friend-purge';

@Module({
  imports: [AuthModule, TypeOrmModule.forFeature([FriendshipEntity])],
  controllers: [FriendsController],
  providers: [
    {
      provide: FriendshipReader,
      useFactory: (store: FriendshipStorePort) => new FriendshipReader(store),
      inject: [FRIENDSHIP_STORE],
    },
    { provide: FRIENDSHIP_STORE, useClass: TypeOrmFriendshipRepository },
    { provide: FRIEND_USER_DIRECTORY, useClass: AuthUserDirectoryAdapter },
    {
      provide: SendFriendRequestUseCase,
      useFactory: (
        store: FriendshipStorePort,
        users: FriendUserDirectoryPort,
      ) => new SendFriendRequestUseCase(store, users),
      inject: [FRIENDSHIP_STORE, FRIEND_USER_DIRECTORY],
    },
    {
      provide: RespondFriendRequestUseCase,
      useFactory: (store: FriendshipStorePort) =>
        new RespondFriendRequestUseCase(store),
      inject: [FRIENDSHIP_STORE],
    },
    {
      provide: UnfriendUseCase,
      useFactory: (
        store: FriendshipStorePort,
        purge: PrivacySelectedFriendPurge,
      ) => new UnfriendUseCase(store, purge),
      inject: [FRIENDSHIP_STORE, PrivacySelectedFriendPurge],
    },
    {
      provide: SearchUsersQuery,
      useFactory: (
        store: FriendshipStorePort,
        users: FriendUserDirectoryPort,
      ) => new SearchUsersQuery(store, users),
      inject: [FRIENDSHIP_STORE, FRIEND_USER_DIRECTORY],
    },
    {
      provide: ListFriendshipsQuery,
      useFactory: (
        store: FriendshipStorePort,
        users: FriendUserDirectoryPort,
      ) => new ListFriendshipsQuery(store, users),
      inject: [FRIENDSHIP_STORE, FRIEND_USER_DIRECTORY],
    },
  ],
  exports: [FriendshipReader],
})
export class FriendsModule {}
