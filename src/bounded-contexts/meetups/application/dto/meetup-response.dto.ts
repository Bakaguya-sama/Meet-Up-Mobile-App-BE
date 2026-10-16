import type {
  MeetupState,
  ParticipantState,
  ParticipantStatus,
  PreferenceLevel,
  PreferenceSource,
} from '../../domain/aggregates/meetup.aggregate';

export interface MeetupMemberPreferenceTagDto {
  activityTagId: number;
  tagCode: string;
  displayName: string;
  level: PreferenceLevel;
  source: PreferenceSource;
  updatedAt: string | null;
}

export interface MeetupMemberPreferenceResponseDto {
  meetupId: string;
  participantId: string;
  userId: string;
  hasExplicitMeetupPreference: boolean;
  tags: MeetupMemberPreferenceTagDto[];
}

export interface ParticipantPreferenceSummaryItemDto {
  participantId: string;
  userId: string;
  status: ParticipantStatus;
  hasExplicitMeetupPreference: boolean;
  source: PreferenceSource;
  tags: MeetupMemberPreferenceTagDto[];
}

export interface MeetupPreferencesSummaryResponseDto {
  meetupId: string;
  totalParticipants: number;
  submittedCount: number;
  fallbackCount: number;
  participants: ParticipantPreferenceSummaryItemDto[];
}

export function toMeetupSummary(state: Omit<MeetupState, 'participants'>) {
  return {
    id: state.id,
    organizerId: state.organizerId,
    title: state.title,
    description: state.description,
    scheduledAt: state.scheduledAt.toISOString(),
    invitationDeadlineAt: state.invitationDeadlineAt.toISOString(),
    searchRadiusM: state.searchRadiusM,
    placeType: state.placeType,
    recommendationMode: state.recommendationMode,
    status: state.status,
    cancelledAt: state.cancelledAt?.toISOString() ?? null,
    finishedAt: state.finishedAt?.toISOString() ?? null,
    createdAt: state.createdAt.toISOString(),
    updatedAt: state.updatedAt.toISOString(),
  };
}

export function toMeetupDetail(state: MeetupState) {
  return {
    ...toMeetupSummary(state),
    participants: state.participants.map(toParticipant),
  };
}

function toParticipant(state: ParticipantState) {
  return {
    id: state.id,
    userId: state.userId,
    status: state.status,
    invitedById: state.invitedById,
    respondedAt: state.respondedAt?.toISOString() ?? null,
    joinedAt: state.joinedAt?.toISOString() ?? null,
    leftAt: state.leftAt?.toISOString() ?? null,
    preferences: (state.preferences ?? []).map((p) => ({
      activityTagId: p.activityTagId,
      level: p.level,
      source: p.source,
      updatedAt: p.updatedAt.toISOString(),
    })),
  };
}
