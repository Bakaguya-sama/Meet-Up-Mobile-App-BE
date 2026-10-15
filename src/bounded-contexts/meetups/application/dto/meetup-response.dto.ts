import type {
  MeetupState,
  ParticipantState,
} from '../../domain/aggregates/meetup.aggregate';

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
    ...state,
    respondedAt: state.respondedAt?.toISOString() ?? null,
    joinedAt: state.joinedAt?.toISOString() ?? null,
    leftAt: state.leftAt?.toISOString() ?? null,
  };
}
