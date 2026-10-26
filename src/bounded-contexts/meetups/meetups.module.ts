import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuthModule } from '../auth/auth.module';
import { FriendsModule } from '../friends/friends.module';
import { MEETUP_STORE } from './application/ports/persistence/meetup-store.port';
import type { MeetupStorePort } from './application/ports/persistence/meetup-store.port';
import { INVITEE_ELIGIBILITY } from './application/ports/invitee-eligibility.port';
import type { InviteeEligibilityPort } from './application/ports/invitee-eligibility.port';
import { PROFILE_PREFERENCE_FALLBACK } from './application/ports/profile-preference-fallback.port';
import type { ProfilePreferenceFallbackPort } from './application/ports/profile-preference-fallback.port';
import { MeetupMembershipReader } from './application/public/meetup-membership-reader';
import { MeetupCandidateSearchReader } from './application/public/meetup-candidate-search-reader';
import { MeetupPreferenceReader } from './application/public/meetup-preference-reader';
import { GetMeetupDetailQuery } from './application/queries/get-meetup-detail.query';
import { ListMeetupsQuery } from './application/queries/list-meetups.query';
import { GetMeetupPreferencesSummaryQuery } from './application/queries/get-meetup-preferences-summary.query';
import { CreateMeetupUseCase } from './application/use-cases/create-meetup.use-case';
import { UpdateMeetupUseCase } from './application/use-cases/update-meetup.use-case';
import { InviteParticipantsUseCase } from './application/use-cases/invite-participants.use-case';
import { RespondInvitationUseCase } from './application/use-cases/respond-invitation.use-case';
import { LeaveMeetupUseCase } from './application/use-cases/leave-meetup.use-case';
import { RemoveParticipantUseCase } from './application/use-cases/remove-participant.use-case';
import { CancelMeetupUseCase } from './application/use-cases/cancel-meetup.use-case';
import { FinishMeetupUseCase } from './application/use-cases/finish-meetup.use-case';
import { SetMeetupMemberPreferenceUseCase } from './application/use-cases/set-meetup-member-preference.use-case';
import { GetMeetupMemberPreferenceUseCase } from './application/use-cases/get-meetup-member-preference.use-case';
import { InviteeEligibilityAdapter } from './infrastructure/adapters/invitee-eligibility.adapter';
import { ProfilePreferenceFallbackAdapter } from './infrastructure/adapters/profile-preference-fallback.adapter';
import { TypeOrmMeetupPreferenceReader } from './infrastructure/adapters/meetup-preference-reader.adapter';
import { MeetupEntity } from './infrastructure/persistence/typeorm/entities/meetup.typeorm-entity';
import { ParticipantEntity } from './infrastructure/persistence/typeorm/entities/participant.typeorm-entity';
import { ParticipantPreferenceEntity } from './infrastructure/persistence/typeorm/entities/participant-preference.typeorm-entity';
import { TypeOrmMeetupRepository } from './infrastructure/persistence/typeorm/typeorm-meetup-repository';
import { MeetupsController } from './presentation/http/meetups.controller';

@Module({
  imports: [
    AuthModule,
    FriendsModule,
    TypeOrmModule.forFeature([
      MeetupEntity,
      ParticipantEntity,
      ParticipantPreferenceEntity,
    ]),
  ],
  controllers: [MeetupsController],
  providers: [
    { provide: MEETUP_STORE, useClass: TypeOrmMeetupRepository },
    { provide: INVITEE_ELIGIBILITY, useClass: InviteeEligibilityAdapter },
    {
      provide: PROFILE_PREFERENCE_FALLBACK,
      useClass: ProfilePreferenceFallbackAdapter,
    },
    {
      provide: MeetupPreferenceReader,
      useClass: TypeOrmMeetupPreferenceReader,
    },
    ...[CreateMeetupUseCase, InviteParticipantsUseCase].map((useCase) => ({
      provide: useCase,
      useFactory: (
        store: MeetupStorePort,
        eligibility: InviteeEligibilityPort,
      ) => new useCase(store, eligibility),
      inject: [MEETUP_STORE, INVITEE_ELIGIBILITY],
    })),
    ...[
      SetMeetupMemberPreferenceUseCase,
      GetMeetupMemberPreferenceUseCase,
      GetMeetupPreferencesSummaryQuery,
    ].map((useCase) => ({
      provide: useCase,
      useFactory: (
        store: MeetupStorePort,
        fallback: ProfilePreferenceFallbackPort,
      ) => new useCase(store, fallback),
      inject: [MEETUP_STORE, PROFILE_PREFERENCE_FALLBACK],
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
      MeetupCandidateSearchReader,
    ].map((useCase) => ({
      provide: useCase,
      useFactory: (store: MeetupStorePort) => new useCase(store),
      inject: [MEETUP_STORE],
    })),
  ],
  exports: [
    MeetupMembershipReader,
    MeetupPreferenceReader,
    MeetupCandidateSearchReader,
  ],
})
export class MeetupsModule {}
