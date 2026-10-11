import { UserPreference } from './user-preference.aggregate';
import { AuthError } from '../errors/auth.error';

describe('UserPreference Aggregate Root', () => {
  const createPreference = () =>
    new UserPreference({
      id: '22222222-2222-2222-2222-222222222222',
      userId: '11111111-1111-1111-1111-111111111111',
      updatedAt: new Date('2026-01-01'),
      tags: [],
    });

  it('updates preference tags with valid levels', () => {
    const pref = createPreference();
    const now = new Date('2026-02-01');

    pref.updateTags(
      [
        {
          activityTagId: 1,
          level: 'high',
          tagCode: 'food',
          displayName: 'Ăn uống',
        },
        {
          activityTagId: 2,
          level: 'avoid',
          tagCode: 'coffee',
          displayName: 'Cà phê',
        },
      ],
      now,
    );

    const snapshot = pref.snapshot();
    expect(snapshot.tags).toHaveLength(2);
    expect(snapshot.tags[0].activityTagId).toBe(1);
    expect(snapshot.tags[0].level).toBe('high');
    expect(snapshot.tags[1].activityTagId).toBe(2);
    expect(snapshot.tags[1].level).toBe('avoid');
    expect(snapshot.updatedAt).toEqual(now);
  });

  it('throws AuthError when duplicate tag ids are provided', () => {
    const pref = createPreference();

    expect(() =>
      pref.updateTags(
        [
          { activityTagId: 1, level: 'high' },
          { activityTagId: 1, level: 'normal' },
        ],
        new Date(),
      ),
    ).toThrow(AuthError);
  });

  it('throws AuthError when invalid level is provided', () => {
    const pref = createPreference();

    expect(() =>
      pref.updateTags(
        [{ activityTagId: 1, level: 'extreme' as unknown as 'high' }],
        new Date(),
      ),
    ).toThrow(AuthError);
  });
});
