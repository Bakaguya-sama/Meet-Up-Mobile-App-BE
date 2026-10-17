import type { ApiResponseSchemaHost } from '@nestjs/swagger';

type SchemaObject = ApiResponseSchemaHost['schema'];

const uuid: SchemaObject = { type: 'string', format: 'uuid' };
const date: SchemaObject = { type: 'string', format: 'date-time' };
const nullableDate: SchemaObject = { ...date, nullable: true };
export const inviteParticipantsSchema: SchemaObject = {
  type: 'object',
  required: ['inviteeIds'],
  additionalProperties: false,
  properties: {
    inviteeIds: {
      type: 'array',
      minItems: 1,
      uniqueItems: true,
      items: uuid,
      description:
        'Active accepted friends. No product limit on participant count.',
    },
  },
};
export const updateMeetupSchema: SchemaObject = {
  type: 'object',
  additionalProperties: false,
  minProperties: 1,
  properties: {
    title: { type: 'string', minLength: 1, maxLength: 150 },
    description: { type: 'string', maxLength: 1000, nullable: true },
    scheduledAt: {
      ...date,
      description: 'Future time; explicit UTC offset required.',
    },
    invitationDeadlineAt: {
      ...date,
      description:
        'Future time at or before scheduledAt; explicit UTC offset required.',
    },
    searchRadiusM: { type: 'integer', minimum: 100, maximum: 50000 },
    placeType: {
      type: 'string',
      pattern: '^[a-z][a-z0-9_]{0,99}$',
      example: 'cafe',
    },
    recommendationMode: {
      type: 'string',
      enum: ['balanced'],
      description: 'Organizer only, before finalization.',
    },
  },
};
export const createMeetupSchema: SchemaObject = {
  ...updateMeetupSchema,
  required: [
    'title',
    'scheduledAt',
    'invitationDeadlineAt',
    'searchRadiusM',
    'placeType',
    'inviteeIds',
  ],
  properties: {
    ...updateMeetupSchema.properties,
    ...inviteParticipantsSchema.properties,
  },
};
export const meetupSummarySchema: SchemaObject = {
  type: 'object',
  properties: {
    ...updateMeetupSchema.properties,
    id: uuid,
    organizerId: uuid,
    status: {
      type: 'string',
      enum: [
        'draft',
        'inviting',
        'choosing',
        'selected',
        'cancelled',
        'finished',
      ],
    },
    createdAt: date,
    updatedAt: date,
    cancelledAt: nullableDate,
    finishedAt: nullableDate,
  },
};
export const meetupDetailSchema: SchemaObject = {
  ...meetupSummarySchema,
  properties: {
    ...meetupSummarySchema.properties,
    participants: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          id: uuid,
          userId: uuid,
          invitedById: uuid,
          status: {
            type: 'string',
            enum: ['invited', 'accepted', 'declined', 'left', 'removed'],
          },
          respondedAt: nullableDate,
          joinedAt: nullableDate,
          leftAt: nullableDate,
        },
      },
    },
  },
};
export const meetupPageSchema: SchemaObject = {
  type: 'object',
  properties: {
    items: { type: 'array', items: meetupSummarySchema },
    total: { type: 'integer' },
    offset: { type: 'integer' },
    limit: { type: 'integer' },
  },
};

export const setMeetupPreferencesBodySchema: SchemaObject = {
  type: 'object',
  required: ['preferences'],
  additionalProperties: false,
  properties: {
    preferences: {
      type: 'array',
      minItems: 1,
      items: {
        type: 'object',
        required: ['activityTagId', 'level'],
        properties: {
          activityTagId: { type: 'integer', minimum: 1 },
          level: { type: 'string', enum: ['high', 'normal', 'avoid'] },
        },
      },
      description:
        'Temporary preferences for this meetup. Overrides profile preferences.',
    },
  },
};

export const meetupMemberPreferenceTagSchema: SchemaObject = {
  type: 'object',
  properties: {
    activityTagId: { type: 'integer' },
    tagCode: { type: 'string' },
    displayName: { type: 'string' },
    level: { type: 'string', enum: ['high', 'normal', 'avoid'] },
    source: {
      type: 'string',
      enum: ['meetup_input', 'profile_fallback'],
      description:
        'meetup_input if chosen for this meetup; profile_fallback if inherited from profile',
    },
    updatedAt: nullableDate,
  },
};

export const meetupMemberPreferenceSchema: SchemaObject = {
  type: 'object',
  properties: {
    meetupId: uuid,
    participantId: uuid,
    userId: uuid,
    hasExplicitMeetupPreference: { type: 'boolean' },
    tags: {
      type: 'array',
      items: meetupMemberPreferenceTagSchema,
    },
  },
};

export const meetupPreferencesSummarySchema: SchemaObject = {
  type: 'object',
  properties: {
    meetupId: uuid,
    totalParticipants: { type: 'integer' },
    submittedCount: {
      type: 'integer',
      description:
        'Number of participants who explicitly chose meetup preferences',
    },
    fallbackCount: {
      type: 'integer',
      description: 'Number of participants using profile fallback preferences',
    },
    participants: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          participantId: uuid,
          userId: uuid,
          status: {
            type: 'string',
            enum: ['invited', 'accepted', 'declined', 'left', 'removed'],
          },
          hasExplicitMeetupPreference: { type: 'boolean' },
          source: {
            type: 'string',
            enum: ['meetup_input', 'profile_fallback'],
          },
          tags: {
            type: 'array',
            items: meetupMemberPreferenceTagSchema,
          },
        },
      },
    },
  },
};
