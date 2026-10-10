import { applyDecorators } from '@nestjs/common';
import { ApiQuery } from '@nestjs/swagger';

const uuid = { type: 'string' as const, format: 'uuid' };
const timestamp = { type: 'string' as const, format: 'date-time' };
export const friendshipSchema = {
  type: 'object' as const,
  required: [
    'id',
    'userAId',
    'userBId',
    'requestedById',
    'status',
    'requestedAt',
    'respondedAt',
    'updatedAt',
  ],
  properties: {
    id: uuid,
    userAId: uuid,
    userBId: uuid,
    requestedById: uuid,
    status: {
      type: 'string' as const,
      enum: ['pending', 'accepted', 'rejected', 'blocked'],
    },
    requestedAt: timestamp,
    respondedAt: { ...timestamp, nullable: true },
    updatedAt: timestamp,
  },
};
const userSchema = {
  type: 'object' as const,
  required: ['id', 'displayName', 'avatarUrl'],
  properties: {
    id: uuid,
    displayName: { type: 'string' as const },
    avatarUrl: { type: 'string' as const, nullable: true },
  },
};
const pageProperties = {
  total: { type: 'integer' as const },
  offset: { type: 'integer' as const },
  limit: { type: 'integer' as const },
};
export const searchPageSchema = {
  type: 'object' as const,
  required: ['items', 'total', 'offset', 'limit'],
  properties: {
    ...pageProperties,
    items: {
      type: 'array' as const,
      items: {
        ...userSchema,
        required: [...userSchema.required, 'friendship'],
        properties: {
          ...userSchema.properties,
          friendship: { ...friendshipSchema, nullable: true },
        },
      },
    },
  },
};
export const friendshipPageSchema = {
  type: 'object' as const,
  required: ['items', 'total', 'offset', 'limit'],
  properties: {
    ...pageProperties,
    items: {
      type: 'array' as const,
      items: {
        ...friendshipSchema,
        required: [...friendshipSchema.required, 'user'],
        properties: {
          ...friendshipSchema.properties,
          user: { ...userSchema, nullable: true },
        },
      },
    },
  },
};
export const sendFriendRequestSchema = {
  type: 'object' as const,
  required: ['recipientId'],
  properties: { recipientId: uuid },
};

export function ApiFriendPage() {
  return applyDecorators(
    ApiQuery({
      name: 'offset',
      required: false,
      schema: { type: 'integer', minimum: 0, maximum: 100000, default: 0 },
    }),
    ApiQuery({
      name: 'limit',
      required: false,
      schema: { type: 'integer', minimum: 1, maximum: 50, default: 20 },
    }),
  );
}
