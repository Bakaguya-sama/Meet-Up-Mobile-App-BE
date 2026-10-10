export const userProfileSchema = {
  type: 'object' as const,
  required: ['id', 'email', 'displayName', 'avatarUrl'],
  properties: {
    id: { type: 'string' as const, format: 'uuid' },
    email: { type: 'string' as const, format: 'email' },
    displayName: { type: 'string' as const },
    avatarUrl: { type: 'string' as const, nullable: true },
    preferences: {
      type: 'object' as const,
      nullable: true,
      properties: {
        id: { type: 'string' as const, format: 'uuid', nullable: true },
        userId: { type: 'string' as const, format: 'uuid' },
        updatedAt: {
          type: 'string' as const,
          format: 'date-time',
          nullable: true,
        },
        tags: {
          type: 'array' as const,
          items: {
            type: 'object' as const,
            properties: {
              activityTagId: { type: 'number' as const },
              tagCode: { type: 'string' as const },
              displayName: { type: 'string' as const },
              level: {
                type: 'string' as const,
                enum: ['high', 'normal', 'avoid'],
              },
            },
          },
        },
      },
    },
  },
};

export const authResultSchema = {
  type: 'object' as const,
  required: [
    'accessToken',
    'refreshToken',
    'tokenType',
    'expiresIn',
    'refreshExpiresIn',
    'user',
  ],
  properties: {
    accessToken: { type: 'string' as const },
    refreshToken: { type: 'string' as const },
    tokenType: { type: 'string' as const, example: 'Bearer' },
    expiresIn: { type: 'number' as const, example: 900 },
    refreshExpiresIn: { type: 'number' as const, example: 2592000 },
    user: userProfileSchema,
  },
};

const credentials = {
  email: { type: 'string' as const, format: 'email', maxLength: 255 },
  password: {
    type: 'string' as const,
    format: 'password',
    minLength: 8,
    maxLength: 128,
  },
  deviceName: { type: 'string' as const, minLength: 1, maxLength: 150 },
};

export const loginBodySchema = {
  type: 'object' as const,
  required: ['email', 'password'],
  properties: credentials,
};

export const registerBodySchema = {
  type: 'object' as const,
  required: ['email', 'password', 'displayName'],
  properties: {
    ...credentials,
    displayName: { type: 'string' as const, minLength: 1, maxLength: 100 },
  },
};

export const refreshTokenBodySchema = {
  type: 'object' as const,
  required: ['refreshToken'],
  properties: {
    refreshToken: { type: 'string' as const, minLength: 1, maxLength: 4096 },
  },
};

export const preferenceTagItemSchema = {
  type: 'object' as const,
  required: ['level'],
  properties: {
    activityTagId: { type: 'number' as const, example: 1 },
    tagCode: { type: 'string' as const, example: 'food' },
    level: {
      type: 'string' as const,
      enum: ['high', 'normal', 'avoid'],
      example: 'high',
    },
  },
};

export const updateProfileBodySchema = {
  type: 'object' as const,
  properties: {
    displayName: {
      type: 'string' as const,
      minLength: 1,
      maxLength: 100,
      example: 'Huy Vu',
    },
    avatarUrl: {
      type: 'string' as const,
      maxLength: 1000,
      nullable: true,
      example: 'https://example.com/avatar.png',
    },
    preferences: {
      type: 'array' as const,
      items: preferenceTagItemSchema,
    },
  },
};

export const saveUserPreferenceBodySchema = {
  type: 'object' as const,
  required: ['tags'],
  properties: {
    tags: {
      type: 'array' as const,
      items: preferenceTagItemSchema,
    },
  },
};

export const userPreferenceSchema = {
  type: 'object' as const,
  required: ['userId', 'tags'],
  properties: {
    id: { type: 'string' as const, format: 'uuid', nullable: true },
    userId: { type: 'string' as const, format: 'uuid' },
    updatedAt: { type: 'string' as const, format: 'date-time', nullable: true },
    tags: {
      type: 'array' as const,
      items: {
        type: 'object' as const,
        required: ['activityTagId', 'tagCode', 'displayName', 'level'],
        properties: {
          activityTagId: { type: 'number' as const, example: 1 },
          tagCode: { type: 'string' as const, example: 'food' },
          displayName: { type: 'string' as const, example: 'Ăn uống' },
          level: {
            type: 'string' as const,
            enum: ['high', 'normal', 'avoid'],
            example: 'high',
          },
        },
      },
    },
  },
};

export const activityTagSchema = {
  type: 'object' as const,
  required: ['id', 'code', 'displayName', 'isActive'],
  properties: {
    id: { type: 'number' as const, example: 1 },
    code: { type: 'string' as const, example: 'food' },
    displayName: { type: 'string' as const, example: 'Ăn uống' },
    isActive: { type: 'boolean' as const, example: true },
  },
};

export const activityTagsSchema = {
  type: 'array' as const,
  items: activityTagSchema,
};
