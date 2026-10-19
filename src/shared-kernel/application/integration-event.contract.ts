export const INTEGRATION_EVENT_NAMES = [
  'MeetupCreated.v1',
  'MeetupUpdated.v1',
  'MeetupCancelled.v1',
  'MeetupFinished.v1',
  'MeetupMemberChanged.v1',
  'PreferenceUpdated.v1',
  'LocationUpdated.v1',
  'RecommendationReady.v1',
  'VoteUpdated.v1',
  'MeetupFinalized.v1',
] as const;

export type IntegrationEventName = (typeof INTEGRATION_EVENT_NAMES)[number];

type EventMetadata<TName extends IntegrationEventName> = {
  eventId: string;
  eventName: TName;
  occurredAt: string;
};

export type MeetupMemberChangedV1 = EventMetadata<'MeetupMemberChanged.v1'> & {
  meetupId: string;
  userId: string;
  membershipStatus: string;
};

export type MeetupCreatedV1 = EventMetadata<'MeetupCreated.v1'> & {
  meetupId: string;
  organizerId: string;
  inviteeIds: string[];
};

export type MeetupLifecycleV1 = EventMetadata<
  'MeetupUpdated.v1' | 'MeetupCancelled.v1' | 'MeetupFinished.v1'
> & {
  meetupId: string;
};

export type PreferenceUpdatedV1 = EventMetadata<'PreferenceUpdated.v1'> & {
  meetupId: string;
  participantId: string;
};

/** Location is already projected for its viewer; exact coordinates never enter this contract. */
export type LocationUpdatedV1 = EventMetadata<'LocationUpdated.v1'> & {
  ownerId: string;
  meetupId?: string;
  location: { visibility: 'exact' | 'approximate' | 'hidden' };
};

export type RecommendationReadyV1 = EventMetadata<'RecommendationReady.v1'> & {
  meetupId: string;
  runId: string;
  placeIds: string[];
  strategy: 'exact' | 'batched' | 'clustered';
};

export type VoteUpdatedV1 = EventMetadata<'VoteUpdated.v1'> & {
  meetupId: string;
  placeId: string;
  voteCount: number;
};

export type MeetupFinalizedV1 = EventMetadata<'MeetupFinalized.v1'> & {
  meetupId: string;
  placeId: string;
  scheduledAt: string;
};

export type IntegrationEvent =
  | MeetupCreatedV1
  | MeetupLifecycleV1
  | MeetupMemberChangedV1
  | PreferenceUpdatedV1
  | LocationUpdatedV1
  | RecommendationReadyV1
  | VoteUpdatedV1
  | MeetupFinalizedV1;

export const EVENT_ERROR_CODES = {
  UNAUTHORIZED: 'UNAUTHORIZED',
  FORBIDDEN: 'FORBIDDEN',
  MEETUP_NOT_FOUND: 'MEETUP_NOT_FOUND',
  MEETUP_INACTIVE: 'MEETUP_INACTIVE',
  INVALID_EVENT_PAYLOAD: 'INVALID_EVENT_PAYLOAD',
  EVENT_SCHEMA_INVALID: 'EVENT_SCHEMA_INVALID',
  EVENT_ALREADY_PROCESSED: 'EVENT_ALREADY_PROCESSED',
  OUTBOX_DELIVERY_FAILED: 'OUTBOX_DELIVERY_FAILED',
} as const;

export type EventErrorCode =
  (typeof EVENT_ERROR_CODES)[keyof typeof EVENT_ERROR_CODES];

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const FORBIDDEN_SENSITIVE_KEYS = new Set([
  'latitude',
  'longitude',
  'lat',
  'lng',
  'token',
]);

export function isIntegrationEvent(value: unknown): value is IntegrationEvent {
  if (
    !isRecord(value) ||
    !hasValidMetadata(value) ||
    containsSensitiveKey(value)
  ) {
    return false;
  }

  switch (value.eventName) {
    case 'MeetupCreated.v1':
      return (
        hasStrings(value, 'meetupId', 'organizerId') &&
        Array.isArray(value.inviteeIds) &&
        value.inviteeIds.length > 0 &&
        value.inviteeIds.every(
          (id) => typeof id === 'string' && UUID_PATTERN.test(id),
        )
      );
    case 'MeetupUpdated.v1':
    case 'MeetupCancelled.v1':
    case 'MeetupFinished.v1':
      return hasStrings(value, 'meetupId');
    case 'MeetupMemberChanged.v1':
      return hasStrings(value, 'meetupId', 'userId', 'membershipStatus');
    case 'PreferenceUpdated.v1':
      return hasStrings(value, 'meetupId', 'participantId');
    case 'LocationUpdated.v1':
      return (
        hasStrings(value, 'ownerId') &&
        (value.meetupId === undefined || typeof value.meetupId === 'string') &&
        isRecord(value.location) &&
        ['exact', 'approximate', 'hidden'].includes(
          String(value.location.visibility),
        )
      );
    case 'RecommendationReady.v1':
      return (
        hasStrings(value, 'meetupId', 'runId', 'strategy') &&
        Array.isArray(value.placeIds) &&
        value.placeIds.every((id) => typeof id === 'string')
      );
    case 'VoteUpdated.v1':
      return (
        hasStrings(value, 'meetupId', 'placeId') &&
        typeof value.voteCount === 'number' &&
        Number.isFinite(value.voteCount)
      );
    case 'MeetupFinalized.v1':
      return hasStrings(value, 'meetupId', 'placeId', 'scheduledAt');
  }

  return false;
}

function hasValidMetadata(value: Record<string, unknown>): boolean {
  return (
    typeof value.eventId === 'string' &&
    UUID_PATTERN.test(value.eventId) &&
    typeof value.eventName === 'string' &&
    INTEGRATION_EVENT_NAMES.includes(value.eventName as IntegrationEventName) &&
    typeof value.occurredAt === 'string' &&
    !Number.isNaN(Date.parse(value.occurredAt))
  );
}

function hasStrings(
  value: Record<string, unknown>,
  ...keys: string[]
): boolean {
  return keys.every(
    (key) => typeof value[key] === 'string' && value[key].length > 0,
  );
}

function containsSensitiveKey(value: unknown): boolean {
  if (Array.isArray(value)) {
    return value.some(containsSensitiveKey);
  }
  if (!isRecord(value)) {
    return false;
  }
  return Object.entries(value).some(
    ([key, child]) =>
      FORBIDDEN_SENSITIVE_KEYS.has(key.toLowerCase()) ||
      key.toLowerCase().includes('token') ||
      containsSensitiveKey(child),
  );
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
