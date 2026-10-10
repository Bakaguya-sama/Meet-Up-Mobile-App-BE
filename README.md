# MeetUp Backend

NestJS 11 modular monolith for the MeetUp mobile application. Business code is organized by bounded context and follows the dependency direction `presentation -> application -> domain` described in `docs/08_huong_dan_cau_truc_ddd.md`.

## Prerequisites

- Node.js 22 or newer LTS
- Docker with Compose (for local Redis)
- A PostgreSQL database with PostGIS support (Neon or the optional local Docker profile below)

## Local setup

```powershell
npm install
Copy-Item .env.example .env
docker compose up -d redis
npm run migration:run
npm run start:dev
```

Configure `DATABASE_URL` and `DATABASE_DIRECT_URL` in your own `.env` before running migrations. For Neon, use the pooled connection for the API and the direct connection for migrations. For local Docker, follow the optional setup below. Copy `.env.example` only when `.env` does not exist. Secrets and `.env` files must not be committed.

Set `JWT_ACCESS_SECRET` and `JWT_REFRESH_SECRET` to different random values of at least 32 characters; example placeholders are rejected.

The REST API is served below `/api/v1`; Swagger is available at `/docs` by default. Set `SWAGGER_ENABLED=false` to disable it.

## Authentication

| Method | Path | Request |
|---|---|---|
| POST | `/api/v1/auth/register` | `email`, `password`, `displayName`, optional `deviceName` |
| POST | `/api/v1/auth/login` | `email`, `password`, optional `deviceName` |
| GET | `/api/v1/auth/me` | `Authorization: Bearer <accessToken>` |
| PATCH | `/api/v1/auth/profile` | Optional `displayName`, `avatarUrl`, `preferences` (`Bearer`) |
| GET | `/api/v1/auth/preferences` | `Authorization: Bearer <accessToken>` |
| PUT | `/api/v1/auth/preferences` | `tags: [{ activityTagId/tagCode, level }]` (`Bearer`) |
| GET | `/api/v1/auth/activity-tags` | Public list of available activity tags |
| POST | `/api/v1/auth/refresh` | `refreshToken` |
| POST | `/api/v1/auth/logout` | `refreshToken` |

Register/login return the user profile and an access/refresh token pair. Passwords require 8–128 characters and are hashed with Argon2id. Locked accounts cannot sign in or access protected endpoints.

On refresh, replace both stored tokens and serialize refresh requests on the client. Reusing an old refresh token revokes that session family; the user must sign in again. Logout revokes the current device's session family.

## Friends (BE-03)

Authenticated APIs support user search, sending/accepting/rejecting friend requests, pending request lists and accepted friends. Apply the new migration with `npm run migration:run` before starting the API. See [BE-03 API and test guide](docs/10_be03_friends_api.md) and the **Friends** group in Swagger for the full contract.

## Optional local PostgreSQL

To use Docker PostgreSQL/PostGIS instead of Neon, start the existing offline profile:

```bash
docker compose --profile offline up -d --wait postgres redis
```

Set both database URLs in your own `.env` to `postgresql://meetup:meetup@localhost:5432/meetup`. This is a local choice; the shared Compose configuration does not need to change. Data persists in the `postgres_data` volume.

## Useful commands

```bash
npm run build
npm run lint
npm test
npm run test:e2e
npm run migration:generate -- --name descriptive-name
npm run migration:run
npm run migration:revert
```

Schema changes are append-only TypeORM migrations. Runtime connections use `DATABASE_URL`; migration commands prefer `DATABASE_DIRECT_URL`.

## Current structure

```text
src/
├── bounded-contexts/       # Added one vertical slice at a time
├── infrastructure/
│   ├── config/
│   ├── database/
│   └── redis/
├── presentation/http/
└── shared-kernel/domain/
```

Do not create empty bounded contexts in advance. Each context should arrive with a real use case, its ports/adapters, and tests.
