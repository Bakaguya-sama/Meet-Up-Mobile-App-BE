import { Inject } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import {
  ConnectedSocket,
  MessageBody,
  OnGatewayConnection,
  OnGatewayDisconnect,
  OnGatewayInit,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
  WsException,
} from '@nestjs/websockets';
import type { DefaultEventsMap, Server, Socket } from 'socket.io';
import {
  ACCESS_TOKEN_VALIDATOR,
  type AccessTokenValidator,
} from '../../../../shared-kernel/application/access-token-validator.port';
import type { AuthenticatedUser } from '../../../../shared-kernel/application/authenticated-user';
import {
  PRESENCE,
  type PresencePort,
} from '../../../../shared-kernel/application/presence.port';
import { realtimeRooms } from '../../../../shared-kernel/application/realtime-publisher.port';
import type { AccessTokenClaims } from '../../../../shared-kernel/application/token-claims';
import { isTokenClaims } from '../../../../infrastructure/jwt/jwt-tokens.service';
import { RealtimePublisherAdapter } from '../../../../infrastructure/realtime/realtime-publisher.adapter';
import {
  MEETUP_LOCATION_ACCESS,
  type MeetupLocationAccessPort,
} from '../../application/ports/location-access.port';
import { GetLatestLocationQuery } from '../../application/queries/get-latest-location.query';
import { PublishLocationUseCase } from '../../application/use-cases/publish-location.use-case';
import { LocationAccessError } from '../../domain/location-visibility';

type SocketData = { user?: AuthenticatedUser };
type SocketWithUser = Socket<
  DefaultEventsMap,
  DefaultEventsMap,
  DefaultEventsMap,
  SocketData
>;
type JoinMeetupMessage = { meetupId: string };
type LocationUpdateMessage = {
  latitude: number;
  longitude: number;
  accuracy: number;
  recordedAt: string;
  meetupId?: string;
};

@WebSocketGateway({ namespace: '/realtime' })
export class LocationGateway
  implements OnGatewayInit, OnGatewayConnection, OnGatewayDisconnect
{
  @WebSocketServer()
  private server!: Server<
    DefaultEventsMap,
    DefaultEventsMap,
    DefaultEventsMap,
    SocketData
  >;

  constructor(
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
    @Inject(ACCESS_TOKEN_VALIDATOR)
    private readonly accessTokenValidator: AccessTokenValidator,
    @Inject(PRESENCE) private readonly presence: PresencePort,
    @Inject(MEETUP_LOCATION_ACCESS)
    private readonly meetups: MeetupLocationAccessPort,
    private readonly publishLocation: PublishLocationUseCase,
    private readonly getLatestLocation: GetLatestLocationQuery,
    private readonly realtimePublisher: RealtimePublisherAdapter,
  ) {}

  afterInit(
    server: Server<
      DefaultEventsMap,
      DefaultEventsMap,
      DefaultEventsMap,
      SocketData
    >,
  ): void {
    this.realtimePublisher.bindServer(server);
    server.use((socket, next) => {
      void this.authenticate(socket)
        .then((user) => {
          if (!user) return next(new Error('UNAUTHORIZED'));
          socket.data.user = user;
          return next();
        })
        .catch(() => next(new Error('UNAUTHORIZED')));
    });
  }

  async handleConnection(client: SocketWithUser): Promise<void> {
    const user = client.data.user;
    if (!user) {
      client.disconnect(true);
      return;
    }
    await client.join(realtimeRooms.user(user.id));
    await this.presence.connect(user.id, client.id);
  }

  async handleDisconnect(client: SocketWithUser): Promise<void> {
    const user = client.data.user;
    if (user) await this.presence.disconnect(user.id, client.id);
  }

  @SubscribeMessage('presence:heartbeat')
  async heartbeat(@ConnectedSocket() client: SocketWithUser) {
    const user = this.requireUser(client);
    await this.presence.refresh(user.id, client.id);
    return { ok: true };
  }

  @SubscribeMessage('meetup:join')
  async joinMeetup(
    @ConnectedSocket() client: SocketWithUser,
    @MessageBody() message: unknown,
  ) {
    const user = this.requireUser(client);
    if (!isJoinMeetupMessage(message)) throw forbidden('INVALID_EVENT_PAYLOAD');
    if (!(await this.meetups.canJoin(user.id, message.meetupId))) {
      throw forbidden('FORBIDDEN');
    }
    await client.join(realtimeRooms.meetup(message.meetupId));
    await this.presence.refresh(user.id, client.id);
    return { meetupId: message.meetupId, joined: true };
  }

  @SubscribeMessage('location:update')
  async updateLocation(
    @ConnectedSocket() client: SocketWithUser,
    @MessageBody() message: unknown,
  ) {
    const user = this.requireUser(client);
    if (!isLocationUpdateMessage(message)) {
      throw forbidden('INVALID_EVENT_PAYLOAD');
    }
    if (
      message.meetupId &&
      !client.rooms.has(realtimeRooms.meetup(message.meetupId))
    ) {
      throw forbidden('FORBIDDEN');
    }
    await this.presence.refresh(user.id, client.id);

    try {
      await this.publishLocation.execute({ ...message, ownerId: user.id });
      if (message.meetupId) {
        await this.publishProjectedLocation(user.id, message.meetupId);
      }
      return { accepted: true };
    } catch (error) {
      if (error instanceof LocationAccessError) throw forbidden('FORBIDDEN');
      throw forbidden('INVALID_EVENT_PAYLOAD');
    }
  }

  private async publishProjectedLocation(
    ownerId: string,
    meetupId: string,
  ): Promise<void> {
    const recipients = await this.server
      .in(realtimeRooms.meetup(meetupId))
      .fetchSockets();
    await Promise.all(
      recipients.map(async (recipient) => {
        const viewer = recipient.data.user;
        if (!viewer) return;
        try {
          const location = await this.getLatestLocation.execute({
            ownerId,
            viewerId: viewer.id,
            scope: 'meetup',
            meetupId,
          });
          if (location) {
            recipient.emit('location:updated', { ownerId, meetupId, location });
          }
        } catch {
          // A privacy or membership change races with delivery; silently skip this viewer.
        }
      }),
    );
  }

  private async authenticate(
    client: SocketWithUser,
  ): Promise<AuthenticatedUser | null> {
    const token = extractToken(client);
    if (!token) return null;
    try {
      const claims: unknown = await this.jwt.verifyAsync(token, {
        secret: this.config.getOrThrow<string>('auth.accessSecret'),
        algorithms: ['HS256'],
        issuer: this.config.getOrThrow<string>('auth.issuer'),
        audience: this.config.getOrThrow<string>('auth.audience'),
      });
      if (!isTokenClaims(claims, 'access')) return null;
      return this.accessTokenValidator.execute(claims as AccessTokenClaims);
    } catch {
      return null;
    }
  }

  private requireUser(client: SocketWithUser): AuthenticatedUser {
    if (!client.data.user) throw forbidden('UNAUTHORIZED');
    return client.data.user;
  }
}

function extractToken(client: SocketWithUser): string | null {
  const authToken = tokenFromHandshakeAuth(client.handshake.auth);
  if (typeof authToken === 'string' && authToken.length > 0) return authToken;
  const authorization = client.handshake.headers.authorization;
  if (typeof authorization !== 'string') return null;
  const match = /^Bearer\s+(.+)$/i.exec(authorization);
  return match?.[1] ?? null;
}

function tokenFromHandshakeAuth(value: unknown): string | null {
  if (!isRecord(value)) return null;
  const token = value.token;
  return typeof token === 'string' && token.length > 0 ? token : null;
}

function isJoinMeetupMessage(value: unknown): value is JoinMeetupMessage {
  return (
    typeof value === 'object' &&
    value !== null &&
    typeof (value as JoinMeetupMessage).meetupId === 'string' &&
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
      (value as JoinMeetupMessage).meetupId,
    )
  );
}

function isLocationUpdateMessage(
  value: unknown,
): value is LocationUpdateMessage {
  if (typeof value !== 'object' || value === null) return false;
  const message = value as Partial<LocationUpdateMessage>;
  return (
    typeof message.latitude === 'number' &&
    typeof message.longitude === 'number' &&
    typeof message.accuracy === 'number' &&
    typeof message.recordedAt === 'string' &&
    (message.meetupId === undefined || typeof message.meetupId === 'string')
  );
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function forbidden(code: string): WsException {
  return new WsException({ code });
}
