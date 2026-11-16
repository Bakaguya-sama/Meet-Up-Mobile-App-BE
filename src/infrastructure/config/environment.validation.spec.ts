import { validateEnvironment } from './environment.validation';

describe('validateEnvironment', () => {
  it('allows infrastructure URLs to be absent in tests', () => {
    const environment = validateEnvironment({ NODE_ENV: 'test' });

    expect(environment.NODE_ENV).toBe('test');
    expect(environment.REDIS_URL).toBe('redis://localhost:6379');
    expect(environment.NEARBY_RADIUS_METERS).toBe(3000);
    expect(environment.AI_EXPLANATION_PROMPT_VERSION).toBe('v1');
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
});
