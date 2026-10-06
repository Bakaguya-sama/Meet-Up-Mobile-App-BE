import { validateEnvironment } from './environment.validation';

describe('validateEnvironment', () => {
  it('allows infrastructure URLs to be absent in tests', () => {
    const environment = validateEnvironment({ NODE_ENV: 'test' });

    expect(environment.NODE_ENV).toBe('test');
    expect(environment.REDIS_URL).toBe('redis://localhost:6379');
  });

  it('requires a PostgreSQL URL outside tests', () => {
    expect(() => validateEnvironment({ NODE_ENV: 'development' })).toThrow(
      'DATABASE_URL',
    );
  });
});
