import { GetPrivacySettingsUseCase } from './get-privacy-settings.use-case';
import { SavePrivacySettingsUseCase } from './save-privacy-settings.use-case';
import { RemoveSelectedFriendUseCase } from './remove-selected-friend.use-case';
import type { PrivacySettingsStorePort } from '../ports/persistence/privacy-settings-store.port';
import type { UserDirectory } from '../public/user-directory';
import { PrivacySettings } from '../../domain/aggregates/privacy-settings.aggregate';
import type { SavePrivacySettingsRequest } from '../dto/privacy-settings.dto';

describe('Privacy settings use cases', () => {
  let store: jest.Mocked<PrivacySettingsStorePort>;
  let users: jest.Mocked<UserDirectory>;
  let get: GetPrivacySettingsUseCase;
  let save: SavePrivacySettingsUseCase;
  let removeSelected: RemoveSelectedFriendUseCase;
  const input: SavePrivacySettingsRequest = {
    sharingMode: 'friends',
    sharingExpiresAt: null,
    useApproximateLocation: true,
    nearbyFeatureEnabled: false,
    selectedFriendIds: [],
  };

  beforeEach(() => {
    let saved: PrivacySettings | null = null;
    store = {
      findByUserId: jest.fn(() => Promise.resolve(saved)),
      save: jest.fn((settings: PrivacySettings) => {
        saved = settings;
        return Promise.resolve();
      }),
      updateLocked: jest.fn((_: string, change: (settings: PrivacySettings) => void) => {
        if (saved) change(saved);
        return Promise.resolve();
      }),
    };
    users = {
      search: jest.fn(),
      findActiveByIds: jest.fn((ids: string[]) =>
        Promise.resolve(
          ids.map((id) => ({ id, displayName: id, avatarUrl: null })),
        ),
      ),
    };
    get = new GetPrivacySettingsUseCase(store, users);
    save = new SavePrivacySettingsUseCase(store, users, get);
    removeSelected = new RemoveSelectedFriendUseCase(store);
  });

  it('returns disabled defaults without writing a row', async () => {
    expect(await get.execute('owner')).toMatchObject({
      sharingMode: 'off',
      isLocationSharingEnabled: false,
      updatedAt: null,
      selectedFriendIds: [],
    });
    expect(store.save.mock.calls).toHaveLength(0);
  });

  it('replaces settings and reflects revocation on the next read', async () => {
    expect(await save.execute('owner', input)).toMatchObject({
      sharingMode: 'friends',
      isLocationSharingEnabled: true,
      useApproximateLocation: true,
    });
    await save.execute('owner', { ...input, sharingMode: 'off' });
    expect(await get.execute('owner')).toMatchObject({
      isLocationSharingEnabled: false,
    });
  });

  it('does not save a selected audience containing unavailable accounts', async () => {
    users.findActiveByIds.mockResolvedValue([
      { id: 'owner', displayName: 'Owner', avatarUrl: null },
    ]);
    await expect(
      save.execute('owner', {
        ...input,
        sharingMode: 'selected_friends',
        selectedFriendIds: ['viewer'],
      }),
    ).rejects.toMatchObject({ code: 'ACCOUNT_NOT_FOUND' });
    expect(store.save.mock.calls).toHaveLength(0);
  });

  it('hides unavailable accounts from internal consumers and rejects their settings requests', async () => {
    users.findActiveByIds.mockResolvedValue([]);
    expect(await get.read('owner')).toBeNull();
    await expect(get.execute('owner')).rejects.toMatchObject({
      code: 'ACCOUNT_NOT_FOUND',
    });
    await expect(save.execute('owner', input)).rejects.toMatchObject({
      code: 'ACCOUNT_NOT_FOUND',
    });
    expect(store.save.mock.calls).toHaveLength(0);
  });

  it('removes a selected viewer only from the specified owner', async () => {
    await save.execute('owner', {
      ...input,
      sharingMode: 'selected_friends',
      selectedFriendIds: ['viewer'],
    });

    await removeSelected.execute({
      ownerId: 'owner',
      selectedFriendId: 'viewer',
    });

    expect(await get.execute('owner')).toMatchObject({
      sharingMode: 'friends',
      selectedFriendIds: [],
    });
    expect(store.findByUserId).toHaveBeenLastCalledWith('owner');
  });
});
