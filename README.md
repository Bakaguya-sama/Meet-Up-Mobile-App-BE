# MeetUp Backend

NestJS 11 modular monolith for the MeetUp mobile application. Business code is organized by bounded context and follows the dependency direction `presentation -> application -> domain` described in `docs/08_huong_dan_cau_truc_ddd.md`.

## Prerequisites

- Node.js 22 or newer LTS
- Docker with Compose (for local Redis)
- A personal Neon PostgreSQL branch with PostGIS support

## Local setup

```powershell
npm install
Copy-Item .env.example .env
docker compose up -d redis
npm run migration:run
npm run start:dev
```

Fill `DATABASE_URL` with the pooled Neon connection and `DATABASE_DIRECT_URL` with the direct connection before running the app or migrations. Secrets and `.env` files must not be committed.

The REST API is served below `/api/v1`; Swagger is available at `/docs` by default. Set `SWAGGER_ENABLED=false` to disable it.

## Offline PostgreSQL

Neon is the default development database. For offline work or isolated integration tests, start the optional PostGIS profile:

```bash
docker compose --profile offline up -d postgres redis
```

Use `postgresql://meetup:meetup@localhost:5432/meetup` for both database URLs in that mode.

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
