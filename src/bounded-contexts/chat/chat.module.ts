import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { RealtimeModule } from '../../infrastructure/realtime/realtime.module';
import { AuthModule } from '../auth/auth.module';
import { MeetupsModule } from '../meetups/meetups.module';
import { FriendsModule } from '../friends/friends.module';
import { FriendshipReader } from '../friends/application/public/friendship-reader';
import {
  REALTIME_PUBLISHER,
  type RealtimePublisherPort,
} from '../../shared-kernel/application/realtime-publisher.port';
import { CHAT_MESSAGE_PUBLISHER } from './application/ports/chat-message-publisher.port';
import type { ChatMessagePublisherPort } from './application/ports/chat-message-publisher.port';
import { MEETUP_CHAT_ACCESS } from './application/ports/meetup-chat-access.port';
import type { MeetupChatAccessPort } from './application/ports/meetup-chat-access.port';
import { MEETUP_CHAT_STORE } from './application/ports/meetup-chat-store.port';
import type { MeetupChatStore } from './application/ports/meetup-chat-store.port';
import { ListMeetupChatMessagesQuery } from './application/queries/list-meetup-chat-messages.query';
import { SendMeetupChatMessageUseCase } from './application/use-cases/send-meetup-chat-message.use-case';
import { MeetupChatAccessAdapter } from './infrastructure/adapters/meetup-chat-access.adapter';
import { RealtimeChatMessagePublisherAdapter } from './infrastructure/adapters/realtime-chat-message-publisher.adapter';
import { MeetupChatMessageEntity } from './infrastructure/persistence/typeorm/entities/meetup-chat-message.typeorm-entity';
import { TypeOrmMeetupChatStore } from './infrastructure/persistence/typeorm/typeorm-meetup-chat-store';
import { MeetupChatController } from './presentation/http/meetup-chat.controller';
import { DirectChatController } from './presentation/http/direct-chat.controller';
import { CHAT_MEDIA_STORAGE } from './application/ports/chat-media-storage.port';
import type { ChatMediaStoragePort } from './application/ports/chat-media-storage.port';
import { ChatAttachmentService } from './application/services/chat-attachment.service';
import { CloudinaryChatMediaStorageAdapter } from './infrastructure/adapters/cloudinary-chat-media-storage.adapter';
import { DIRECT_CHAT_STORE } from './application/ports/direct-chat-store.port';
import type { DirectChatStore } from './application/ports/direct-chat-store.port';
import { DirectChatConversationEntity } from './infrastructure/persistence/typeorm/entities/direct-chat-conversation.typeorm-entity';
import { DirectChatMessageEntity } from './infrastructure/persistence/typeorm/entities/direct-chat-message.typeorm-entity';
import { TypeOrmDirectChatStore } from './infrastructure/persistence/typeorm/typeorm-direct-chat-store';
import { DIRECT_CHAT_MESSAGE_PUBLISHER } from './application/ports/direct-chat-message-publisher.port';
import type { DirectChatMessagePublisherPort } from './application/ports/direct-chat-message-publisher.port';
import { RealtimeDirectChatMessagePublisherAdapter } from './infrastructure/adapters/realtime-direct-chat-message-publisher.adapter';
import { SendDirectChatMessageUseCase } from './application/use-cases/send-direct-chat-message.use-case';
import { ListDirectChatMessagesQuery } from './application/queries/list-direct-chat-messages.query';

@Module({
  imports: [
    AuthModule,
    MeetupsModule,
    FriendsModule,
    RealtimeModule,
    TypeOrmModule.forFeature([
      MeetupChatMessageEntity,
      DirectChatConversationEntity,
      DirectChatMessageEntity,
    ]),
  ],
  controllers: [MeetupChatController, DirectChatController],
  providers: [
    {
      provide: CHAT_MEDIA_STORAGE,
      useClass: CloudinaryChatMediaStorageAdapter,
    },
    {
      provide: ChatAttachmentService,
      useFactory: (storage: ChatMediaStoragePort) =>
        new ChatAttachmentService(storage),
      inject: [CHAT_MEDIA_STORAGE],
    },
    { provide: DIRECT_CHAT_STORE, useClass: TypeOrmDirectChatStore },
    {
      provide: DIRECT_CHAT_MESSAGE_PUBLISHER,
      useClass: RealtimeDirectChatMessagePublisherAdapter,
    },
    { provide: MEETUP_CHAT_STORE, useClass: TypeOrmMeetupChatStore },
    { provide: MEETUP_CHAT_ACCESS, useClass: MeetupChatAccessAdapter },
    {
      provide: CHAT_MESSAGE_PUBLISHER,
      useFactory: (
        publisher: RealtimePublisherPort,
        access: MeetupChatAccessPort,
      ) => new RealtimeChatMessagePublisherAdapter(publisher, access),
      inject: [REALTIME_PUBLISHER, MEETUP_CHAT_ACCESS],
    },
    {
      provide: SendMeetupChatMessageUseCase,
      useFactory: (
        store: MeetupChatStore,
        access: MeetupChatAccessPort,
        publisher: ChatMessagePublisherPort,
        attachments: ChatAttachmentService,
      ) =>
        new SendMeetupChatMessageUseCase(store, access, publisher, attachments),
      inject: [
        MEETUP_CHAT_STORE,
        MEETUP_CHAT_ACCESS,
        CHAT_MESSAGE_PUBLISHER,
        ChatAttachmentService,
      ],
    },
    {
      provide: ListMeetupChatMessagesQuery,
      useFactory: (
        store: MeetupChatStore,
        access: MeetupChatAccessPort,
        attachments: ChatAttachmentService,
      ) => new ListMeetupChatMessagesQuery(store, access, attachments),
      inject: [MEETUP_CHAT_STORE, MEETUP_CHAT_ACCESS, ChatAttachmentService],
    },
    {
      provide: SendDirectChatMessageUseCase,
      useFactory: (
        store: DirectChatStore,
        friendships: FriendshipReader,
        publisher: DirectChatMessagePublisherPort,
        attachments: ChatAttachmentService,
      ) =>
        new SendDirectChatMessageUseCase(
          store,
          friendships,
          publisher,
          attachments,
        ),
      inject: [
        DIRECT_CHAT_STORE,
        FriendshipReader,
        DIRECT_CHAT_MESSAGE_PUBLISHER,
        ChatAttachmentService,
      ],
    },
    {
      provide: ListDirectChatMessagesQuery,
      useFactory: (
        store: DirectChatStore,
        friendships: FriendshipReader,
        attachments: ChatAttachmentService,
      ) => new ListDirectChatMessagesQuery(store, friendships, attachments),
      inject: [DIRECT_CHAT_STORE, FriendshipReader, ChatAttachmentService],
    },
  ],
})
export class ChatModule {}
