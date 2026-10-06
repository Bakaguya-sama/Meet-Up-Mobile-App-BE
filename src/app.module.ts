import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { HealthController } from './presentation/http/controllers/health.controller';
import { configuration } from './infrastructure/config/configuration';
import { validateEnvironment } from './infrastructure/config/environment.validation';
import { DatabaseModule } from './infrastructure/database/typeorm/database.module';
import { RedisModule } from './infrastructure/redis/redis.module';

const infrastructureModules =
  process.env.NODE_ENV === 'test' ? [] : [DatabaseModule, RedisModule];

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      cache: true,
      load: [configuration],
      validate: validateEnvironment,
    }),
    ...infrastructureModules,
  ],
  controllers: [HealthController],
})
export class AppModule {}
