import Joi from 'joi';

const environmentSchema = Joi.object({
  NODE_ENV: Joi.string()
    .valid('development', 'test', 'staging', 'production')
    .default('development'),
  PORT: Joi.number().port().default(3000),
  API_PREFIX: Joi.string().default('api/v1'),
  SWAGGER_ENABLED: Joi.boolean().truthy('true').falsy('false').default(true),
  PUBLIC_APP_BASE_URL: Joi.when('NODE_ENV', {
    is: 'test',
    then: Joi.string().allow('').optional(),
    otherwise: Joi.string()
      .uri({ scheme: ['https'] })
      .required(),
  }),
  JWT_ACCESS_SECRET: Joi.string()
    .min(32)
    .invalid('replace-with-a-long-random-secret')
    .when('NODE_ENV', {
      is: 'test',
      then: Joi.optional(),
      otherwise: Joi.required(),
    }),
  JWT_REFRESH_SECRET: Joi.string()
    .min(32)
    .invalid(
      Joi.ref('JWT_ACCESS_SECRET'),
      'replace-with-a-different-long-random-secret',
    )
    .when('NODE_ENV', {
      is: 'test',
      then: Joi.optional(),
      otherwise: Joi.required(),
    }),
  JWT_ACCESS_TTL_SECONDS: Joi.number().integer().min(60).max(3600).default(900),
  JWT_REFRESH_TTL_SECONDS: Joi.number()
    .integer()
    .min(3600)
    .max(7776000)
    .default(2592000),
  JWT_ISSUER: Joi.string().default('meetup-api'),
  JWT_AUDIENCE: Joi.string().default('meetup-mobile'),
  GOOGLE_CLIENT_ID: Joi.when('NODE_ENV', {
    is: 'test',
    then: Joi.string().allow('').optional(),
    otherwise: Joi.string().min(1).required(),
  }),
  GOOGLE_CLIENT_SECRET: Joi.when('NODE_ENV', {
    is: 'test',
    then: Joi.string().allow('').optional(),
    otherwise: Joi.string().min(1).required(),
  }),
  GOOGLE_CALLBACK_URL: Joi.when('NODE_ENV', {
    is: 'test',
    then: Joi.string().allow('').optional(),
    otherwise: Joi.string().uri().required(),
  }),
  DATABASE_URL: Joi.when('NODE_ENV', {
    is: 'test',
    then: Joi.string().allow('').optional(),
    otherwise: Joi.string()
      .uri({ scheme: ['postgresql', 'postgres'] })
      .required(),
  }),
  DATABASE_DIRECT_URL: Joi.string()
    .uri({ scheme: ['postgresql', 'postgres'] })
    .allow('')
    .optional(),
  REDIS_URL: Joi.string()
    .uri({ scheme: ['redis', 'rediss'] })
    .default('redis://localhost:6379'),
  FRIEND_QR_SESSION_TTL_SECONDS: Joi.when('NODE_ENV', {
    is: 'test',
    then: Joi.number().integer().min(60).max(86400).optional(),
    otherwise: Joi.number().integer().min(60).max(86400).required(),
  }),
  MEETUP_INVITE_RATE_LIMIT: Joi.when('NODE_ENV', {
    is: 'test',
    then: Joi.number().integer().min(1).max(100000).optional(),
    otherwise: Joi.number().integer().min(1).max(100000).required(),
  }),
  FRIEND_QR_RATE_LIMIT: Joi.when('NODE_ENV', {
    is: 'test',
    then: Joi.number().integer().min(1).max(100000).optional(),
    otherwise: Joi.number().integer().min(1).max(100000).required(),
  }),
  GOOGLE_MAPS_API_KEY: Joi.string().allow('').optional(),
  AI_EXPLANATION_ENABLED: Joi.boolean()
    .truthy('true')
    .falsy('false')
    .default(false),
  MEETUP_PREFERENCE_AI_ENABLED: Joi.boolean()
    .truthy('true')
    .falsy('false')
    .default(false),
  GEMINI_API_KEY: Joi.when('AI_EXPLANATION_ENABLED', {
    is: true,
    then: Joi.string().min(1).required(),
    otherwise: Joi.when('MEETUP_PREFERENCE_AI_ENABLED', {
      is: true,
      then: Joi.string().min(1).required(),
      otherwise: Joi.string().allow('').optional(),
    }),
  }),
  MEETUP_PREFERENCE_AI_MODEL: Joi.string()
    .pattern(/^[a-zA-Z0-9._-]+$/)
    .max(100)
    .default('gemini-2.5-flash-lite'),
  MEETUP_PREFERENCE_AI_TIMEOUT_MS: Joi.number()
    .integer()
    .min(1000)
    .max(15000)
    .default(8000),
  MEETUP_PREFERENCE_AI_SESSION_TTL_SECONDS: Joi.number()
    .integer()
    .min(60)
    .max(1800)
    .default(900),
  MEETUP_PREFERENCE_AI_REQUESTS_PER_MINUTE: Joi.number()
    .integer()
    .min(1)
    .max(30)
    .default(6),
  MEETUP_PREFERENCE_AI_REQUESTS_PER_DAY: Joi.number()
    .integer()
    .min(1)
    .max(1000)
    .default(60),
  AI_EXPLANATION_PROMPT_VERSION: Joi.string().valid('v1').default('v1'),
  NEARBY_RADIUS_METERS: Joi.number()
    .integer()
    .min(100)
    .max(50000)
    .default(3000),
  ROUTES_ROUTING_PREFERENCE: Joi.string()
    .valid('TRAFFIC_UNAWARE', 'TRAFFIC_AWARE')
    .default('TRAFFIC_UNAWARE'),
  RECOMMENDATION_RETENTION_ENABLED: Joi.boolean()
    .truthy('true')
    .falsy('false')
    .default(false),
  FIREBASE_ENABLED: Joi.boolean().truthy('true').falsy('false').default(false),
  FIREBASE_PROJECT_ID: Joi.when('FIREBASE_ENABLED', {
    is: true,
    then: Joi.string().min(1).required(),
    otherwise: Joi.string().allow('').optional(),
  }),
  FIREBASE_CLIENT_EMAIL: Joi.when('FIREBASE_ENABLED', {
    is: true,
    then: Joi.string().email().required(),
    otherwise: Joi.string().allow('').optional(),
  }),
  FIREBASE_PRIVATE_KEY: Joi.when('FIREBASE_ENABLED', {
    is: true,
    then: Joi.string().min(1).required(),
    otherwise: Joi.string().allow('').optional(),
  }),
  CLOUDINARY_ENABLED: Joi.boolean()
    .truthy('true')
    .falsy('false')
    .default(false),
  CLOUDINARY_CLOUD_NAME: Joi.when('CLOUDINARY_ENABLED', {
    is: true,
    then: Joi.string().min(1).required(),
    otherwise: Joi.string().allow('').optional(),
  }),
  CLOUDINARY_API_KEY: Joi.when('CLOUDINARY_ENABLED', {
    is: true,
    then: Joi.string().min(1).required(),
    otherwise: Joi.string().allow('').optional(),
  }),
  CLOUDINARY_API_SECRET: Joi.when('CLOUDINARY_ENABLED', {
    is: true,
    then: Joi.string().min(1).required(),
    otherwise: Joi.string().allow('').optional(),
  }),
  FILE_STORAGE_ROOT_FOLDER: Joi.string()
    .trim()
    .pattern(/^[A-Za-z0-9][A-Za-z0-9/_-]*$/)
    .max(180)
    .default('mobile-meetup'),
  CHAT_MEDIA_FOLDER: Joi.string()
    .trim()
    .pattern(/^[A-Za-z0-9][A-Za-z0-9/_-]*$/)
    .max(180)
    .default('chat'),
  DEVICE_TOKEN_ENCRYPTION_KEY: Joi.when('NODE_ENV', {
    is: 'test',
    then: Joi.string().allow('').optional(),
    otherwise: Joi.string().base64().required(),
  }),
}).unknown(true);

export function validateEnvironment(
  environment: Record<string, unknown>,
): Record<string, unknown> {
  const result = environmentSchema.validate(environment, {
    abortEarly: false,
  }) as Joi.ValidationResult<Record<string, unknown>>;

  if (result.error) {
    throw new Error(`Environment validation failed: ${result.error.message}`);
  }

  return result.value;
}
