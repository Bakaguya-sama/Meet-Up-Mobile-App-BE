import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { RealtimeModule } from '../../infrastructure/realtime/realtime.module';
import { AuthModule } from '../auth/auth.module';
import { MeetupsModule } from '../meetups/meetups.module';
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

@Module({
  imports: [
    AuthModule,
    MeetupsModule,
    RealtimeModule,
    TypeOrmModule.forFeature([MeetupChatMessageEntity]),
  ],
  controllers: [MeetupChatController],
  providers: [
    { provide: MEETUP_CHAT_STORE, useClass: TypeOrmMeetupChatStore },
    { provide: MEETUP_CHAT_ACCESS, useClass: MeetupChatAccessAdapter },
    {
      provide: CHAT_MESSAGE_PUBLISHER,
      useClass: RealtimeChatMessagePublisherAdapter,
    },
    {
      provide: SendMeetupChatMessageUseCase,
      useFactory: (
        store: MeetupChatStore,
        access: MeetupChatAccessPort,
        publisher: ChatMessagePublisherPort,
      ) => new SendMeetupChatMessageUseCase(store, access, publisher),
      inject: [MEETUP_CHAT_STORE, MEETUP_CHAT_ACCESS, CHAT_MESSAGE_PUBLISHER],
    },
    {
      provide: ListMeetupChatMessagesQuery,
      useFactory: (store: MeetupChatStore, access: MeetupChatAccessPort) =>
        new ListMeetupChatMessagesQuery(store, access),
      inject: [MEETUP_CHAT_STORE, MEETUP_CHAT_ACCESS],
    },
  ],
})
export class ChatModule {}
