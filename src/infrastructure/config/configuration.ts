export const configuration = () => ({
  app: {
    nodeEnv: process.env.NODE_ENV ?? 'development',
    port: Number(process.env.PORT ?? 3000),
    apiPrefix: process.env.API_PREFIX ?? 'api/v1',
    swaggerEnabled: process.env.SWAGGER_ENABLED !== 'false',
    publicAppBaseUrl:
      process.env.PUBLIC_APP_BASE_URL ??
      (process.env.NODE_ENV === 'test'
        ? 'https://app.example.invalid'
        : undefined),
  },
  database: {
    url: process.env.DATABASE_URL,
  },
  redis: {
    url: process.env.REDIS_URL ?? 'redis://localhost:6379',
  },
  meetupInvites: {
    rateLimit: Number(process.env.MEETUP_INVITE_RATE_LIMIT),
  },
  friendQr: {
    sessionTtlSeconds: Number(process.env.FRIEND_QR_SESSION_TTL_SECONDS),
    rateLimit: Number(process.env.FRIEND_QR_RATE_LIMIT),
  },
  googleMaps: {
    apiKey: process.env.GOOGLE_MAPS_API_KEY ?? '',
  },
  routes: {
    routingPreference:
      process.env.ROUTES_ROUTING_PREFERENCE ?? 'TRAFFIC_UNAWARE',
  },
  firebase: {
    enabled: process.env.FIREBASE_ENABLED === 'true',
    projectId: process.env.FIREBASE_PROJECT_ID,
    clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
    privateKey: process.env.FIREBASE_PRIVATE_KEY,
  },
  cloudinary: {
    enabled: process.env.CLOUDINARY_ENABLED === 'true',
    cloudName: process.env.CLOUDINARY_CLOUD_NAME,
    apiKey: process.env.CLOUDINARY_API_KEY,
    apiSecret: process.env.CLOUDINARY_API_SECRET,
  },
  deviceTokens: {
    encryptionKey: process.env.DEVICE_TOKEN_ENCRYPTION_KEY,
  },
  auth: {
    accessSecret: process.env.JWT_ACCESS_SECRET,
    refreshSecret: process.env.JWT_REFRESH_SECRET,
    accessTtlSeconds: Number(process.env.JWT_ACCESS_TTL_SECONDS ?? 900),
    refreshTtlSeconds: Number(process.env.JWT_REFRESH_TTL_SECONDS ?? 2592000),
    issuer: process.env.JWT_ISSUER ?? 'meetup-api',
    audience: process.env.JWT_AUDIENCE ?? 'meetup-mobile',
    google: {
      clientID: process.env.GOOGLE_CLIENT_ID,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET,
      callbackURL: process.env.GOOGLE_CALLBACK_URL,
    },
  },
});
