import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { ACCOUNT_LOCK_ADMINISTRATION } from '../auth/application/public/account-lock-administration';
import type { AccountLockAdministration } from '../auth/application/public/account-lock-administration';
import { ManageAccountLockUseCase } from './application/use-cases/manage-account-lock.use-case';
import { AdminAccountsController } from './presentation/http/admin-accounts.controller';

@Module({
  imports: [AuthModule],
  controllers: [AdminAccountsController],
  providers: [
    {
      provide: ManageAccountLockUseCase,
      useFactory: (accountLocks: AccountLockAdministration) =>
        new ManageAccountLockUseCase(accountLocks),
      inject: [ACCOUNT_LOCK_ADMINISTRATION],
    },
  ],
})
export class AdminModule {}
