import { TypeOrmProfilePreferenceReader } from './profile-preference-reader.adapter';

describe('TypeOrmProfilePreferenceReader', () => {
  it('returns only saved, active profile tags rather than synthetic normal tags', async () => {
    const store = {
      accounts: {
        findAccountById: jest
          .fn()
          .mockResolvedValue({ assertCanAuthenticate: jest.fn() }),
      },
      preferences: {
        findByUserId: jest.fn().mockResolvedValue({
          getId: () => 'p',
          getUpdatedAt: () => new Date(0),
          getTags: () => [
            { activityTagId: 1, level: 'high' },
            { activityTagId: 3, level: 'avoid' },
          ],
        }),
        findActiveActivityTags: jest.fn().mockResolvedValue([
          { id: 1, code: 'cafe', displayName: 'Cafe' },
          { id: 2, code: 'bar', displayName: 'Bar' },
        ]),
      },
    };
    const uow = { run: (fn: (value: typeof store) => unknown) => fn(store) };
    const reader = new TypeOrmProfilePreferenceReader(
      uow as never,
      {} as never,
    );
    const result = await reader.getPreference('user');
    expect(result.tags).toEqual([
      { activityTagId: 1, tagCode: 'cafe', displayName: 'Cafe', level: 'high' },
    ]);
  });
});
