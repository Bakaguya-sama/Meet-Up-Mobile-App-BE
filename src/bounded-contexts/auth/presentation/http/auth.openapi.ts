const userProfileSchema = {
  type: 'object' as const,
  required: ['id', 'email', 'displayName', 'avatarUrl'],
  properties: {
    id: { type: 'string' as const, format: 'uuid' },
    email: { type: 'string' as const, format: 'email' },
    displayName: { type: 'string' as const },
    avatarUrl: { type: 'string' as const, nullable: true },
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

export { userProfileSchema };

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
