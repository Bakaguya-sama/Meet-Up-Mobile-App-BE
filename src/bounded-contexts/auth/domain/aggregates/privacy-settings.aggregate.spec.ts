import {
  PrivacySettings,
  type PrivacySettingsState,
} from './privacy-settings.aggregate';
import { AuthError } from '../errors/auth.error';

const now = new Date('2026-10-10T12:00:00Z');
const base: PrivacySettingsState = {
  id: 'privacy',
  userId: 'owner',
  sharingMode: 'off',
  sharingExpiresAt: null,
  useApproximateLocation: false,
  nearbyFeatureEnabled: false,
  selectedFriendIds: [],
  updatedAt: now,
};

describe('PrivacySettings', () => {
  it('defaults to no sharing; enabling nearby does not enable location sharing', () => {
    const settings = PrivacySettings.configure(
      { ...base, nearbyFeatureEnabled: true },
      now,
    );
    expect(settings.isSharingEnabled(now)).toBe(false);
  });

  it('expires at the exact deadline without requiring a scheduled job', () => {
    const sharingExpiresAt = new Date(now.getTime() + 1000);
    const settings = PrivacySettings.configure(
      { ...base, sharingMode: 'friends', sharingExpiresAt },
      now,
    );
    expect(settings.isSharingEnabled(now)).toBe(true);
    expect(settings.isSharingEnabled(sharingExpiresAt)).toBe(false);
    expect(
      settings.isSharingEnabled(new Date(sharingExpiresAt.getTime() + 1)),
    ).toBe(false);
  });

  it.each([new Date(now.getTime() - 1), now, new Date('invalid')])(
    'rejects past, present or invalid expiry (%s)',
    (sharingExpiresAt) => {
      expect(() =>
        PrivacySettings.configure(
          { ...base, sharingMode: 'friends', sharingExpiresAt },
          now,
        ),
      ).toThrow('Sharing expiry must be in the future');
    },
  );

  it('rejects an expiry when sharing is disabled', () => {
    expect(() =>
      PrivacySettings.configure(
        { ...base, sharingExpiresAt: new Date(now.getTime() + 1000) },
        now,
      ),
    ).toThrow('Disabled sharing must not have an expiry');
  });

  it.each([
    { selectedFriendIds: [] },
    { selectedFriendIds: ['OWNER'] },
    { selectedFriendIds: ['viewer', 'VIEWER'] },
    { selectedFriendIds: Array.from({ length: 101 }, (_, i) => `user-${i}`) },
  ])(
    'rejects empty, self, duplicate or oversized selected audience',
    ({ selectedFriendIds }) => {
      expect(() =>
        PrivacySettings.configure(
          { ...base, sharingMode: 'selected_friends', selectedFriendIds },
          now,
        ),
      ).toThrow(AuthError);
    },
  );

  it('normalizes selections, isolates snapshots and requires the matching mode', () => {
    const settings = PrivacySettings.configure(
      {
        ...base,
        sharingMode: 'selected_friends',
        selectedFriendIds: ['VIEWER'],
      },
      now,
    );
    const snapshot = settings.snapshot();
    snapshot.selectedFriendIds.push('outsider');
    expect(settings.snapshot().selectedFriendIds).toEqual(['viewer']);
    expect(() =>
      PrivacySettings.configure(
        { ...base, sharingMode: 'friends', selectedFriendIds: ['viewer'] },
        now,
      ),
    ).toThrow('Selected friends are required only for selected_friends mode');
  });

  it('removes a selected viewer and applies the empty-audience policy', () => {
    const settings = PrivacySettings.configure(
      {
        ...base,
        sharingMode: 'selected_friends',
        selectedFriendIds: ['VIEWER'],
      },
      now,
    );
    const updatedAt = new Date(now.getTime() + 1000);

    settings.removeSelectedFriend('viewer', updatedAt);

    expect(settings.snapshot()).toMatchObject({
      sharingMode: 'friends',
      selectedFriendIds: [],
      updatedAt,
    });
  });

  it('does not change settings when the viewer is already absent', () => {
    const settings = PrivacySettings.configure(
      { ...base, sharingMode: 'friends' },
      now,
    );

    settings.removeSelectedFriend('viewer', new Date(now.getTime() + 1000));

    expect(settings.snapshot().updatedAt).toEqual(now);
  });
});
