import { WsException } from '@nestjs/websockets';
import { LocationGateway } from './location.gateway';

const user = {
  id: '4e0f9f54-6f06-453d-bc0c-4e63fe80cf13',
  email: 'user@example.com',
  displayName: 'User',
  avatarUrl: null,
  sessionId: '7bfc82cb-a0fa-488c-9ed4-870e7393ba15',
  roles: ['user'] as const,
};
const meetupId = '6c0d662b-6b77-489e-88e5-e574334f8c6b';

describe('LocationGateway', () => {
  let presence: {
    connect: jest.Mock;
    refresh: jest.Mock;
    disconnect: jest.Mock;
  };
  let meetups: { canJoin: jest.Mock };
  let publishLocation: { execute: jest.Mock };
  let getLatestLocation: { execute: jest.Mock };
  let gateway: LocationGateway;

  beforeEach(() => {
    presence = {
      connect: jest.fn().mockResolvedValue(undefined),
      refresh: jest.fn().mockResolvedValue(undefined),
      disconnect: jest.fn().mockResolvedValue(undefined),
    };
    meetups = { canJoin: jest.fn().mockResolvedValue(true) };
    publishLocation = {
      execute: jest.fn().mockResolvedValue({ accepted: true }),
    };
    getLatestLocation = { execute: jest.fn() };
    gateway = new LocationGateway(
      { verifyAsync: jest.fn() } as never,
      { getOrThrow: jest.fn() } as never,
      { execute: jest.fn() },
      presence as never,
      meetups as never,
      publishLocation as never,
      getLatestLocation as never,
      { bindServer: jest.fn() } as never,
    );
  });

  it('rejects a Socket handshake that has no access token', async () => {
    const middleware = installHandshakeMiddleware(gateway);
    const next = jest.fn();

    middleware({ handshake: { auth: {}, headers: {} }, data: {} }, next);
    await waitForAsyncHandler();

    expect(next).toHaveBeenCalledWith(
      expect.objectContaining({ message: 'UNAUTHORIZED' }),
    );
  });

  it('rejects a Socket handshake with an invalid access token', async () => {
    const jwt = {
      verifyAsync: jest.fn().mockRejectedValue(new Error('invalid')),
    };
    gateway = new LocationGateway(
      jwt as never,
      { getOrThrow: jest.fn() } as never,
      { execute: jest.fn() },
      presence as never,
      meetups as never,
      publishLocation as never,
      getLatestLocation as never,
      { bindServer: jest.fn() } as never,
    );
    const middleware = installHandshakeMiddleware(gateway);
    const next = jest.fn();

    middleware(
      {
        handshake: { auth: { token: 'invalid-token' }, headers: {} },
        data: {},
      },
      next,
    );
    await waitForAsyncHandler();

    expect(next).toHaveBeenCalledWith(
      expect.objectContaining({ message: 'UNAUTHORIZED' }),
    );
  });

  it('denies a non-member before adding the socket to a meetup room', async () => {
    meetups.canJoin.mockResolvedValue(false);
    const client = socketFor(user);

    await expect(
      gateway.joinMeetup(client as never, { meetupId }),
    ).rejects.toBeInstanceOf(WsException);
    expect(client.join).not.toHaveBeenCalled();
  });

  it('projects the same update separately for every connected meetup viewer', async () => {
    const owner = socketFor(user, meetupId);
    const viewerA = remoteSocketFor({
      ...user,
      id: 'a86c2e79-4453-4b5f-81ee-3532265b4a73',
    });
    const viewerB = remoteSocketFor({
      ...user,
      id: 'cd2ed2c4-0dc2-4d55-a6a2-5a23e6125670',
    });
    getLatestLocation.execute
      .mockResolvedValueOnce({
        latitude: 10.77,
        longitude: 106.7,
        isApproximate: false,
      })
      .mockResolvedValueOnce({
        latitude: 10.78,
        longitude: 106.7,
        isApproximate: true,
      });
    (gateway as unknown as { server: unknown }).server = {
      in: jest.fn(() => ({
        fetchSockets: jest.fn().mockResolvedValue([viewerA, viewerB]),
      })),
    };

    await gateway.updateLocation(owner as never, {
      latitude: 10.776923,
      longitude: 106.700947,
      accuracy: 12,
      recordedAt: '2026-10-13T00:00:00.000Z',
      meetupId,
    });

    expect(getLatestLocation.execute).toHaveBeenCalledTimes(2);
    expect(viewerA.emit).toHaveBeenCalledWith('location:updated', {
      ownerId: user.id,
      meetupId,
      location: { latitude: 10.77, longitude: 106.7, isApproximate: false },
    });
    expect(viewerB.emit).toHaveBeenCalledWith('location:updated', {
      ownerId: user.id,
      meetupId,
      location: { latitude: 10.78, longitude: 106.7, isApproximate: true },
    });
  });

  it('skips a connected viewer whose privacy is revoked before delivery', async () => {
    const owner = socketFor(user, meetupId);
    const viewer = remoteSocketFor({
      ...user,
      id: 'a86c2e79-4453-4b5f-81ee-3532265b4a73',
    });
    getLatestLocation.execute.mockRejectedValue(new Error('privacy revoked'));
    (gateway as unknown as { server: unknown }).server = {
      in: jest.fn(() => ({
        fetchSockets: jest.fn().mockResolvedValue([viewer]),
      })),
    };

    await gateway.updateLocation(owner as never, {
      latitude: 10.776923,
      longitude: 106.700947,
      accuracy: 12,
      recordedAt: '2026-10-13T00:00:00.000Z',
      meetupId,
    });

    expect(viewer.emit).not.toHaveBeenCalled();
  });
});

function socketFor(authenticatedUser: typeof user, roomId?: string) {
  return {
    id: 'socket-owner',
    data: { user: authenticatedUser },
    rooms: new Set(['socket-owner', ...(roomId ? [`meetup:${roomId}`] : [])]),
    handshake: { auth: {}, headers: {} },
    join: jest.fn().mockResolvedValue(undefined),
    disconnect: jest.fn(),
  };
}

function remoteSocketFor(authenticatedUser: typeof user) {
  return { data: { user: authenticatedUser }, emit: jest.fn() };
}

function installHandshakeMiddleware(gateway: LocationGateway) {
  type Middleware = (socket: object, next: (error?: Error) => void) => void;
  const use = jest.fn<void, [Middleware]>();
  gateway.afterInit({ use } as never);
  const [middleware] = use.mock.calls[0] ?? [];
  if (!middleware) throw new Error('Socket middleware was not installed');
  return middleware;
}

async function waitForAsyncHandler(): Promise<void> {
  await new Promise<void>((resolve) => setImmediate(resolve));
}
