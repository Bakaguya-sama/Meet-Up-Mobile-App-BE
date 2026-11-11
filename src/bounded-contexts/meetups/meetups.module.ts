import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuthModule } from '../auth/auth.module';
import { FriendsModule } from '../friends/friends.module';
import { RecommendationVotingModule } from '../recommendations/recommendation-voting.module';
import { RecommendationHistoryModule } from '../recommendations/recommendation-history.module';
import { RecommendationHistoryReader } from '../recommendations/application/public/recommendation-history-reader';
import { RecommendationVotingReader } from '../recommendations/application/public/recommendation-voting-reader';
import { MEETUP_STORE } from './application/ports/persistence/meetup-store.port';
import type { MeetupStorePort } from './application/ports/persistence/meetup-store.port';
import { INVITEE_ELIGIBILITY } from './application/ports/invitee-eligibility.port';
import type { InviteeEligibilityPort } from './application/ports/invitee-eligibility.port';
import { PROFILE_PREFERENCE_FALLBACK } from './application/ports/profile-preference-fallback.port';
import type { ProfilePreferenceFallbackPort } from './application/ports/profile-preference-fallback.port';
import { MeetupMembershipReader } from './application/public/meetup-membership-reader';
import { MeetupCandidateSearchReader } from './application/public/meetup-candidate-search-reader';
import { MeetupPreferenceReader } from './application/public/meetup-preference-reader';
import { MeetupScheduleReader } from './application/public/meetup-schedule-reader';
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
import { MEETUP_INVITE_LINK_STORE } from './application/ports/persistence/meetup-invite-link-store.port';
import type { MeetupInviteLinkStorePort } from './application/ports/persistence/meetup-invite-link-store.port';
import { AcceptMeetupInviteLinkUseCase } from './application/use-cases/accept-meetup-invite-link.use-case';
import { CreateMeetupInviteLinkUseCase } from './application/use-cases/create-meetup-invite-link.use-case';
import { PreviewMeetupInviteLinkUseCase } from './application/use-cases/preview-meetup-invite-link.use-case';
import { RevokeMeetupInviteLinkUseCase } from './application/use-cases/revoke-meetup-invite-link.use-case';
import { InviteeEligibilityAdapter } from './infrastructure/adapters/invitee-eligibility.adapter';
import { ProfilePreferenceFallbackAdapter } from './infrastructure/adapters/profile-preference-fallback.adapter';
import { TypeOrmMeetupPreferenceReader } from './infrastructure/adapters/meetup-preference-reader.adapter';
import { MeetupEntity } from './infrastructure/persistence/typeorm/entities/meetup.typeorm-entity';
import { ParticipantEntity } from './infrastructure/persistence/typeorm/entities/participant.typeorm-entity';
import { ParticipantPreferenceEntity } from './infrastructure/persistence/typeorm/entities/participant-preference.typeorm-entity';
import { MeetupInviteLinkEntity } from './infrastructure/persistence/typeorm/entities/meetup-invite-link.typeorm-entity';
import { MeetupVoteEntity } from './infrastructure/persistence/typeorm/entities/meetup-vote.typeorm-entity';
import { MEETUP_VOTING_UNIT_OF_WORK, type MeetupVotingUnitOfWork } from './application/ports/meetup-voting-unit-of-work.port';
import { TypeOrmMeetupVotingUnitOfWork } from './infrastructure/persistence/typeorm/typeorm-meetup-voting-unit-of-work';
import { CastMeetupVoteUseCase } from './application/use-cases/cast-meetup-vote.use-case';
import { FinalizeMeetupUseCase } from './application/use-cases/finalize-meetup.use-case';
import { VoteWinnerDomainService } from './domain/services/vote-winner.domain-service';
import { ListMeetupHistoryQuery } from './application/queries/list-meetup-history.query';
import { TypeOrmMeetupRepository } from './infrastructure/persistence/typeorm/typeorm-meetup-repository';
import { TypeOrmMeetupInviteLinkRepository } from './infrastructure/persistence/typeorm/typeorm-meetup-invite-link.repository';
import { MeetupsController } from './presentation/http/meetups.controller';
import {
  MeetupInviteLinkAcceptController,
  MeetupInviteLinkPreviewController,
  MeetupInviteLinksController,
} from './presentation/http/meetup-invite-links.controller';

@Module({
  imports: [
    AuthModule,
    FriendsModule,
    RecommendationVotingModule,
    RecommendationHistoryModule,
    TypeOrmModule.forFeature([
      MeetupEntity,
      ParticipantEntity,
      ParticipantPreferenceEntity,
      MeetupInviteLinkEntity,
      MeetupVoteEntity,
    ]),
  ],
  controllers: [
    MeetupsController,
    MeetupInviteLinksController,
    MeetupInviteLinkPreviewController,
    MeetupInviteLinkAcceptController,
  ],
  providers: [
    { provide: MEETUP_STORE, useClass: TypeOrmMeetupRepository },
    { provide: MEETUP_VOTING_UNIT_OF_WORK, useClass: TypeOrmMeetupVotingUnitOfWork },
    VoteWinnerDomainService,
    {
      provide: CastMeetupVoteUseCase,
      useFactory: (uow: MeetupVotingUnitOfWork, recommendations: RecommendationVotingReader) =>
        new CastMeetupVoteUseCase(uow, recommendations),
      inject: [MEETUP_VOTING_UNIT_OF_WORK, RecommendationVotingReader],
    },
    {
      provide: FinalizeMeetupUseCase,
      useFactory: (uow: MeetupVotingUnitOfWork, recommendations: RecommendationVotingReader, winner: VoteWinnerDomainService) =>
        new FinalizeMeetupUseCase(uow, recommendations, winner),
      inject: [MEETUP_VOTING_UNIT_OF_WORK, RecommendationVotingReader, VoteWinnerDomainService],
    },
    {
      provide: ListMeetupHistoryQuery,
      useFactory: (
        store: MeetupStorePort,
        places: RecommendationHistoryReader,
      ) => new ListMeetupHistoryQuery(store, places),
      inject: [MEETUP_STORE, RecommendationHistoryReader],
    },
    {
      provide: MEETUP_INVITE_LINK_STORE,
      useClass: TypeOrmMeetupInviteLinkRepository,
    },
    { provide: INVITEE_ELIGIBILITY, useClass: InviteeEligibilityAdapter },
    {
      provide: PROFILE_PREFERENCE_FALLBACK,
      useClass: ProfilePreferenceFallbackAdapter,
    },
    {
      provide: MeetupPreferenceReader,
      useClass: TypeOrmMeetupPreferenceReader,
    },
    {
      provide: CreateMeetupInviteLinkUseCase,
      useFactory: (store: MeetupInviteLinkStorePort, config: ConfigService) =>
        new CreateMeetupInviteLinkUseCase(
          store,
          config.getOrThrow<string>('app.publicAppBaseUrl'),
        ),
      inject: [MEETUP_INVITE_LINK_STORE, ConfigService],
    },
    ...[
      AcceptMeetupInviteLinkUseCase,
      PreviewMeetupInviteLinkUseCase,
      RevokeMeetupInviteLinkUseCase,
    ].map((useCase) => ({
      provide: useCase,
      useFactory: (store: MeetupInviteLinkStorePort) => new useCase(store),
      inject: [MEETUP_INVITE_LINK_STORE],
    })),
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
      MeetupScheduleReader,
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
    MeetupScheduleReader,
  ],
})
export class MeetupsModule {}
