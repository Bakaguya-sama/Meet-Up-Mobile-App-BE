import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuthModule } from '../auth/auth.module';
import { FriendsModule } from '../friends/friends.module';
import { MEETUP_STORE } from './application/ports/persistence/meetup-store.port';
import type { MeetupStorePort } from './application/ports/persistence/meetup-store.port';
import { INVITEE_ELIGIBILITY } from './application/ports/invitee-eligibility.port';
import type { InviteeEligibilityPort } from './application/ports/invitee-eligibility.port';
import { MeetupMembershipReader } from './application/public/meetup-membership-reader';
import { GetMeetupDetailQuery } from './application/queries/get-meetup-detail.query';
import { ListMeetupsQuery } from './application/queries/list-meetups.query';
import { CreateMeetupUseCase } from './application/use-cases/create-meetup.use-case';
import { UpdateMeetupUseCase } from './application/use-cases/update-meetup.use-case';
import { InviteParticipantsUseCase } from './application/use-cases/invite-participants.use-case';
import { RespondInvitationUseCase } from './application/use-cases/respond-invitation.use-case';
import { LeaveMeetupUseCase } from './application/use-cases/leave-meetup.use-case';
import { RemoveParticipantUseCase } from './application/use-cases/remove-participant.use-case';
import { CancelMeetupUseCase } from './application/use-cases/cancel-meetup.use-case';
import { FinishMeetupUseCase } from './application/use-cases/finish-meetup.use-case';
import { InviteeEligibilityAdapter } from './infrastructure/adapters/invitee-eligibility.adapter';
import { MeetupEntity } from './infrastructure/persistence/typeorm/entities/meetup.typeorm-entity';
import { ParticipantEntity } from './infrastructure/persistence/typeorm/entities/participant.typeorm-entity';
import { TypeOrmMeetupRepository } from './infrastructure/persistence/typeorm/typeorm-meetup-repository';
import { MeetupsController } from './presentation/http/meetups.controller';

@Module({
  imports: [
    AuthModule,
    FriendsModule,
    TypeOrmModule.forFeature([MeetupEntity, ParticipantEntity]),
  ],
  controllers: [MeetupsController],
  providers: [
    { provide: MEETUP_STORE, useClass: TypeOrmMeetupRepository },
    { provide: INVITEE_ELIGIBILITY, useClass: InviteeEligibilityAdapter },
    ...[CreateMeetupUseCase, InviteParticipantsUseCase].map((useCase) => ({
      provide: useCase,
      useFactory: (
        store: MeetupStorePort,
        eligibility: InviteeEligibilityPort,
      ) => new useCase(store, eligibility),
      inject: [MEETUP_STORE, INVITEE_ELIGIBILITY],
    })),
    ...[
      UpdateMeetupUseCase,
      RespondInvitationUseCase,
      LeaveMeetupUseCase,
      RemoveParticipantUseCase,
      CancelMeetupUseCase,
      FinishMeetupUseCase,
      GetMeetupDetailQuery,
      ListMeetupsQuery,
      MeetupMembershipReader,
    ].map((useCase) => ({
      provide: useCase,
      useFactory: (store: MeetupStorePort) => new useCase(store),
      inject: [MEETUP_STORE],
    })),
  ],
  exports: [MeetupMembershipReader],
})
export class MeetupsModule {}
