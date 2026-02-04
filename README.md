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

## Scripts

| Command | Description |
|---------|-------------|
| `pnpm dev` | Start all apps in development mode |
| `pnpm dev:web` | Start web app only |
| `pnpm build` | Build all packages and apps |
| `pnpm typecheck` | Run TypeScript type checking |
| `pnpm lint` | Run Biome linter |
| `pnpm lint:fix` | Fix lint issues |
| `pnpm db:generate` | Generate Prisma client |
| `pnpm db:migrate` | Run database migrations |
| `pnpm db:push` | Push schema to database |
| `pnpm db:studio` | Open Prisma Studio |

## Tech Stack

- **Framework**: Next.js 15 (App Router)
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
