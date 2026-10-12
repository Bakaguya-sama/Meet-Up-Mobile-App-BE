import Joi from 'joi';

const environmentSchema = Joi.object({
  NODE_ENV: Joi.string()
    .valid('development', 'test', 'staging', 'production')
    .default('development'),
  PORT: Joi.number().port().default(3000),
  API_PREFIX: Joi.string().default('api/v1'),
  SWAGGER_ENABLED: Joi.boolean().truthy('true').falsy('false').default(true),
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
