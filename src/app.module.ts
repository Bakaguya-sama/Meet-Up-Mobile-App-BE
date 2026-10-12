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
import { LocationsModule } from './bounded-contexts/locations/locations.module';

const runtimeModules =
  process.env.NODE_ENV === 'test'
    ? []
    : [
        DatabaseModule,
        RedisModule,
        OutboxModule,
        AuthModule,
        FriendsModule,
        LocationsModule,
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
