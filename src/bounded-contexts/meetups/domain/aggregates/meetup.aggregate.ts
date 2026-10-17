import { MeetupError } from '../errors/meetup.error';

export const MEETUP_STATUSES = [
  'draft',
  'inviting',
  'choosing',
  'selected',
  'cancelled',
  'finished',
] as const;
export const PARTICIPANT_STATUSES = [
  'invited',
  'accepted',
  'declined',
  'left',
  'removed',
] as const;
export type MeetupStatus = (typeof MEETUP_STATUSES)[number];
export type ParticipantStatus = (typeof PARTICIPANT_STATUSES)[number];
export type RecommendationMode = 'balanced';
export type PreferenceLevel = 'high' | 'normal' | 'avoid';
export type PreferenceSource = 'meetup_input' | 'profile_fallback';

export interface ParticipantPreferenceState {
  activityTagId: number;
  level: PreferenceLevel;
  source: PreferenceSource;
  updatedAt: Date;
}

export interface ParticipantState {
  id: string;
  userId: string;
  status: ParticipantStatus;
  invitedById: string;
  respondedAt: Date | null;
  joinedAt: Date | null;
  leftAt: Date | null;
  preferences?: ParticipantPreferenceState[];
}

export interface MeetupDetails {
  title: string;
  description: string | null;
  scheduledAt: Date;
  invitationDeadlineAt: Date;
  searchRadiusM: number;
  placeType: string;
  recommendationMode: RecommendationMode;
}

export interface MeetupState extends MeetupDetails {
  id: string;
  organizerId: string;
  status: MeetupStatus;
  cancelledAt: Date | null;
  finishedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
  participants: ParticipantState[];
}

export type MeetupEvent = {
  name:
    | 'MeetupCreated'
    | 'MeetupUpdated'
    | 'MeetupCancelled'
    | 'MeetupFinished'
    | 'MeetupMemberChanged'
    | 'PreferenceUpdated';
  meetupId: string;
  occurredAt: Date;
  recipientIds: string[];
  userId?: string;
  membershipStatus?: ParticipantStatus;
  participantId?: string;
};

/** BR-02/07/19, UC-05/06. All participant mutations belong to this aggregate. */
export class Meetup {
  private readonly events: MeetupEvent[] = [];

  private constructor(private readonly state: MeetupState) {}

  static create(
    input: MeetupDetails & {
      id: string;
      organizerId: string;
      organizerParticipantId: string;
      invitees: { id: string; userId: string }[];
    },
    now: Date,
  ): Meetup {
    const details = validateDetails(input, now);
    validateInvitees(
      input.organizerId,
      input.invitees.map((p) => p.userId),
    );
    const meetup = new Meetup({
      ...details,
      id: input.id,
      organizerId: input.organizerId,
      status: 'inviting',
      cancelledAt: null,
      finishedAt: null,
      createdAt: new Date(now),
      updatedAt: new Date(now),
      participants: [
        {
          id: input.organizerParticipantId,
          userId: input.organizerId,
          status: 'accepted',
          invitedById: input.organizerId,
          respondedAt: new Date(now),
          joinedAt: new Date(now),
          leftAt: null,
          preferences: [],
        },
        ...input.invitees.map((p): ParticipantState => ({
          ...p,
          status: 'invited',
          invitedById: input.organizerId,
          respondedAt: null,
          joinedAt: null,
          leftAt: null,
          preferences: [],
        })),
      ],
    });
    meetup.record(
      'MeetupCreated',
      now,
      input.invitees.map((p) => p.userId),
    );
    return meetup;
  }

  static reconstitute(state: MeetupState): Meetup {
    return new Meetup({
      ...structuredClone(state),
      participants: state.participants.map((p) => ({
        ...p,
        preferences: p.preferences
          ? p.preferences.map((pref) => ({ ...pref }))
          : [],
      })),
    });
  }

  snapshot(): MeetupState {
    const state = structuredClone(this.state);
    return {
      ...state,
      participants: state.participants.map((p) => ({
        ...p,
        preferences: p.preferences
          ? p.preferences.map((pref) => ({ ...pref }))
          : [],
      })),
    };
  }
  pendingEvents(): MeetupEvent[] {
    return structuredClone(this.events);
  }

  assertVisible(actorId: string): void {
    if (
      !this.state.participants.some(
        (p) =>
          p.userId === actorId &&
          (p.status === 'accepted' || p.status === 'invited'),
      )
    ) {
      throw new MeetupError('MEETUP_NOT_FOUND', 'Meetup not found');
    }
  }

  assertOrganizer(actorId: string): void {
    this.assertVisible(actorId);
    if (actorId !== this.state.organizerId)
      throw new MeetupError(
        'MEETUP_FORBIDDEN',
        'Only the organizer can perform this action',
      );
  }

  update(actorId: string, patch: Partial<MeetupDetails>, now: Date): void {
    this.assertOrganizer(actorId);
    this.assertEditable();
    const details = validateDetails({ ...this.state, ...patch }, now);
    Object.assign(this.state, details);
    this.record('MeetupUpdated', now);
  }

  assertCanInvite(actorId: string, userIds: string[], now: Date): void {
    this.assertOrganizer(actorId);
    this.assertEditable();
    this.assertInvitationOpen(now);
    validateInvitees(this.state.organizerId, userIds);
    const current = new Map(
      this.state.participants.map((p) => [p.userId, p.status]),
    );
    if (
      userIds.some((id) =>
        ['accepted', 'invited'].includes(current.get(id) ?? ''),
      )
    ) {
      throw new MeetupError(
        'MEETUP_MEMBER_CONFLICT',
        'A user is already invited or participating',
      );
    }
  }

  invite(
    actorId: string,
    invitees: { id: string; userId: string }[],
    now: Date,
  ): void {
    this.assertCanInvite(
      actorId,
      invitees.map((p) => p.userId),
      now,
    );
    const current = new Map(this.state.participants.map((p) => [p.userId, p]));
    for (const invitee of invitees) {
      const previous = current.get(invitee.userId);
      const participant: ParticipantState = {
        id: previous?.id ?? invitee.id,
        userId: invitee.userId,
        status: 'invited',
        invitedById: actorId,
        respondedAt: null,
        joinedAt: null,
        leftAt: null,
      };
      if (previous) Object.assign(previous, participant);
      else this.state.participants.push(participant);
      this.recordMember(participant, now);
    }
  }

  respond(actorId: string, decision: 'accepted' | 'declined', now: Date): void {
    this.assertVisible(actorId);
    this.assertEditable();
    this.assertInvitationOpen(now);
    const participant = this.state.participants.find(
      (p) => p.userId === actorId,
    )!;
    if (participant.status !== 'invited')
      throw new MeetupError(
        'MEETUP_MEMBER_CONFLICT',
        'Only a pending invitation can be answered',
      );
    participant.status = decision;
    participant.respondedAt = new Date(now);
    participant.joinedAt = decision === 'accepted' ? new Date(now) : null;
    this.recordMember(participant, now);
  }

  leave(actorId: string, now: Date): void {
    this.assertVisible(actorId);
    this.assertEditable();
    if (actorId === this.state.organizerId)
      throw new MeetupError(
        'MEETUP_FORBIDDEN',
        'The organizer must cancel instead of leaving',
      );
    const participant = this.state.participants.find(
      (p) => p.userId === actorId,
    )!;
    if (participant.status !== 'accepted')
      throw new MeetupError(
        'MEETUP_MEMBER_CONFLICT',
        'Only an accepted participant can leave',
      );
    participant.status = 'left';
    participant.leftAt = new Date(now);
    this.recordMember(participant, now);
  }

  remove(actorId: string, userId: string, now: Date): void {
    this.assertOrganizer(actorId);
    this.assertEditable();
    if (userId === this.state.organizerId)
      throw new MeetupError(
        'MEETUP_FORBIDDEN',
        'The organizer cannot be removed',
      );
    const participant = this.state.participants.find(
      (p) => p.userId === userId,
    );
    if (!participant || !['invited', 'accepted'].includes(participant.status))
      throw new MeetupError(
        'MEETUP_MEMBER_CONFLICT',
        'Participant is not invited or accepted',
      );
    participant.status = 'removed';
    participant.leftAt = new Date(now);
    this.recordMember(participant, now);
  }

  cancel(actorId: string, now: Date): void {
    this.assertOrganizer(actorId);
    if (['cancelled', 'finished'].includes(this.state.status))
      throw new MeetupError(
        'MEETUP_INVALID_TRANSITION',
        'Meetup is already closed',
      );
    this.state.status = 'cancelled';
    this.state.cancelledAt = new Date(now);
    this.record('MeetupCancelled', now);
  }

  finish(actorId: string, now: Date): void {
    this.assertOrganizer(actorId);
    if (this.state.status !== 'selected' || now < this.state.scheduledAt)
      throw new MeetupError(
        'MEETUP_INVALID_TRANSITION',
        'Only a finalized meetup that has started can finish',
      );
    this.state.status = 'finished';
    this.state.finishedAt = new Date(now);
    this.record('MeetupFinished', now);
  }

  setParticipantPreferences(
    actorId: string,
    items: Array<{ activityTagId: number; level: PreferenceLevel }>,
    now: Date,
  ): void {
    this.assertVisible(actorId);
    this.assertEditable();
    const participant = this.state.participants.find(
      (p) => p.userId === actorId,
    );
    if (!participant) {
      throw new MeetupError('MEETUP_NOT_FOUND', 'Participant not found');
    }
    if (!['invited', 'accepted'].includes(participant.status)) {
      throw new MeetupError(
        'MEETUP_MEMBER_CONFLICT',
        'Only an invited or accepted participant can set preferences',
      );
    }
    validatePreferences(items);
    participant.preferences = items.map((item) => ({
      activityTagId: item.activityTagId,
      level: item.level,
      source: 'meetup_input',
      updatedAt: new Date(now),
    }));
    this.state.updatedAt = new Date(now);
    this.events.push({
      name: 'PreferenceUpdated',
      meetupId: this.state.id,
      participantId: participant.id,
      userId: actorId,
      occurredAt: new Date(now),
      recipientIds: [...new Set([this.state.organizerId, actorId])],
    });
  }

  private assertEditable(): void {
    if (!['inviting', 'choosing'].includes(this.state.status))
      throw new MeetupError(
        'MEETUP_NOT_EDITABLE',
        'Meetup can only be changed before finalization',
      );
  }

  private assertInvitationOpen(now: Date): void {
    if (now >= this.state.invitationDeadlineAt)
      throw new MeetupError(
        'MEETUP_INVITATION_EXPIRED',
        'Invitation deadline has passed',
      );
  }

  private recordMember(participant: ParticipantState, now: Date): void {
    this.state.updatedAt = new Date(now);
    this.events.push({
      name: 'MeetupMemberChanged',
      meetupId: this.state.id,
      userId: participant.userId,
      membershipStatus: participant.status,
      occurredAt: new Date(now),
      recipientIds: [...new Set([this.state.organizerId, participant.userId])],
    });
  }

  private record(
    name: MeetupEvent['name'],
    now: Date,
    recipientIds = this.state.participants
      .filter((p) => ['invited', 'accepted'].includes(p.status))
      .map((p) => p.userId),
  ): void {
    this.state.updatedAt = new Date(now);
    this.events.push({
      name,
      meetupId: this.state.id,
      occurredAt: new Date(now),
      recipientIds,
    });
  }
}

function validateDetails(input: MeetupDetails, now: Date): MeetupDetails {
  if (
    typeof input.title !== 'string' ||
    input.title.trim().length < 1 ||
    input.title.trim().length > 150 ||
    (input.description !== null &&
      (typeof input.description !== 'string' ||
        input.description.length > 1000))
  )
    throw new MeetupError(
      'INVALID_INPUT',
      'Invalid meetup title or description',
    );
  if (
    !Number.isFinite(input.scheduledAt?.getTime()) ||
    !Number.isFinite(input.invitationDeadlineAt?.getTime()) ||
    input.scheduledAt <= now ||
    input.invitationDeadlineAt <= now ||
    input.invitationDeadlineAt > input.scheduledAt
  )
    throw new MeetupError(
      'INVALID_INPUT',
      'Future invitation deadline must be at or before the future scheduled time',
    );
  if (
    !Number.isInteger(input.searchRadiusM) ||
    input.searchRadiusM < 100 ||
    input.searchRadiusM > 50000
  )
    throw new MeetupError(
      'INVALID_INPUT',
      'Search radius must be between 100 and 50000 meters',
    );
  if (
    typeof input.placeType !== 'string' ||
    !/^[a-z][a-z0-9_]{0,99}$/.test(input.placeType)
  )
    throw new MeetupError('INVALID_INPUT', 'Invalid place type');
  if (input.recommendationMode !== 'balanced')
    throw new MeetupError('INVALID_INPUT', 'Unsupported recommendation mode');
  return {
    title: input.title.trim(),
    description: input.description?.trim() ?? null,
    scheduledAt: new Date(input.scheduledAt),
    invitationDeadlineAt: new Date(input.invitationDeadlineAt),
    searchRadiusM: input.searchRadiusM,
    placeType: input.placeType,
    recommendationMode: input.recommendationMode,
  };
}

function validateInvitees(organizerId: string, userIds: string[]): void {
  if (
    !userIds.length ||
    new Set(userIds).size !== userIds.length ||
    userIds.includes(organizerId)
  )
    throw new MeetupError(
      'INVALID_INPUT',
      'Invite at least one distinct user other than the organizer',
    );
}

function validatePreferences(
  items: Array<{ activityTagId: number; level: PreferenceLevel }>,
): void {
  if (!Array.isArray(items) || items.length === 0) {
    throw new MeetupError(
      'INVALID_INPUT',
      'At least one preference tag must be provided',
    );
  }
  const seen = new Set<number>();
  for (const item of items) {
    if (!Number.isInteger(item.activityTagId) || item.activityTagId < 1) {
      throw new MeetupError('INVALID_INPUT', 'Invalid activity tag ID');
    }
    if (seen.has(item.activityTagId)) {
      throw new MeetupError(
        'INVALID_INPUT',
        `Duplicate activity tag ID ${item.activityTagId}`,
      );
    }
    seen.add(item.activityTagId);
    if (!['high', 'normal', 'avoid'].includes(item.level)) {
      throw new MeetupError('INVALID_INPUT', 'Invalid preference level');
    }
  }
}
