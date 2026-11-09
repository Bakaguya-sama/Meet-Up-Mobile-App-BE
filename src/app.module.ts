import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { HealthController } from './presentation/http/controllers/health.controller';
import { configuration } from './infrastructure/config/configuration';
import { validateEnvironment } from './infrastructure/config/environment.validation';
import { DatabaseModule } from './infrastructure/database/typeorm/database.module';
import { RedisModule } from './infrastructure/redis/redis.module';
import { OutboxModule } from './infrastructure/outbox/outbox.module';
import { AuthModule } from './bounded-contexts/auth/auth.module';
import { FriendsModule } from './bounded-contexts/friends/friends.module';
import { MeetupsModule } from './bounded-contexts/meetups/meetups.module';
import { LocationsModule } from './bounded-contexts/locations/locations.module';
import { NotificationsModule } from './bounded-contexts/notifications/notifications.module';
import { RecommendationsModule } from './bounded-contexts/recommendations/recommendations.module';
import { ChatModule } from './bounded-contexts/chat/chat.module';
import { AdminModule } from './bounded-contexts/admin/admin.module';

const runtimeModules =
  process.env.NODE_ENV === 'test'
    ? []
    : [
        DatabaseModule,
        RedisModule,
        OutboxModule,
        AuthModule,
        FriendsModule,
        MeetupsModule,
        LocationsModule,
        NotificationsModule,
        RecommendationsModule,
        ChatModule,
        AdminModule,
      ];

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      cache: true,
      load: [configuration],
      validate: validateEnvironment,
    }),
    ...runtimeModules,
  ],
  controllers: [HealthController],
})
export class AppModule {}
