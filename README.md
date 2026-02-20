# habidat-auth

User management and identity provider for habidat groupware.

## Architecture

This is a monorepo containing:

- `apps/web` - Next.js 15 web application
- `apps/worker` - BullMQ worker for background jobs (coming soon)
- `packages/db` - Prisma database schema and client
- `packages/env` - Environment variable validation
- `packages/typescript-config` - Shared TypeScript configurations

## Prerequisites

- Node.js 20+
- pnpm 9+
- Docker & Docker Compose

## Getting Started

### 1. Install dependencies

```bash
pnpm install
```

### 2. Copy environment file

```bash
cp .env.example .env
```

### 3. Start infrastructure services

```bash
docker compose -f docker/docker-compose.yml up -d
```

This starts:
- PostgreSQL (port 5432)
- Redis (port 6379)
- OpenLDAP (port 389)
- Mailhog (ports 1025, 8025)

### 4. Generate Prisma client and run migrations

```bash
pnpm db:generate
pnpm db:push
```

### 5. Start development server

```bash
pnpm dev:web
```

Open [http://localhost:3000](http://localhost:3000)

### Development with Docker (full stack)

To run the whole dev environment in Docker (useful for connecting from other apps on the same host or network):

```bash
# Ensure .env exists with at least SESSION_SECRET and BETTER_AUTH_SECRET
cp .env.example .env

pnpm dev:docker
```

This starts PostgreSQL, Redis, Mailhog, the web app and the worker in one go. The app is at [http://localhost:3000](http://localhost:3000); Mailhog at [http://localhost:8025](http://localhost:8025). The schema is pushed to the DB on first start. The worker needs `LDAP_*` (and optionally `DISCOURSE_*`) in `.env`; SMTP is set to Mailhog automatically. Rebuild the image when you change dependencies (`docker compose -f docker/docker-compose.dev.yml up --build`).

## Scripts

| Command | Description |
|---------|-------------|
| `pnpm dev` | Start all apps in development mode |
| `pnpm dev:web` | Start web app only |
| `pnpm dev:docker` | Run full dev stack in Docker (db, redis, mailhog, web) |
| `pnpm build` | Build all packages and apps |
| `pnpm typecheck` | Run TypeScript type checking |
| `pnpm lint` | Run Biome linter |
| `pnpm lint:fix` | Fix lint issues |
| `pnpm db:generate` | Generate Prisma client |
| `pnpm db:migrate` | Run database migrations |
| `pnpm db:push` | Push schema to database |
| `pnpm db:studio` | Open Prisma Studio |

## Tech Stack

- **Framework**: Next.js 16 (App Router)
- **Language**: TypeScript
- **Database**: PostgreSQL + Prisma
- **Auth**: better-auth
- **UI**: Tailwind CSS + shadcn/ui
- **State**: TanStack Query
- **Forms**: react-hook-form + zod
- **Queue**: BullMQ + Redis
- **Linting**: Biome

## License

MIT
