import type { ApiResponseSchemaHost } from '@nestjs/swagger';
import { setMeetupPreferencesBodySchema } from './meetups.openapi';

type SchemaObject = ApiResponseSchemaHost['schema'];

const preference: SchemaObject = {
  type: 'object',
  required: ['activityTagId', 'level'],
  additionalProperties: false,
  properties: {
    activityTagId: { type: 'integer', minimum: 1 },
    level: { type: 'string', enum: ['high', 'normal', 'avoid'] },
  },
};
export const preferenceSuggestionRequestSchema: SchemaObject = {
  type: 'object',
  additionalProperties: false,
  description:
    'Text or audio, never both. Continue using the server suggestionId/revision. Client conversation history is not accepted. skipBudget requires a session and no message/audio.',
  properties: {
    message: { type: 'string', maxLength: 2000 },
    suggestionId: { type: 'string', format: 'uuid' },
    revision: { type: 'integer', minimum: 0 },
    skipBudget: { type: 'boolean' },
    audioBase64: {
      type: 'string',
      maxLength: 2800000,
      description:
        'At most 2 MB decoded and 60 seconds; send with audioMimeType. Unmeasurable duration is rejected.',
    },
    audioMimeType: {
      type: 'string',
      enum: [
        'audio/wav',
        'audio/mp3',
        'audio/mpeg',
        'audio/ogg',
        'audio/webm',
        'audio/flac',
        'audio/aac',
        'audio/m4a',
      ],
    },
  },
};
export const preferenceSuggestionResponseSchema: SchemaObject = {
  type: 'object',
  required: [
    'schemaVersion',
    'suggestionId',
    'revision',
    'mode',
    'readyToConfirm',
    'saved',
    'preferences',
    'effectivePreferences',
    'budgetVnd',
    'budgetAction',
    'replyText',
    'expiresAt',
    'availableTags',
    'clarification',
  ],
  properties: {
    schemaVersion: { type: 'integer', enum: [2] },
    suggestionId: { type: 'string', format: 'uuid' },
    revision: { type: 'integer' },
    expiresAt: { type: 'string', format: 'date-time' },
    mode: {
      type: 'string',
      enum: ['proposal', 'clarification', 'manual_fallback'],
    },
    readyToConfirm: { type: 'boolean' },
    saved: { type: 'boolean', enum: [false] },
    replyText: { type: 'string' },
    preferences: {
      type: 'array',
      items: preference,
      description:
        'Complete explicit meetup selection. [] preserves profile fallback when sent through PUT.',
    },
    effectivePreferences: {
      type: 'array',
      items: preference,
      description:
        'Selections to display, including profile fallback if applicable.',
    },
    budgetVnd: {
      type: 'integer',
      nullable: true,
      minimum: 0,
      maximum: 2147483647,
    },
    budgetAction: { type: 'string', enum: ['keep', 'set', 'clear'] },
    clarification: {
      type: 'string',
      enum: ['none', 'activity', 'budget', 'budget_scope', 'unsupported'],
    },
    transcript: {
      type: 'string',
      maxLength: 2000,
      description:
        'Transient transcript for correction; never stored by the app backend.',
    },
    fallbackReason: {
      type: 'string',
      description: 'Safe reason code, without provider details.',
    },
    availableTags: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          activityTagId: { type: 'integer' },
          tagCode: { type: 'string' },
          displayName: { type: 'string' },
        },
      },
    },
    confirmation: {
      ...setMeetupPreferencesBodySchema,
      description:
        'Present only for proposal. Display/edit before explicit user confirmation and PUT. Omitted budget means preserve.',
    },
  },
};
