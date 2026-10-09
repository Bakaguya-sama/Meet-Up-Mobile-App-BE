import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { HealthController } from './presentation/http/controllers/health.controller';
import { configuration } from './infrastructure/config/configuration';
import { validateEnvironment } from './infrastructure/config/environment.validation';
import { DatabaseModule } from './infrastructure/database/typeorm/database.module';
import { RedisModule } from './infrastructure/redis/redis.module';
import { AuthModule } from './bounded-contexts/auth/auth.module';

const runtimeModules =
  process.env.NODE_ENV === 'test'
    ? []
    : [DatabaseModule, RedisModule, AuthModule];

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
