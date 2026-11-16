import { validateEnvironment } from './environment.validation';

describe('validateEnvironment', () => {
  it('allows infrastructure URLs to be absent in tests', () => {
    const environment = validateEnvironment({ NODE_ENV: 'test' });

    expect(environment.NODE_ENV).toBe('test');
    expect(environment.REDIS_URL).toBe('redis://localhost:6379');
    expect(environment.NEARBY_RADIUS_METERS).toBe(3000);
    expect(environment.AI_EXPLANATION_PROMPT_VERSION).toBe('v1');
    expect(environment.FILE_STORAGE_ROOT_FOLDER).toBe('mobile-meetup');
    expect(environment.CHAT_MEDIA_FOLDER).toBe('chat');
  });

  it('requires a PostgreSQL URL outside tests', () => {
    expect(() => validateEnvironment({ NODE_ENV: 'development' })).toThrow(
      'DATABASE_URL',
    );
  });

  it('rejects an unsupported routing preference at boot', () => {
    expect(() =>
      validateEnvironment({
        NODE_ENV: 'test',
        ROUTES_ROUTING_PREFERENCE: 'FASTEST',
      }),
    ).toThrow('ROUTES_ROUTING_PREFERENCE');
  });

  it('rejects an unsafe nearby radius and unknown prompt version at boot', () => {
    expect(() =>
      validateEnvironment({ NODE_ENV: 'test', NEARBY_RADIUS_METERS: 99 }),
    ).toThrow('NEARBY_RADIUS_METERS');
    expect(() =>
      validateEnvironment({
        NODE_ENV: 'test',
        AI_EXPLANATION_PROMPT_VERSION: 'unreviewed',
      }),
    ).toThrow('AI_EXPLANATION_PROMPT_VERSION');
  });

  it('rejects a storage root that could escape the configured namespace', () => {
    expect(() =>
      validateEnvironment({
        NODE_ENV: 'test',
        FILE_STORAGE_ROOT_FOLDER: '../other-tenant',
      }),
    ).toThrow('FILE_STORAGE_ROOT_FOLDER');
    expect(() =>
      validateEnvironment({ NODE_ENV: 'test', CHAT_MEDIA_FOLDER: '../chat' }),
    ).toThrow('CHAT_MEDIA_FOLDER');
  });
});
