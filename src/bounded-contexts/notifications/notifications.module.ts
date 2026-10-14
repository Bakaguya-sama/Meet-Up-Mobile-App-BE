import { Global, Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuthModule } from '../auth/auth.module';
import { DEVICE_TOKEN_CIPHER } from './application/ports/device-token-cipher.port';
import { DEVICE_TOKEN_STORE } from './application/ports/device-token-store.port';
import type { DeviceTokenCipherPort } from './application/ports/device-token-cipher.port';
import type { DeviceTokenStorePort } from './application/ports/device-token-store.port';
import { PUSH_NOTIFICATION } from './application/ports/push-notification.port';
import { RegisterDeviceTokenUseCase } from './application/use-cases/register-device-token.use-case';
import { RevokeDeviceTokenUseCase } from './application/use-cases/revoke-device-token.use-case';
import { UpdateDeviceTokenUseCase } from './application/use-cases/update-device-token.use-case';
import { PushNotificationAdapter } from './infrastructure/adapters/push-notification.adapter';
import {
  FCM_MESSAGING_CLIENT,
  FcmMessagingClient,
} from './infrastructure/firebase/fcm-messaging.client';
import { DeviceTokenEntity } from './infrastructure/persistence/typeorm/entities/device-token.typeorm-entity';
import { TypeOrmDeviceTokenRepository } from './infrastructure/persistence/typeorm/typeorm-device-token.repository';
import { AesDeviceTokenCipher } from './infrastructure/security/aes-device-token-cipher';
import { DeviceTokensController } from './presentation/http/device-tokens.controller';

@Global()
@Module({
  imports: [TypeOrmModule.forFeature([DeviceTokenEntity]), AuthModule],
  controllers: [DeviceTokensController],
  providers: [
    TypeOrmDeviceTokenRepository,
    { provide: DEVICE_TOKEN_STORE, useExisting: TypeOrmDeviceTokenRepository },
    AesDeviceTokenCipher,
    { provide: DEVICE_TOKEN_CIPHER, useExisting: AesDeviceTokenCipher },
    FcmMessagingClient,
    { provide: FCM_MESSAGING_CLIENT, useExisting: FcmMessagingClient },
    PushNotificationAdapter,
    {
      provide: PUSH_NOTIFICATION,
      useExisting: PushNotificationAdapter,
    },
    {
      provide: RegisterDeviceTokenUseCase,
      useFactory: (
        store: DeviceTokenStorePort,
        cipher: DeviceTokenCipherPort,
      ) => new RegisterDeviceTokenUseCase(store, cipher),
      inject: [DEVICE_TOKEN_STORE, DEVICE_TOKEN_CIPHER],
    },
    {
      provide: UpdateDeviceTokenUseCase,
      useFactory: (
        store: DeviceTokenStorePort,
        cipher: DeviceTokenCipherPort,
      ) => new UpdateDeviceTokenUseCase(store, cipher),
      inject: [DEVICE_TOKEN_STORE, DEVICE_TOKEN_CIPHER],
    },
    {
      provide: RevokeDeviceTokenUseCase,
      useFactory: (store: DeviceTokenStorePort) =>
        new RevokeDeviceTokenUseCase(store),
      inject: [DEVICE_TOKEN_STORE],
    },
  ],
  exports: [PUSH_NOTIFICATION],
})
export class NotificationsModule {}
