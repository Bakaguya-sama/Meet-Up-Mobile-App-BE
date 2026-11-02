import { ProfilePreferenceFallbackAdapter } from './profile-preference-fallback.adapter';

describe('ProfilePreferenceFallbackAdapter', () => {
  it('propagates profile read failures instead of silently inventing a fallback', async () => {
    const error = new Error('database unavailable');
    const adapter = new ProfilePreferenceFallbackAdapter({
      getPreference: jest.fn().mockRejectedValue(error),
    } as never);
    await expect(adapter.getProfilePreference('user')).rejects.toBe(error);
  });
});
