# habidat-auth Rewrite Specification

> Complete specification for rewriting habidat-auth with a modern Next.js monorepo stack  
> **Key changes**: 
> - PostgreSQL as single source of truth with LDAP/Discourse as sync targets
> - Monorepo with shared packages for code reuse
> - BullMQ workers for reliable background job processing

---

## Table of Contents

1. [Executive Summary](#1-executive-summary)
2. [Architecture Overview](#2-architecture-overview)
3. [Monorepo Structure](#3-monorepo-structure)
4. [Technology Stack](#4-technology-stack)
5. [Shared Packages](#5-shared-packages)
6. [Data Model (Prisma)](#6-data-model-prisma)
7. [Synchronization Architecture (BullMQ)](#7-synchronization-architecture-bullmq)
8. [Authentication System](#8-authentication-system)
9. [Authorization System](#9-authorization-system)
10. [SAML Identity Provider](#10-saml-identity-provider)
11. [User Management](#11-user-management)
12. [Group Management](#12-group-management)
13. [Invitation System](#13-invitation-system)
14. [External Integrations](#14-external-integrations)
15. [App Management](#15-app-management)
16. [Settings & Configuration](#16-settings--configuration)
17. [Audit System](#17-audit-system)
18. [Email System](#18-email-system)
19. [API Design](#19-api-design)
20. [Frontend Architecture](#20-frontend-architecture)
21. [Internationalization](#21-internationalization)
22. [Development & Deployment](#22-development--deployment)
23. [Migration Strategy](#23-migration-strategy)
24. [Implementation Phases](#24-implementation-phases)

---

## 1. Executive Summary

### 1.1 Current State

The existing habidat-auth application uses:
- **LDAP as primary data store** for users and groups
- **SQLite** only for audit logs
- **JSON files** for apps, settings, tokens
- **Express.js + Vue.js 2** architecture
- Direct LDAP authentication via Passport.js

### 1.2 Target State

The rewritten application will use:
- **Monorepo architecture** with pnpm workspaces
- **PostgreSQL as single source of truth** for all data
- **Redis + BullMQ** for reliable job queue processing
- **LDAP as synchronized target** (write-through for legacy app compatibility)
- **Discourse as synchronized target** (event-driven sync)
- **Next.js 15 App Router** with React Server Components
- **Dedicated worker process** for background sync jobs
- **Shared packages** for code reuse between web app and worker
- **better-auth** for modern authentication
- **Prisma ORM** for type-safe database access

### 1.3 Key Architectural Changes

| Aspect | Current | New |
|--------|---------|-----|
| Project Structure | Single app | Monorepo with apps + packages |
| Primary Data Store | LDAP | PostgreSQL |
| LDAP Role | Source of truth | Sync target |
| Background Jobs | None (sync) | BullMQ workers |
| Job Queue | None | Redis |
| Authentication | Passport.js + LDAP bind | better-auth + database |
| Frontend | Vue.js 2 + Vuetify | Next.js + shadcn/ui |
| API | Express REST | Next.js Server Actions + Route Handlers |
| State Management | Vuex | TanStack Query + nuqs |
| Code Sharing | None | Shared packages (@habidat/*) |

### 1.4 Benefits of New Architecture

1. **Single Source of Truth**: All data in PostgreSQL eliminates sync conflicts
2. **Reliable Job Processing**: BullMQ with Redis ensures jobs are never lost
3. **Separation of Concerns**: Web app and workers are independent processes
4. **Code Reuse**: Shared packages eliminate duplication
5. **Scalability**: Workers can scale independently of the web app
6. **Resilience**: Worker failures don't affect the web app
7. **Better Testing**: Shared packages can be tested in isolation
8. **Transactional Integrity**: Database transactions ensure consistency
9. **Modern Stack**: Type-safe, better DX, active ecosystem

---

## 2. Architecture Overview

### 2.1 System Architecture

```
┌─────────────────────────────────────────────────────────────────────────────────────┐
│                                    MONOREPO                                          │
│                                                                                      │
│  ┌─────────────────────────────────┐      ┌─────────────────────────────────────┐  │
│  │      apps/web (Next.js 15)      │      │      apps/worker (BullMQ)           │  │
│  │                                 │      │                                      │  │
│  │  ┌───────────────────────────┐  │      │  ┌────────────────────────────────┐ │  │
│  │  │   React Server Components │  │      │  │     LDAP Sync Processor        │ │  │
│  │  │   (shadcn/ui, TanStack)   │  │      │  └────────────────────────────────┘ │  │
│  │  └───────────────────────────┘  │      │  ┌────────────────────────────────┐ │  │
│  │  ┌───────────────────────────┐  │      │  │   Discourse Sync Processor     │ │  │
│  │  │     Server Actions        │  │      │  └────────────────────────────────┘ │  │
│  │  │   (next-safe-action)      │  │      │  ┌────────────────────────────────┐ │  │
│  │  └───────────────────────────┘  │      │  │      Email Processor           │ │  │
│  │  ┌───────────────────────────┐  │      │  └────────────────────────────────┘ │  │
│  │  │     SAML IdP Routes       │  │      │                                      │  │
│  │  └───────────────────────────┘  │      │  Uses: @habidat/db, @habidat/sync,  │  │
│  │                                 │      │        @habidat/email, @habidat/env  │  │
│  │  Uses: @habidat/db, @habidat/  │      └──────────────────┬──────────────────┘  │
│  │        auth, @habidat/ui, etc. │                         │                      │
│  └──────────────────┬─────────────┘                         │                      │
│                     │                                        │                      │
│  ┌──────────────────┴────────────────────────────────────────┴──────────────────┐  │
│  │                           Shared Packages                                     │  │
│  │  ┌─────────────┐ ┌─────────────┐ ┌─────────────┐ ┌─────────────┐            │  │
│  │  │ @habidat/db │ │@habidat/auth│ │@habidat/sync│ │@habidat/email│            │  │
│  │  │  (Prisma)   │ │(better-auth)│ │  (BullMQ)   │ │ (nodemailer) │            │  │
│  │  └─────────────┘ └─────────────┘ └─────────────┘ └─────────────┘            │  │
│  │  ┌─────────────┐ ┌─────────────┐ ┌─────────────┐ ┌─────────────┐            │  │
│  │  │ @habidat/ui │ │@habidat/env │ │@habidat/ldap│ │@habidat/     │            │  │
│  │  │ (shadcn/ui) │ │   (t3-env)  │ │ (ldapjs)    │ │  discourse   │            │  │
│  │  └─────────────┘ └─────────────┘ └─────────────┘ └─────────────┘            │  │
│  └───────────────────────────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────────────────────────┘
                     │                         │
      ┌──────────────┼──────────────┬──────────┴─────────────┐
      │              │              │                        │
      ▼              ▼              ▼                        ▼
┌──────────┐  ┌──────────┐  ┌──────────┐              ┌──────────┐
│PostgreSQL│  │  Redis   │  │   LDAP   │              │ Discourse│
│          │  │ (BullMQ) │  │  Server  │              │   API    │
└──────────┘  └──────────┘  └──────────┘              └──────────┘
```

### 2.2 Process Communication Flow

```
┌─────────────────┐                    ┌─────────────────┐
│   Web App       │                    │   Worker App    │
│   (Next.js)     │                    │   (BullMQ)      │
└────────┬────────┘                    └────────┬────────┘
         │                                      │
         │  1. User creates/updates entity      │
         │                                      │
         ▼                                      │
┌─────────────────┐                             │
│   PostgreSQL    │◄────────────────────────────┤
│   (write data)  │     3. Worker reads data    │
└────────┬────────┘                             │
         │                                      │
         │  2. Add job to queue                 │
         ▼                                      │
┌─────────────────┐                             │
│     Redis       │────────────────────────────►│
│   (BullMQ)      │     Job notification        │
└─────────────────┘                             │
                                                │
                           4. Process sync      │
                              ┌─────────────────┴─────────────────┐
                              │                                   │
                              ▼                                   ▼
                       ┌──────────┐                        ┌──────────┐
                       │   LDAP   │                        │ Discourse│
                       └──────────┘                        └──────────┘
```

### 2.3 Request Flow (Web App)

```
User Request
     │
     ▼
┌─────────────────┐
│   Middleware    │  ← Authentication check, locale detection
└─────────────────┘
     │
     ▼
┌─────────────────┐
│  Server Action  │  ← Validation (zod), authorization check
│ (next-safe-action)│
└─────────────────┘
     │
     ▼
┌─────────────────┐
│ Data Access     │  ← Database operations (Prisma)
│ (@habidat/db)   │  ← Queue jobs via BullMQ
└─────────────────┘
     │
     ▼
┌─────────────────┐
│  Response +     │  ← Revalidate cache, return result
│  Revalidation   │
└─────────────────┘
```

### 2.4 Job Processing Flow (BullMQ)

```
1. Web App: User creates/updates/deletes entity
     │
     ▼
2. Web App: Write to PostgreSQL (transaction)
     │
     ▼
3. Web App: Add job to BullMQ queue (Redis)
     │
     ▼
4. Worker: Receives job notification
     │
     ▼
5. Worker: Process job
     │
     ├─► LDAP Sync Queue → LDAP Server
     │      └─► On success: Job completed
     │      └─► On failure: Retry with backoff
     │
     ├─► Discourse Sync Queue → Discourse API
     │      └─► On success: Job completed
     │      └─► On failure: Retry with backoff
     │
     └─► Email Queue → SMTP Server
            └─► On success: Job completed
            └─► On failure: Retry with backoff
```

---

## 3. Monorepo Structure

### 3.1 Directory Layout

```
habidat-auth/
├── apps/
│   ├── web/                          # Next.js web application
│   │   ├── app/                      # App Router pages
│   │   ├── components/               # Web-specific components
│   │   ├── lib/                      # Web-specific utilities
│   │   ├── actions/                  # Nextjs Server Actions
│   │   ├── next.config.ts
│   │   ├── tailwind.config.ts
│   │   ├── tsconfig.json
│   │   └── package.json
│   │
│   └── worker/                       # BullMQ worker application
│       ├── src/
│       │   ├── index.ts              # Worker entry point
│       │   ├── processors/           # Job processors
│       │   │   ├── ldap.processor.ts
│       │   │   ├── discourse.processor.ts
│       │   │   └── email.processor.ts
│       │   └── utils/
│       ├── tsconfig.json
│       └── package.json
│
├── packages/
│   ├── db/                           # @habidat/db - Prisma client & schema
│   │   ├── prisma/
│   │   │   ├── schema.prisma
│   │   │   └── migrations/
│   │   ├── src/
│   │   │   ├── index.ts              # Prisma client export
│   │   │   ├── types.ts              # Generated types
│   │   │   └── queries/              # Reusable queries
│   │   ├── tsconfig.json
│   │   └── package.json
│   │
│   ├── auth/                         # @habidat/auth - Authentication
│   │   ├── src/
│   │   │   ├── index.ts              # better-auth config
│   │   │   ├── client.ts             # Auth client
│   │   │   ├── roles.ts              # Role definitions
│   │   │   └── utils.ts              # Auth utilities
│   │   ├── tsconfig.json
│   │   └── package.json
│   │
│   ├── sync/                         # @habidat/sync - BullMQ queues
│   │   ├── src/
│   │   │   ├── index.ts              # Queue exports
│   │   │   ├── queues.ts             # Queue definitions
│   │   │   ├── jobs.ts               # Job type definitions
│   │   │   ├── connection.ts         # Redis connection
│   │   │   └── constants.ts          # Queue names, options
│   │   ├── tsconfig.json
│   │   └── package.json
│   │
│   ├── ldap/                         # @habidat/ldap - LDAP client
│   │   ├── src/
│   │   │   ├── index.ts
│   │   │   ├── client.ts             # LDAP client wrapper
│   │   │   ├── operations.ts         # CRUD operations
│   │   │   └── types.ts
│   │   ├── tsconfig.json
│   │   └── package.json
│   │
│   ├── discourse/                    # @habidat/discourse - Discourse client
│   │   ├── src/
│   │   │   ├── index.ts
│   │   │   ├── client.ts             # API client
│   │   │   ├── users.ts              # User operations
│   │   │   ├── groups.ts             # Group operations
│   │   │   ├── categories.ts         # Category operations
│   │   │   └── types.ts
│   │   ├── tsconfig.json
│   │   └── package.json
│   │
│   ├── email/                        # @habidat/email - Email utilities
│   │   ├── src/
│   │   │   ├── index.ts
│   │   │   ├── client.ts             # Nodemailer transport
│   │   │   ├── templates.ts          # Template rendering
│   │   │   └── types.ts
│   │   ├── tsconfig.json
│   │   └── package.json
│   │
│   ├── env/                          # @habidat/env - Environment config
│   │   ├── src/
│   │   │   ├── index.ts              # Validated env exports
│   │   │   ├── web.ts                # Web-specific env
│   │   │   ├── worker.ts             # Worker-specific env
│   │   │   └── shared.ts             # Shared env vars
│   │   ├── tsconfig.json
│   │   └── package.json
│   │
│   ├── ui/                           # @habidat/ui - Shared UI components
│   │   ├── src/
│   │   │   ├── index.ts
│   │   │   ├── components/           # shadcn/ui components
│   │   │   └── hooks/                # Shared hooks
│   │   ├── tailwind.config.ts        # Shared Tailwind config
│   │   ├── tsconfig.json
│   │   └── package.json
│   │
│   ├── saml/                         # @habidat/saml - SAML IdP
│   │   ├── src/
│   │   │   ├── index.ts
│   │   │   ├── config.ts
│   │   │   ├── metadata.ts
│   │   │   ├── response.ts
│   │   │   └── logout.ts
│   │   ├── tsconfig.json
│   │   └── package.json
│   │
│   └── typescript-config/            # @habidat/typescript-config
│       ├── base.json
│       ├── nextjs.json
│       ├── node.json
│       └── package.json
│
├── docker/
│   ├── docker-compose.yml            # Development compose
│   ├── docker-compose.prod.yml       # Production compose
│   ├── web.Dockerfile
│   └── worker.Dockerfile
│
├── pnpm-workspace.yaml
├── package.json                      # Root package.json
├── turbo.json                        # Turborepo config (optional)
├── biome.json
└── README.md
```

### 3.2 Workspace Configuration

```yaml
# pnpm-workspace.yaml
packages:
  - 'apps/*'
  - 'packages/*'
```

```json
// package.json (root)
{
  "name": "habidat-auth",
  "private": true,
  "scripts": {
    "dev": "pnpm --parallel -r dev",
    "dev:web": "pnpm --filter @habidat/web dev",
    "dev:worker": "pnpm --filter @habidat/worker dev",
    "build": "pnpm -r build",
    "build:web": "pnpm --filter @habidat/web build",
    "build:worker": "pnpm --filter @habidat/worker build",
    "lint": "biome check .",
    "lint:fix": "biome check --write .",
    "format": "biome format --write .",
    "typecheck": "pnpm -r typecheck",
    "db:generate": "pnpm --filter @habidat/db generate",
    "db:migrate": "pnpm --filter @habidat/db migrate",
    "db:push": "pnpm --filter @habidat/db push",
    "db:studio": "pnpm --filter @habidat/db studio"
  },
  "devDependencies": {
    "@biomejs/biome": "^1.9.0",
    "turbo": "^2.0.0",
    "typescript": "^5.6.0"
  },
  "packageManager": "pnpm@9.12.0",
  "engines": {
    "node": ">=22.0.0"
  }
}
```

### 3.3 Turborepo Configuration (Optional but Recommended)

```json
// turbo.json
{
  "$schema": "https://turbo.build/schema.json",
  "globalDependencies": [".env"],
  "tasks": {
    "build": {
      "dependsOn": ["^build"],
      "outputs": [".next/**", "dist/**"]
    },
    "dev": {
      "cache": false,
      "persistent": true
    },
    "typecheck": {
      "dependsOn": ["^build"]
    },
    "lint": {}
  }
}
```

---

## 4. Technology Stack

### 4.1 Core Technologies

| Category | Technology | Version | Purpose |
|----------|------------|---------|---------|
| Runtime | Node.js | 20+ LTS | Server runtime |
| Framework | Next.js | 15.x | Full-stack React framework |
| Language | TypeScript | 5.x | Type safety |
| Styling | Tailwind CSS | 4.x | Utility-first CSS |
| UI Components | shadcn/ui | latest | Accessible components |
| Database | PostgreSQL | 16.x | Primary data store |
| ORM | Prisma | 6.x | Type-safe database access |
| Package Manager | pnpm | 9.x | Fast, disk-efficient workspaces |

### 4.2 Monorepo & Build Tools

| Technology | Purpose |
|------------|---------|
| pnpm workspaces | Monorepo package management |
| Turborepo | Build orchestration, caching (optional) |
| tsup | Package bundling for shared packages |
| @t3-oss/env-nextjs | Type-safe environment variables |

### 4.3 Background Job Processing

| Technology | Purpose |
|------------|---------|
| BullMQ | Robust job queue with retries, priorities |
| Redis | Job queue storage, pub/sub for BullMQ |
| ioredis | Redis client for Node.js |

### 4.4 Authentication & Security

| Technology | Purpose |
|------------|---------|
| better-auth | Authentication (sessions, password, social) |
| @node-saml/node-saml | SAML 2.0 Identity Provider |
| zod | Schema validation |
| zxcvbn | Password strength validation |

### 4.5 Data & State Management

| Technology | Purpose |
|------------|---------|
| TanStack Query | Server state management, caching |
| TanStack Table | Data table with sorting, filtering, pagination |
| nuqs | URL state management for tables, tabs |
| react-hook-form | Form state management |
| next-safe-action | Type-safe server actions |

### 4.6 Development & Quality

| Technology | Purpose |
|------------|---------|
| Biome | Linting and formatting |
| tsc | Type checking |
| Docker | Development and deployment |
| next-intl | Internationalization |

### 4.7 External Integrations

| Technology | Purpose |
|------------|---------|
| ldapjs-client | LDAP write operations |
| nodemailer | Email sending |
| Discourse API | Forum synchronization |

---

## 5. Shared Packages

### 5.1 @habidat/db - Database Package

The database package contains the Prisma schema and client, shared between web app and worker.

```typescript
// packages/db/src/index.ts
import { PrismaClient } from '@prisma/client'

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined
}

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === 'development' ? ['query', 'error', 'warn'] : ['error'],
  })

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma

export * from '@prisma/client'
export type { Prisma } from '@prisma/client'
```

```json
// packages/db/package.json
{
  "name": "@habidat/db",
  "version": "0.0.0",
  "private": true,
  "main": "./src/index.ts",
  "types": "./src/index.ts",
  "scripts": {
    "generate": "prisma generate",
    "migrate": "prisma migrate dev",
    "push": "prisma db push",
    "studio": "prisma studio",
    "typecheck": "tsc --noEmit"
  },
  "dependencies": {
    "@prisma/client": "^6.0.0"
  },
  "devDependencies": {
    "prisma": "^6.0.0",
    "@habidat/typescript-config": "workspace:*",
    "typescript": "^5.6.0"
  }
}
```

### 5.2 @habidat/sync - BullMQ Queues Package

The sync package defines queues, job types, and exports queue instances for both producer (web) and consumer (worker).

```typescript
// packages/sync/src/connection.ts
import { Redis } from 'ioredis'

let connection: Redis | null = null

export function getRedisConnection(): Redis {
  if (!connection) {
    connection = new Redis(process.env.REDIS_URL!, {
      maxRetriesPerRequest: null, // Required for BullMQ
      enableReadyCheck: false,
    })
  }
  return connection
}

export async function closeRedisConnection(): Promise<void> {
  if (connection) {
    await connection.quit()
    connection = null
  }
}
```

```typescript
// packages/sync/src/constants.ts
export const QUEUE_NAMES = {
  LDAP_SYNC: 'ldap-sync',
  DISCOURSE_SYNC: 'discourse-sync',
  EMAIL: 'email',
} as const

export const JOB_NAMES = {
  // LDAP
  LDAP_CREATE_USER: 'ldap:create-user',
  LDAP_UPDATE_USER: 'ldap:update-user',
  LDAP_DELETE_USER: 'ldap:delete-user',
  LDAP_UPDATE_PASSWORD: 'ldap:update-password',
  LDAP_CREATE_GROUP: 'ldap:create-group',
  LDAP_UPDATE_GROUP: 'ldap:update-group',
  LDAP_DELETE_GROUP: 'ldap:delete-group',
  
  // Discourse
  DISCOURSE_SYNC_USER: 'discourse:sync-user',
  DISCOURSE_DELETE_USER: 'discourse:delete-user',
  DISCOURSE_CREATE_GROUP: 'discourse:create-group',
  DISCOURSE_UPDATE_GROUP: 'discourse:update-group',
  DISCOURSE_DELETE_GROUP: 'discourse:delete-group',
  DISCOURSE_SYNC_GROUP_MEMBERS: 'discourse:sync-group-members',
  DISCOURSE_CREATE_CATEGORY: 'discourse:create-category',
  DISCOURSE_UPDATE_CATEGORY: 'discourse:update-category',
  DISCOURSE_DELETE_CATEGORY: 'discourse:delete-category',
  
  // Email
  EMAIL_SEND_INVITE: 'email:send-invite',
  EMAIL_SEND_PASSWORD_RESET: 'email:send-password-reset',
} as const
```

```typescript
// packages/sync/src/jobs.ts
import type { JOB_NAMES } from './constants'

// LDAP Job Types
export interface LdapCreateUserJob {
  name: typeof JOB_NAMES.LDAP_CREATE_USER
  data: {
    userId: string
    hashedPassword: string
  }
}

export interface LdapUpdateUserJob {
  name: typeof JOB_NAMES.LDAP_UPDATE_USER
  data: {
    userId: string
  }
}

export interface LdapDeleteUserJob {
  name: typeof JOB_NAMES.LDAP_DELETE_USER
  data: {
    ldapDn: string
    username: string
  }
}

export interface LdapUpdatePasswordJob {
  name: typeof JOB_NAMES.LDAP_UPDATE_PASSWORD
  data: {
    userId: string
    hashedPassword: string
  }
}

export interface LdapCreateGroupJob {
  name: typeof JOB_NAMES.LDAP_CREATE_GROUP
  data: {
    groupId: string
  }
}

export interface LdapUpdateGroupJob {
  name: typeof JOB_NAMES.LDAP_UPDATE_GROUP
  data: {
    groupId: string
  }
}

export interface LdapDeleteGroupJob {
  name: typeof JOB_NAMES.LDAP_DELETE_GROUP
  data: {
    ldapDn: string
    slug: string
  }
}

export type LdapJob =
  | LdapCreateUserJob
  | LdapUpdateUserJob
  | LdapDeleteUserJob
  | LdapUpdatePasswordJob
  | LdapCreateGroupJob
  | LdapUpdateGroupJob
  | LdapDeleteGroupJob

// Discourse Job Types
export interface DiscourseSyncUserJob {
  name: typeof JOB_NAMES.DISCOURSE_SYNC_USER
  data: {
    userId: string
  }
}

export interface DiscourseDeleteUserJob {
  name: typeof JOB_NAMES.DISCOURSE_DELETE_USER
  data: {
    username: string
  }
}

export interface DiscourseCreateGroupJob {
  name: typeof JOB_NAMES.DISCOURSE_CREATE_GROUP
  data: {
    groupId: string
  }
}

export interface DiscourseUpdateGroupJob {
  name: typeof JOB_NAMES.DISCOURSE_UPDATE_GROUP
  data: {
    groupId: string
  }
}

export interface DiscourseSyncGroupMembersJob {
  name: typeof JOB_NAMES.DISCOURSE_SYNC_GROUP_MEMBERS
  data: {
    groupId: string
  }
}

export type DiscourseJob =
  | DiscourseSyncUserJob
  | DiscourseDeleteUserJob
  | DiscourseCreateGroupJob
  | DiscourseUpdateGroupJob
  | DiscourseSyncGroupMembersJob

// Email Job Types
export interface EmailSendInviteJob {
  name: typeof JOB_NAMES.EMAIL_SEND_INVITE
  data: {
    to: string
    inviteToken: string
    inviterName: string
  }
}

export interface EmailSendPasswordResetJob {
  name: typeof JOB_NAMES.EMAIL_SEND_PASSWORD_RESET
  data: {
    to: string
    token: string
  }
}

export type EmailJob = EmailSendInviteJob | EmailSendPasswordResetJob
```

```typescript
// packages/sync/src/queues.ts
import { Queue } from 'bullmq'
import { getRedisConnection } from './connection'
import { QUEUE_NAMES } from './constants'
import type { LdapJob, DiscourseJob, EmailJob } from './jobs'

// Default job options
const defaultJobOptions = {
  attempts: 5,
  backoff: {
    type: 'exponential' as const,
    delay: 1000, // Start with 1 second, exponentially increase
  },
  removeOnComplete: {
    age: 24 * 3600, // Keep completed jobs for 24 hours
    count: 1000,    // Keep last 1000 completed jobs
  },
  removeOnFail: {
    age: 7 * 24 * 3600, // Keep failed jobs for 7 days
  },
}

// Queue instances (lazy initialization)
let ldapQueue: Queue<LdapJob['data'], void, LdapJob['name']> | null = null
let discourseQueue: Queue<DiscourseJob['data'], void, DiscourseJob['name']> | null = null
let emailQueue: Queue<EmailJob['data'], void, EmailJob['name']> | null = null

export function getLdapQueue() {
  if (!ldapQueue) {
    ldapQueue = new Queue(QUEUE_NAMES.LDAP_SYNC, {
      connection: getRedisConnection(),
      defaultJobOptions,
    })
  }
  return ldapQueue
}

export function getDiscourseQueue() {
  if (!discourseQueue) {
    discourseQueue = new Queue(QUEUE_NAMES.DISCOURSE_SYNC, {
      connection: getRedisConnection(),
      defaultJobOptions,
    })
  }
  return discourseQueue
}

export function getEmailQueue() {
  if (!emailQueue) {
    emailQueue = new Queue(QUEUE_NAMES.EMAIL, {
      connection: getRedisConnection(),
      defaultJobOptions: {
        ...defaultJobOptions,
        attempts: 3, // Fewer retries for emails
      },
    })
  }
  return emailQueue
}

// Close all queues (for graceful shutdown)
export async function closeAllQueues(): Promise<void> {
  const queues = [ldapQueue, discourseQueue, emailQueue].filter(Boolean)
  await Promise.all(queues.map(q => q!.close()))
  ldapQueue = null
  discourseQueue = null
  emailQueue = null
}
```

```typescript
// packages/sync/src/index.ts
// Queue producers (for web app)
export { getLdapQueue, getDiscourseQueue, getEmailQueue, closeAllQueues } from './queues'

// Constants
export { QUEUE_NAMES, JOB_NAMES } from './constants'

// Types
export type {
  LdapJob,
  LdapCreateUserJob,
  LdapUpdateUserJob,
  LdapDeleteUserJob,
  LdapUpdatePasswordJob,
  LdapCreateGroupJob,
  LdapUpdateGroupJob,
  LdapDeleteGroupJob,
  DiscourseJob,
  DiscourseSyncUserJob,
  DiscourseDeleteUserJob,
  DiscourseCreateGroupJob,
  DiscourseUpdateGroupJob,
  DiscourseSyncGroupMembersJob,
  EmailJob,
  EmailSendInviteJob,
  EmailSendPasswordResetJob,
} from './jobs'

// Connection management
export { getRedisConnection, closeRedisConnection } from './connection'
```

```json
// packages/sync/package.json
{
  "name": "@habidat/sync",
  "version": "0.0.0",
  "private": true,
  "main": "./src/index.ts",
  "types": "./src/index.ts",
  "scripts": {
    "typecheck": "tsc --noEmit"
  },
  "dependencies": {
    "bullmq": "^5.0.0",
    "ioredis": "^5.4.0"
  },
  "devDependencies": {
    "@habidat/typescript-config": "workspace:*",
    "typescript": "^5.6.0"
  }
}
```

### 5.3 @habidat/env - Environment Variables Package

```typescript
// packages/env/src/shared.ts
import { createEnv } from '@t3-oss/env-nextjs'
import { z } from 'zod'

export const sharedEnv = createEnv({
  server: {
    NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
    DATABASE_URL: z.string().url(),
    REDIS_URL: z.string().url(),
  },
  runtimeEnv: {
    NODE_ENV: process.env.NODE_ENV,
    DATABASE_URL: process.env.DATABASE_URL,
    REDIS_URL: process.env.REDIS_URL,
  },
})
```

```typescript
// packages/env/src/web.ts
import { createEnv } from '@t3-oss/env-nextjs'
import { z } from 'zod'
import { sharedEnv } from './shared'

export const webEnv = createEnv({
  extends: [sharedEnv],
  server: {
    APP_URL: z.string().url(),
    SESSION_SECRET: z.string().min(32),
    SAML_PRIVATE_KEY: z.string(),
    SAML_CERTIFICATE: z.string(),
  },
  client: {
    NEXT_PUBLIC_APP_URL: z.string().url(),
  },
  runtimeEnv: {
    APP_URL: process.env.APP_URL,
    SESSION_SECRET: process.env.SESSION_SECRET,
    SAML_PRIVATE_KEY: process.env.SAML_PRIVATE_KEY,
    SAML_CERTIFICATE: process.env.SAML_CERTIFICATE,
    NEXT_PUBLIC_APP_URL: process.env.NEXT_PUBLIC_APP_URL,
  },
})

export type WebEnv = typeof webEnv
```

```typescript
// packages/env/src/worker.ts
import { createEnv } from '@t3-oss/env-core'
import { z } from 'zod'

export const workerEnv = createEnv({
  server: {
    NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
    DATABASE_URL: z.string().url(),
    REDIS_URL: z.string().url(),
    
    // LDAP
    LDAP_URL: z.string().url(),
    LDAP_BIND_DN: z.string(),
    LDAP_BIND_PASSWORD: z.string(),
    LDAP_BASE_DN: z.string(),
    LDAP_USERS_DN: z.string(),
    LDAP_GROUPS_DN: z.string(),
    
    // Discourse
    DISCOURSE_URL: z.string().url(),
    DISCOURSE_API_KEY: z.string(),
    DISCOURSE_API_USERNAME: z.string(),
    DISCOURSE_SSO_SECRET: z.string(),
    
    // SMTP
    SMTP_HOST: z.string(),
    SMTP_PORT: z.coerce.number(),
    SMTP_SECURE: z.coerce.boolean().default(false),
    SMTP_USER: z.string().optional(),
    SMTP_PASS: z.string().optional(),
    SMTP_FROM: z.string().email(),
    
    // App
    APP_URL: z.string().url(),
  },
  runtimeEnv: process.env,
})

export type WorkerEnv = typeof workerEnv
```

### 5.4 @habidat/ldap - LDAP Client Package

```typescript
// packages/ldap/src/client.ts
import LdapClient from 'ldapjs-client'

export interface LdapConfig {
  url: string
  bindDn: string
  bindPassword: string
  baseDn: string
  usersDn: string
  groupsDn: string
}

export class LdapService {
  private client: LdapClient | null = null
  private config: LdapConfig

  constructor(config: LdapConfig) {
    this.config = config
  }

  async connect(): Promise<void> {
    this.client = new LdapClient({ url: this.config.url })
    await this.client.bind(this.config.bindDn, this.config.bindPassword)
  }

  async disconnect(): Promise<void> {
    if (this.client) {
      await this.client.unbind()
      this.client = null
    }
  }

  private ensureConnected(): LdapClient {
    if (!this.client) {
      throw new Error('LDAP client not connected')
    }
    return this.client
  }

  // User operations
  async createUser(data: CreateUserData): Promise<string> {
    const client = this.ensureConnected()
    const dn = `uid=${data.username},${this.config.usersDn}`
    
    await client.add(dn, {
      objectClass: ['inetOrgPerson', 'posixAccount', 'organizationalPerson'],
      uid: data.username,
      cn: data.name,
      mail: data.email,
      l: data.location || '',
      preferredLanguage: data.preferredLanguage || 'de',
      description: data.storageQuota || '1 GB',
      uidNumber: data.ldapUidNumber,
      gidNumber: 500,
      homeDirectory: `/home/${data.username}`,
      userPassword: data.hashedPassword,
    })
    
    return dn
  }

  async updateUser(dn: string, data: UpdateUserData): Promise<void> {
    const client = this.ensureConnected()
    const modifications: Array<{ operation: string; modification: Record<string, string> }> = []

    if (data.name) modifications.push({ operation: 'replace', modification: { cn: data.name } })
    if (data.email) modifications.push({ operation: 'replace', modification: { mail: data.email } })
    if (data.location !== undefined) modifications.push({ operation: 'replace', modification: { l: data.location || '' } })
    if (data.preferredLanguage) modifications.push({ operation: 'replace', modification: { preferredLanguage: data.preferredLanguage } })
    if (data.storageQuota) modifications.push({ operation: 'replace', modification: { description: data.storageQuota } })

    if (modifications.length > 0) {
      await client.modify(dn, modifications)
    }
  }

  async deleteUser(dn: string): Promise<void> {
    const client = this.ensureConnected()
    await client.del(dn)
  }

  async updatePassword(dn: string, hashedPassword: string): Promise<void> {
    const client = this.ensureConnected()
    await client.modify(dn, {
      operation: 'replace',
      modification: { userPassword: hashedPassword },
    })
  }

  // Group operations
  async createGroup(data: CreateGroupData): Promise<string> {
    const client = this.ensureConnected()
    const dn = `cn=${data.slug},${this.config.groupsDn}`
    
    await client.add(dn, {
      objectClass: 'groupOfNames',
      cn: data.slug,
      o: data.name,
      description: data.description,
      member: data.memberDns.length > 0 ? data.memberDns : [''],
    })
    
    return dn
  }

  async updateGroup(dn: string, data: UpdateGroupData): Promise<void> {
    const client = this.ensureConnected()
    const modifications: Array<{ operation: string; modification: Record<string, string | string[]> }> = []

    if (data.name) modifications.push({ operation: 'replace', modification: { o: data.name } })
    if (data.description) modifications.push({ operation: 'replace', modification: { description: data.description } })
    if (data.memberDns) {
      modifications.push({
        operation: 'replace',
        modification: { member: data.memberDns.length > 0 ? data.memberDns : [''] },
      })
    }

    if (modifications.length > 0) {
      await client.modify(dn, modifications)
    }
  }

  async deleteGroup(dn: string): Promise<void> {
    const client = this.ensureConnected()
    await client.del(dn)
  }
}

// Types
export interface CreateUserData {
  username: string
  name: string
  email: string
  location?: string
  preferredLanguage?: string
  storageQuota?: string
  ldapUidNumber: number
  hashedPassword: string
}

export interface UpdateUserData {
  name?: string
  email?: string
  location?: string
  preferredLanguage?: string
  storageQuota?: string
}

export interface CreateGroupData {
  slug: string
  name: string
  description: string
  memberDns: string[]
}

export interface UpdateGroupData {
  name?: string
  description?: string
  memberDns?: string[]
}
```

### 5.5 @habidat/discourse - Discourse Client Package

```typescript
// packages/discourse/src/client.ts
import { createHmac } from 'crypto'

export interface DiscourseConfig {
  url: string
  apiKey: string
  apiUsername: string
  ssoSecret: string
}

export class DiscourseService {
  private config: DiscourseConfig

  constructor(config: DiscourseConfig) {
    this.config = config
  }

  private async request<T>(path: string, options: RequestInit = {}): Promise<T> {
    const response = await fetch(`${this.config.url}${path}`, {
      ...options,
      headers: {
        'Api-Key': this.config.apiKey,
        'Api-Username': this.config.apiUsername,
        'Content-Type': 'application/json',
        ...options.headers,
      },
    })

    if (!response.ok) {
      const error = await response.text()
      throw new Error(`Discourse API error: ${response.status} - ${error}`)
    }

    return response.json()
  }

  // SSO Sync
  async syncUserViaSso(user: SsoUserData): Promise<void> {
    const payload = this.buildSsoPayload(user)
    const sig = this.signPayload(payload)

    await this.request('/admin/users/sync_sso', {
      method: 'POST',
      body: JSON.stringify({ sso: payload, sig }),
    })
  }

  private buildSsoPayload(user: SsoUserData): string {
    const params = new URLSearchParams({
      external_id: user.externalId,
      email: user.email,
      username: user.username,
      name: user.name,
      ...(user.title && { title: user.title }),
      ...(user.groups && { groups: user.groups.join(',') }),
    })
    return Buffer.from(params.toString()).toString('base64')
  }

  private signPayload(payload: string): string {
    return createHmac('sha256', this.config.ssoSecret).update(payload).digest('hex')
  }

  // User operations
  async deleteUser(username: string): Promise<void> {
    try {
      const user = await this.request<{ user: { id: number } }>(`/u/${username}.json`)
      await this.request(`/admin/users/${user.user.id}.json`, {
        method: 'DELETE',
        body: JSON.stringify({
          delete_posts: false,
          block_email: false,
          block_urls: false,
          block_ip: false,
        }),
      })
    } catch {
      // User might not exist, try suspend instead
      await this.suspendUser(username)
    }
  }

  async suspendUser(username: string): Promise<void> {
    try {
      const user = await this.request<{ user: { id: number } }>(`/u/${username}.json`)
      await this.request(`/admin/users/${user.user.id}/suspend.json`, {
        method: 'PUT',
        body: JSON.stringify({
          suspend_until: '3018-01-01',
          reason: 'Account deleted from habidat-auth',
        }),
      })
    } catch (error) {
      console.warn(`Could not suspend Discourse user ${username}:`, error)
    }
  }

  // Group operations
  async createGroup(group: CreateGroupData): Promise<number> {
    const result = await this.request<{ basic_group: { id: number } }>('/admin/groups', {
      method: 'POST',
      body: JSON.stringify({
        group: {
          name: group.slug,
          full_name: group.name,
          bio_raw: group.description,
          alias_level: 3,
          mentionable_level: 3,
          messageable_level: 3,
        },
      }),
    })
    return result.basic_group.id
  }

  async updateGroup(discourseId: number, group: UpdateGroupData): Promise<void> {
    await this.request(`/groups/${discourseId}.json`, {
      method: 'PUT',
      body: JSON.stringify({
        group: {
          name: group.slug,
          full_name: group.name,
          bio_raw: group.description,
        },
      }),
    })
  }

  async deleteGroup(discourseId: number): Promise<void> {
    await this.request(`/admin/groups/${discourseId}.json`, {
      method: 'DELETE',
    })
  }

  async syncGroupMembers(groupSlug: string, usernames: string[]): Promise<void> {
    const currentMembers = await this.getGroupMembers(groupSlug)
    const currentSet = new Set(currentMembers)
    const targetSet = new Set(usernames)

    // Add missing members
    const toAdd = usernames.filter(u => !currentSet.has(u))
    if (toAdd.length > 0) {
      await this.request(`/groups/${groupSlug}/members.json`, {
        method: 'PUT',
        body: JSON.stringify({ usernames: toAdd.join(',') }),
      })
    }

    // Remove extra members
    const toRemove = currentMembers.filter(u => !targetSet.has(u))
    for (const username of toRemove) {
      await this.request(`/groups/${groupSlug}/members.json`, {
        method: 'DELETE',
        body: JSON.stringify({ username }),
      })
    }
  }

  private async getGroupMembers(groupSlug: string): Promise<string[]> {
    const result = await this.request<{ members: Array<{ username: string }> }>(
      `/groups/${groupSlug}/members.json?limit=1000`
    )
    return result.members.map(m => m.username)
  }
}

// Types
export interface SsoUserData {
  externalId: string
  email: string
  username: string
  name: string
  title?: string
  groups?: string[]
}

export interface CreateGroupData {
  slug: string
  name: string
  description: string
}

export interface UpdateGroupData {
  slug?: string
  name?: string
  description?: string
}
```

---

## 6. Data Model (Prisma)

### 6.1 Schema Overview

```prisma
// prisma/schema.prisma

generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

// ============================================================================
// AUTHENTICATION (better-auth managed)
// ============================================================================

model User {
  id                String    @id @default(cuid())
  email             String    @unique
  emailVerified     Boolean   @default(false)
  name              String    // Display name (was: cn)
  username          String    @unique // Login name (was: uid)
  image             String?
  createdAt         DateTime  @default(now())
  updatedAt         DateTime  @updatedAt

  // Profile fields (from legacy system)
  location          String?   // City/location (was: l)
  preferredLanguage String    @default("de")
  storageQuota      String    @default("1 GB") // (was: description)
  
  // Primary affiliation
  primaryGroupId    String?
  primaryGroup      Group?    @relation("PrimaryGroup", fields: [primaryGroupId], references: [id])

  // LDAP sync fields
  ldapDn            String?   @unique // Distinguished Name for LDAP sync
  ldapUidNumber     Int?      @unique // POSIX UID
  ldapSynced        Boolean   @default(false)
  ldapSyncedAt      DateTime?

  // Relations
  sessions          Session[]
  accounts          Account[]
  memberships       GroupMembership[]
  ownerships        GroupOwnership[]
  auditLogs         AuditLog[]        @relation("AuditActor")
  invitesCreated    Invite[]          @relation("InviteCreator")
  
  @@index([email])
  @@index([username])
  @@index([ldapDn])
}

model Session {
  id        String   @id @default(cuid())
  userId    String
  user      User     @relation(fields: [userId], references: [id], onDelete: Cascade)
  token     String   @unique
  expiresAt DateTime
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt
  
  // SAML session tracking
  samlApps  SamlSessionApp[]
  
  @@index([userId])
  @@index([token])
}

model Account {
  id                String   @id @default(cuid())
  userId            String
  user              User     @relation(fields: [userId], references: [id], onDelete: Cascade)
  accountId         String
  providerId        String
  accessToken       String?
  refreshToken      String?
  accessTokenExpiresAt DateTime?
  refreshTokenExpiresAt DateTime?
  scope             String?
  password          String?  // Hashed password for credential auth
  createdAt         DateTime @default(now())
  updatedAt         DateTime @updatedAt
  
  @@index([userId])
}

model Verification {
  id         String   @id @default(cuid())
  identifier String
  value      String
  expiresAt  DateTime
  createdAt  DateTime @default(now())
  updatedAt  DateTime @updatedAt
  
  @@index([identifier])
}

// ============================================================================
// GROUPS (Hierarchical with M:N relationships)
// ============================================================================

model Group {
  id          String   @id @default(cuid())
  slug        String   @unique // URL-friendly ID (was: cn)
  name        String   // Display name (was: o)
  description String
  isSystem    Boolean  @default(false) // admin, groupadmin groups
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt

  // LDAP sync fields
  ldapDn         String?   @unique
  ldapSynced     Boolean   @default(false)
  ldapSyncedAt   DateTime?
  
  // Discourse sync fields
  discourseId    Int?      @unique
  discourseSynced Boolean  @default(false)
  discourseSyncedAt DateTime?

  // Relations
  memberships    GroupMembership[]
  ownerships     GroupOwnership[]
  primaryUsers   User[]            @relation("PrimaryGroup")
  
  // Hierarchical relationships (M:N)
  parentGroups   GroupHierarchy[]  @relation("ChildGroup")
  childGroups    GroupHierarchy[]  @relation("ParentGroup")
  
  // App access
  appAccess      AppGroupAccess[]
  
  // Category access
  categoryAccess CategoryGroupAccess[]
  
  @@index([slug])
  @@index([ldapDn])
}

model GroupMembership {
  id        String   @id @default(cuid())
  userId    String
  user      User     @relation(fields: [userId], references: [id], onDelete: Cascade)
  groupId   String
  group     Group    @relation(fields: [groupId], references: [id], onDelete: Cascade)
  createdAt DateTime @default(now())
  
  @@unique([userId, groupId])
  @@index([userId])
  @@index([groupId])
}

model GroupOwnership {
  id        String   @id @default(cuid())
  userId    String
  user      User     @relation(fields: [userId], references: [id], onDelete: Cascade)
  groupId   String
  group     Group    @relation(fields: [groupId], references: [id], onDelete: Cascade)
  createdAt DateTime @default(now())
  
  @@unique([userId, groupId])
  @@index([userId])
  @@index([groupId])
}

model GroupHierarchy {
  id            String   @id @default(cuid())
  parentGroupId String
  parentGroup   Group    @relation("ParentGroup", fields: [parentGroupId], references: [id], onDelete: Cascade)
  childGroupId  String
  childGroup    Group    @relation("ChildGroup", fields: [childGroupId], references: [id], onDelete: Cascade)
  createdAt     DateTime @default(now())
  
  @@unique([parentGroupId, childGroupId])
  @@index([parentGroupId])
  @@index([childGroupId])
}

// ============================================================================
// INVITATIONS
// ============================================================================

model Invite {
  id            String   @id @default(cuid())
  token         String   @unique @default(cuid())
  email         String
  expiresAt     DateTime
  createdAt     DateTime @default(now())
  
  // Inviter info
  createdById   String
  createdBy     User     @relation("InviteCreator", fields: [createdById], references: [id])
  
  // Pre-assigned groups
  memberGroups  InviteGroupMembership[]
  ownerGroups   InviteGroupOwnership[]
  
  @@index([token])
  @@index([email])
}

model InviteGroupMembership {
  id        String @id @default(cuid())
  inviteId  String
  invite    Invite @relation(fields: [inviteId], references: [id], onDelete: Cascade)
  groupId   String
  
  @@unique([inviteId, groupId])
  @@index([inviteId])
}

model InviteGroupOwnership {
  id        String @id @default(cuid())
  inviteId  String
  invite    Invite @relation(fields: [inviteId], references: [id], onDelete: Cascade)
  groupId   String
  
  @@unique([inviteId, groupId])
  @@index([inviteId])
}

// ============================================================================
// APPLICATIONS
// ============================================================================

model App {
  id        String   @id @default(cuid())
  slug      String   @unique
  name      String   // Display label
  url       String
  iconUrl   String?
  sortOrder Int      @default(0)
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt
  
  // SAML configuration
  samlEnabled   Boolean  @default(false)
  samlEntityId  String?
  samlAcsUrl    String?  // Assertion Consumer Service URL
  samlSloUrl    String?  // Single Logout URL
  samlCertificate String? // SP certificate (PEM)
  
  // Access control
  groupAccess   AppGroupAccess[]
  
  // SAML sessions
  samlSessions  SamlSessionApp[]
  
  @@index([slug])
}

model AppGroupAccess {
  id      String @id @default(cuid())
  appId   String
  app     App    @relation(fields: [appId], references: [id], onDelete: Cascade)
  groupId String
  group   Group  @relation(fields: [groupId], references: [id], onDelete: Cascade)
  
  @@unique([appId, groupId])
  @@index([appId])
  @@index([groupId])
}

model SamlSessionApp {
  id        String  @id @default(cuid())
  sessionId String
  session   Session @relation(fields: [sessionId], references: [id], onDelete: Cascade)
  appId     String
  app       App     @relation(fields: [appId], references: [id], onDelete: Cascade)
  nameId    String  // SAML NameID for logout
  createdAt DateTime @default(now())
  
  @@unique([sessionId, appId])
  @@index([sessionId])
}

// ============================================================================
// DISCOURSE CATEGORIES
// ============================================================================

model DiscourseCategory {
  id           String   @id @default(cuid())
  name         String
  slug         String   @unique
  color        String   @default("0088cc") // 6-digit hex
  textColor    String   @default("ffffff")
  parentId     String?
  parent       DiscourseCategory?  @relation("CategoryHierarchy", fields: [parentId], references: [id])
  children     DiscourseCategory[] @relation("CategoryHierarchy")
  createdAt    DateTime @default(now())
  updatedAt    DateTime @updatedAt
  
  // Discourse sync
  discourseId       Int?      @unique
  discourseSynced   Boolean   @default(false)
  discourseSyncedAt DateTime?
  
  // Group access
  groupAccess  CategoryGroupAccess[]
  
  @@index([slug])
  @@index([discourseId])
}

model CategoryGroupAccess {
  id         String            @id @default(cuid())
  categoryId String
  category   DiscourseCategory @relation(fields: [categoryId], references: [id], onDelete: Cascade)
  groupId    String
  group      Group             @relation(fields: [groupId], references: [id], onDelete: Cascade)
  
  @@unique([categoryId, groupId])
  @@index([categoryId])
  @@index([groupId])
}

// ============================================================================
// SETTINGS
// ============================================================================

model Setting {
  id        String   @id @default(cuid())
  key       String   @unique
  value     Json
  updatedAt DateTime @updatedAt
  
  @@index([key])
}

model EmailTemplate {
  id        String   @id @default(cuid())
  key       String   @unique // "invite", "passwordReset"
  subject   String
  body      String   // HTML content
  enabled   Boolean  @default(true)
  updatedAt DateTime @updatedAt
  
  @@index([key])
}

// ============================================================================
// AUDIT LOG
// ============================================================================

enum AuditAction {
  CREATE
  UPDATE
  DELETE
}

enum AuditEntityType {
  USER
  GROUP
  INVITE
  APP
  CATEGORY
  SETTING
}

model AuditLog {
  id          String          @id @default(cuid())
  actorId     String?
  actor       User?           @relation("AuditActor", fields: [actorId], references: [id], onDelete: SetNull)
  action      AuditAction
  entityType  AuditEntityType
  entityId    String
  oldValue    Json?
  newValue    Json?
  metadata    Json?           // Additional context
  createdAt   DateTime        @default(now())
  
  @@index([actorId])
  @@index([entityType, entityId])
  @@index([createdAt])
}

// ============================================================================
// SYNC QUEUE (Outbox Pattern)
// ============================================================================

enum SyncTarget {
  LDAP
  DISCOURSE
}

enum SyncOperation {
  CREATE
  UPDATE
  DELETE
  SYNC_GROUPS  // Full group membership sync
}

enum SyncStatus {
  PENDING
  PROCESSING
  COMPLETED
  FAILED
  RETRYING
}

model SyncEvent {
  id          String        @id @default(cuid())
  target      SyncTarget
  operation   SyncOperation
  entityType  AuditEntityType
  entityId    String
  payload     Json          // Data needed for sync
  status      SyncStatus    @default(PENDING)
  attempts    Int           @default(0)
  maxAttempts Int           @default(5)
  lastError   String?
  createdAt   DateTime      @default(now())
  processedAt DateTime?
  
  @@index([status, target])
  @@index([createdAt])
  @@index([entityType, entityId])
}
```

### 6.2 Key Differences from Legacy

| Legacy (LDAP) | New (PostgreSQL) | Notes |
|---------------|------------------|-------|
| `uid` | `username` | Login identifier |
| `cn` | `name` | Display name |
| `dn` | `id` + `ldapDn` | UUID primary key, DN for sync |
| `ou` | `primaryGroupId` | Foreign key reference |
| `l` | `location` | City/location |
| `description` | `storageQuota` | Clearer naming |
| `member` (DN list) | `GroupMembership` | Proper join table |
| `owner` (DN list) | `GroupOwnership` | Proper join table |
| JSON files | Database tables | Type-safe, queryable |

---

## 7. Synchronization Architecture (BullMQ)

### 7.1 Overview

The sync system uses BullMQ with Redis for reliable background job processing. The web app adds jobs to queues, and the worker app processes them independently.

```
┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│   Web App       │     │     Redis       │     │   Worker App    │
│   (Next.js)     │────►│   (BullMQ)      │◄────│   (Node.js)     │
└────────┬────────┘     └─────────────────┘     └────────┬────────┘
         │                                               │
         │                                      ┌────────┴────────┐
         │                                      │                 │
         ▼                                      ▼                 ▼
┌─────────────────┐                      ┌──────────┐      ┌──────────┐
│   PostgreSQL    │◄─────────────────────│   LDAP   │      │ Discourse│
└─────────────────┘                      └──────────┘      └──────────┘
```

### 7.2 Worker App Entry Point

```typescript
// apps/worker/src/index.ts
import { Worker } from 'bullmq'
import { 
  getRedisConnection, 
  closeRedisConnection,
  QUEUE_NAMES 
} from '@habidat/sync'
import { prisma } from '@habidat/db'
import { workerEnv } from '@habidat/env/worker'
import { LdapService } from '@habidat/ldap'
import { DiscourseService } from '@habidat/discourse'
import { createLdapProcessor } from './processors/ldap.processor'
import { createDiscourseProcessor } from './processors/discourse.processor'
import { createEmailProcessor } from './processors/email.processor'

// Validate environment
const env = workerEnv

// Initialize services
const ldapService = new LdapService({
  url: env.LDAP_URL,
  bindDn: env.LDAP_BIND_DN,
  bindPassword: env.LDAP_BIND_PASSWORD,
  baseDn: env.LDAP_BASE_DN,
  usersDn: env.LDAP_USERS_DN,
  groupsDn: env.LDAP_GROUPS_DN,
})

const discourseService = new DiscourseService({
  url: env.DISCOURSE_URL,
  apiKey: env.DISCOURSE_API_KEY,
  apiUsername: env.DISCOURSE_API_USERNAME,
  ssoSecret: env.DISCOURSE_SSO_SECRET,
})

// Create workers
const connection = getRedisConnection()

const ldapWorker = new Worker(
  QUEUE_NAMES.LDAP_SYNC,
  createLdapProcessor(ldapService, prisma),
  {
    connection,
    concurrency: 5,
    limiter: {
      max: 10,
      duration: 1000, // Max 10 jobs per second
    },
  }
)

const discourseWorker = new Worker(
  QUEUE_NAMES.DISCOURSE_SYNC,
  createDiscourseProcessor(discourseService, prisma),
  {
    connection,
    concurrency: 3,
    limiter: {
      max: 5,
      duration: 1000, // Max 5 jobs per second (Discourse rate limits)
    },
  }
)

const emailWorker = new Worker(
  QUEUE_NAMES.EMAIL,
  createEmailProcessor(env),
  {
    connection,
    concurrency: 2,
  }
)

// Event handlers
const workers = [ldapWorker, discourseWorker, emailWorker]

workers.forEach(worker => {
  worker.on('completed', (job) => {
    console.log(`✅ Job ${job.id} (${job.name}) completed`)
  })

  worker.on('failed', (job, err) => {
    console.error(`❌ Job ${job?.id} (${job?.name}) failed:`, err.message)
  })

  worker.on('error', (err) => {
    console.error('Worker error:', err)
  })
})

// Graceful shutdown
async function shutdown() {
  console.log('Shutting down workers...')
  
  await Promise.all(workers.map(w => w.close()))
  await ldapService.disconnect()
  await closeRedisConnection()
  await prisma.$disconnect()
  
  console.log('Shutdown complete')
  process.exit(0)
}

process.on('SIGTERM', shutdown)
process.on('SIGINT', shutdown)

// Startup
async function start() {
  console.log('Starting worker...')
  await ldapService.connect()
  console.log('✅ LDAP connected')
  console.log('✅ Workers started')
  console.log(`   - LDAP Sync: ${QUEUE_NAMES.LDAP_SYNC}`)
  console.log(`   - Discourse Sync: ${QUEUE_NAMES.DISCOURSE_SYNC}`)
  console.log(`   - Email: ${QUEUE_NAMES.EMAIL}`)
}

start().catch(err => {
  console.error('Failed to start worker:', err)
  process.exit(1)
})
```

### 7.3 LDAP Processor

```typescript
// apps/worker/src/processors/ldap.processor.ts
import type { Job, Processor } from 'bullmq'
import type { PrismaClient } from '@habidat/db'
import type { LdapService } from '@habidat/ldap'
import { JOB_NAMES, type LdapJob } from '@habidat/sync'

export function createLdapProcessor(
  ldap: LdapService,
  prisma: PrismaClient
): Processor<LdapJob['data'], void, LdapJob['name']> {
  return async (job: Job<LdapJob['data'], void, LdapJob['name']>) => {
    console.log(`Processing LDAP job: ${job.name}`, job.data)

    switch (job.name) {
      case JOB_NAMES.LDAP_CREATE_USER:
        return handleCreateUser(ldap, prisma, job.data)
      
      case JOB_NAMES.LDAP_UPDATE_USER:
        return handleUpdateUser(ldap, prisma, job.data)
      
      case JOB_NAMES.LDAP_DELETE_USER:
        return handleDeleteUser(ldap, job.data)
      
      case JOB_NAMES.LDAP_UPDATE_PASSWORD:
        return handleUpdatePassword(ldap, prisma, job.data)
      
      case JOB_NAMES.LDAP_CREATE_GROUP:
        return handleCreateGroup(ldap, prisma, job.data)
      
      case JOB_NAMES.LDAP_UPDATE_GROUP:
        return handleUpdateGroup(ldap, prisma, job.data)
      
      case JOB_NAMES.LDAP_DELETE_GROUP:
        return handleDeleteGroup(ldap, job.data)
      
      default:
        throw new Error(`Unknown job name: ${job.name}`)
    }
  }
}

async function handleCreateUser(
  ldap: LdapService,
  prisma: PrismaClient,
  data: { userId: string; hashedPassword: string }
) {
  const user = await prisma.user.findUniqueOrThrow({
    where: { id: data.userId },
  })

  const dn = await ldap.createUser({
    username: user.username,
    name: user.name,
    email: user.email,
    location: user.location || undefined,
    preferredLanguage: user.preferredLanguage,
    storageQuota: user.storageQuota,
    ldapUidNumber: user.ldapUidNumber!,
    hashedPassword: data.hashedPassword,
  })

  await prisma.user.update({
    where: { id: user.id },
    data: {
      ldapDn: dn,
      ldapSynced: true,
      ldapSyncedAt: new Date(),
    },
  })
}

async function handleUpdateUser(
  ldap: LdapService,
  prisma: PrismaClient,
  data: { userId: string }
) {
  const user = await prisma.user.findUniqueOrThrow({
    where: { id: data.userId },
  })

  if (!user.ldapDn) {
    throw new Error(`User ${user.id} has no LDAP DN`)
  }

  await ldap.updateUser(user.ldapDn, {
    name: user.name,
    email: user.email,
    location: user.location || undefined,
    preferredLanguage: user.preferredLanguage,
    storageQuota: user.storageQuota,
  })

  await prisma.user.update({
    where: { id: user.id },
    data: {
      ldapSynced: true,
      ldapSyncedAt: new Date(),
    },
  })
}

async function handleDeleteUser(
  ldap: LdapService,
  data: { ldapDn: string; username: string }
) {
  await ldap.deleteUser(data.ldapDn)
}

async function handleUpdatePassword(
  ldap: LdapService,
  prisma: PrismaClient,
  data: { userId: string; hashedPassword: string }
) {
  const user = await prisma.user.findUniqueOrThrow({
    where: { id: data.userId },
  })

  if (!user.ldapDn) {
    throw new Error(`User ${user.id} has no LDAP DN`)
  }

  await ldap.updatePassword(user.ldapDn, data.hashedPassword)
}

async function handleCreateGroup(
  ldap: LdapService,
  prisma: PrismaClient,
  data: { groupId: string }
) {
  const group = await prisma.group.findUniqueOrThrow({
    where: { id: data.groupId },
    include: {
      memberships: {
        include: { user: { select: { ldapDn: true } } },
      },
    },
  })

  const memberDns = group.memberships
    .map(m => m.user.ldapDn)
    .filter((dn): dn is string => dn !== null)

  const dn = await ldap.createGroup({
    slug: group.slug,
    name: group.name,
    description: group.description,
    memberDns,
  })

  await prisma.group.update({
    where: { id: group.id },
    data: {
      ldapDn: dn,
      ldapSynced: true,
      ldapSyncedAt: new Date(),
    },
  })
}

async function handleUpdateGroup(
  ldap: LdapService,
  prisma: PrismaClient,
  data: { groupId: string }
) {
  const group = await prisma.group.findUniqueOrThrow({
    where: { id: data.groupId },
    include: {
      memberships: {
        include: { user: { select: { ldapDn: true } } },
      },
    },
  })

  if (!group.ldapDn) {
    throw new Error(`Group ${group.id} has no LDAP DN`)
  }

  const memberDns = group.memberships
    .map(m => m.user.ldapDn)
    .filter((dn): dn is string => dn !== null)

  await ldap.updateGroup(group.ldapDn, {
    name: group.name,
    description: group.description,
    memberDns,
  })

  await prisma.group.update({
    where: { id: group.id },
    data: {
      ldapSynced: true,
      ldapSyncedAt: new Date(),
    },
  })
}

async function handleDeleteGroup(
  ldap: LdapService,
  data: { ldapDn: string; slug: string }
) {
  await ldap.deleteGroup(data.ldapDn)
}
```

### 7.4 Discourse Processor

```typescript
// apps/worker/src/processors/discourse.processor.ts
import type { Job, Processor } from 'bullmq'
import type { PrismaClient } from '@habidat/db'
import type { DiscourseService } from '@habidat/discourse'
import { JOB_NAMES, type DiscourseJob } from '@habidat/sync'

export function createDiscourseProcessor(
  discourse: DiscourseService,
  prisma: PrismaClient
): Processor<DiscourseJob['data'], void, DiscourseJob['name']> {
  return async (job: Job<DiscourseJob['data'], void, DiscourseJob['name']>) => {
    console.log(`Processing Discourse job: ${job.name}`, job.data)

    switch (job.name) {
      case JOB_NAMES.DISCOURSE_SYNC_USER:
        return handleSyncUser(discourse, prisma, job.data)
      
      case JOB_NAMES.DISCOURSE_DELETE_USER:
        return handleDeleteUser(discourse, job.data)
      
      case JOB_NAMES.DISCOURSE_CREATE_GROUP:
        return handleCreateGroup(discourse, prisma, job.data)
      
      case JOB_NAMES.DISCOURSE_UPDATE_GROUP:
        return handleUpdateGroup(discourse, prisma, job.data)
      
      case JOB_NAMES.DISCOURSE_DELETE_GROUP:
        return handleDeleteGroup(discourse, prisma, job.data)
      
      case JOB_NAMES.DISCOURSE_SYNC_GROUP_MEMBERS:
        return handleSyncGroupMembers(discourse, prisma, job.data)
      
      default:
        throw new Error(`Unknown job name: ${job.name}`)
    }
  }
}

async function handleSyncUser(
  discourse: DiscourseService,
  prisma: PrismaClient,
  data: { userId: string }
) {
  const user = await prisma.user.findUniqueOrThrow({
    where: { id: data.userId },
    include: {
      memberships: {
        include: { group: { select: { slug: true } } },
      },
      primaryGroup: { select: { name: true } },
    },
  })

  await discourse.syncUserViaSso({
    externalId: user.id,
    email: user.email,
    username: user.username,
    name: user.name,
    title: user.primaryGroup?.name,
    groups: user.memberships.map(m => m.group.slug),
  })
}

async function handleDeleteUser(
  discourse: DiscourseService,
  data: { username: string }
) {
  await discourse.deleteUser(data.username)
}

async function handleCreateGroup(
  discourse: DiscourseService,
  prisma: PrismaClient,
  data: { groupId: string }
) {
  const group = await prisma.group.findUniqueOrThrow({
    where: { id: data.groupId },
  })

  const discourseId = await discourse.createGroup({
    slug: group.slug,
    name: group.name,
    description: group.description,
  })

  await prisma.group.update({
    where: { id: group.id },
    data: {
      discourseId,
      discourseSynced: true,
      discourseSyncedAt: new Date(),
    },
  })
}

async function handleUpdateGroup(
  discourse: DiscourseService,
  prisma: PrismaClient,
  data: { groupId: string }
) {
  const group = await prisma.group.findUniqueOrThrow({
    where: { id: data.groupId },
  })

  if (!group.discourseId) {
    throw new Error(`Group ${group.id} has no Discourse ID`)
  }

  await discourse.updateGroup(group.discourseId, {
    slug: group.slug,
    name: group.name,
    description: group.description,
  })

  await prisma.group.update({
    where: { id: group.id },
    data: {
      discourseSynced: true,
      discourseSyncedAt: new Date(),
    },
  })
}

async function handleDeleteGroup(
  discourse: DiscourseService,
  prisma: PrismaClient,
  data: { groupId: string }
) {
  const group = await prisma.group.findUnique({
    where: { id: data.groupId },
  })

  if (group?.discourseId) {
    await discourse.deleteGroup(group.discourseId)
  }
}

async function handleSyncGroupMembers(
  discourse: DiscourseService,
  prisma: PrismaClient,
  data: { groupId: string }
) {
  const group = await prisma.group.findUniqueOrThrow({
    where: { id: data.groupId },
    include: {
      memberships: {
        include: { user: { select: { username: true } } },
      },
      // Include subgroup members recursively
      childGroups: {
        include: {
          childGroup: {
            include: {
              memberships: {
                include: { user: { select: { username: true } } },
              },
            },
          },
        },
      },
    },
  })

  // Collect all usernames (direct + subgroup members)
  const usernames = new Set<string>()
  
  // Direct members
  group.memberships.forEach(m => usernames.add(m.user.username))
  
  // Subgroup members (recursive would need a separate function)
  group.childGroups.forEach(cg => {
    cg.childGroup.memberships.forEach(m => usernames.add(m.user.username))
  })

  await discourse.syncGroupMembers(group.slug, Array.from(usernames))

  await prisma.group.update({
    where: { id: group.id },
    data: {
      discourseSynced: true,
      discourseSyncedAt: new Date(),
    },
  })
}
```

### 7.5 Email Processor

```typescript
// apps/worker/src/processors/email.processor.ts
import type { Job, Processor } from 'bullmq'
import nodemailer from 'nodemailer'
import { JOB_NAMES, type EmailJob } from '@habidat/sync'
import { prisma } from '@habidat/db'
import type { WorkerEnv } from '@habidat/env/worker'

export function createEmailProcessor(
  env: WorkerEnv
): Processor<EmailJob['data'], void, EmailJob['name']> {
  const transporter = nodemailer.createTransport({
    host: env.SMTP_HOST,
    port: env.SMTP_PORT,
    secure: env.SMTP_SECURE,
    auth: env.SMTP_USER
      ? { user: env.SMTP_USER, pass: env.SMTP_PASS }
      : undefined,
  })

  return async (job: Job<EmailJob['data'], void, EmailJob['name']>) => {
    console.log(`Processing Email job: ${job.name}`, job.data)

    switch (job.name) {
      case JOB_NAMES.EMAIL_SEND_INVITE:
        return handleSendInvite(transporter, env, job.data)
      
      case JOB_NAMES.EMAIL_SEND_PASSWORD_RESET:
        return handleSendPasswordReset(transporter, env, job.data)
      
      default:
        throw new Error(`Unknown job name: ${job.name}`)
    }
  }
}

async function handleSendInvite(
  transporter: nodemailer.Transporter,
  env: WorkerEnv,
  data: { to: string; inviteToken: string; inviterName: string }
) {
  const template = await prisma.emailTemplate.findUnique({
    where: { key: 'invite' },
  })

  if (!template?.enabled) {
    console.log('Invite email template disabled, skipping')
    return
  }

  const settings = await prisma.setting.findUnique({
    where: { key: 'general' },
  })
  const title = (settings?.value as any)?.title || 'habidat'

  const link = `${env.APP_URL}/accept-invite?token=${data.inviteToken}`

  const html = template.body
    .replace(/\{\{\s*title\s*\}\}/g, title)
    .replace(/\{\{\s*link\s*\}\}/g, link)
    .replace(/\{\{\s*inviterName\s*\}\}/g, data.inviterName)
    .replace(/\{\{\s*url\s*\}\}/g, env.APP_URL)

  const subject = template.subject.replace(/\{\{\s*title\s*\}\}/g, title)

  await transporter.sendMail({
    from: env.SMTP_FROM,
    to: data.to,
    subject,
    html,
  })
}

async function handleSendPasswordReset(
  transporter: nodemailer.Transporter,
  env: WorkerEnv,
  data: { to: string; token: string }
) {
  const template = await prisma.emailTemplate.findUnique({
    where: { key: 'passwordReset' },
  })

  if (!template?.enabled) {
    console.log('Password reset email template disabled, skipping')
    return
  }

  const settings = await prisma.setting.findUnique({
    where: { key: 'general' },
  })
  const title = (settings?.value as any)?.title || 'habidat'

  const link = `${env.APP_URL}/set-password?token=${data.token}`

  const html = template.body
    .replace(/\{\{\s*title\s*\}\}/g, title)
    .replace(/\{\{\s*link\s*\}\}/g, link)
    .replace(/\{\{\s*url\s*\}\}/g, env.APP_URL)

  const subject = template.subject.replace(/\{\{\s*title\s*\}\}/g, title)

  await transporter.sendMail({
    from: env.SMTP_FROM,
    to: data.to,
    subject,
    html,
  })
}
```

### 7.6 Adding Jobs from Web App

```typescript
// apps/web/lib/jobs.ts
import { 
  getLdapQueue, 
  getDiscourseQueue, 
  getEmailQueue,
  JOB_NAMES,
} from '@habidat/sync'

// LDAP Jobs
export async function queueLdapCreateUser(userId: string, hashedPassword: string) {
  const queue = getLdapQueue()
  await queue.add(JOB_NAMES.LDAP_CREATE_USER, { userId, hashedPassword })
}

export async function queueLdapUpdateUser(userId: string) {
  const queue = getLdapQueue()
  await queue.add(JOB_NAMES.LDAP_UPDATE_USER, { userId })
}

export async function queueLdapDeleteUser(ldapDn: string, username: string) {
  const queue = getLdapQueue()
  await queue.add(JOB_NAMES.LDAP_DELETE_USER, { ldapDn, username })
}

export async function queueLdapUpdatePassword(userId: string, hashedPassword: string) {
  const queue = getLdapQueue()
  await queue.add(JOB_NAMES.LDAP_UPDATE_PASSWORD, { userId, hashedPassword })
}

export async function queueLdapCreateGroup(groupId: string) {
  const queue = getLdapQueue()
  await queue.add(JOB_NAMES.LDAP_CREATE_GROUP, { groupId })
}

export async function queueLdapUpdateGroup(groupId: string) {
  const queue = getLdapQueue()
  await queue.add(JOB_NAMES.LDAP_UPDATE_GROUP, { groupId })
}

export async function queueLdapDeleteGroup(ldapDn: string, slug: string) {
  const queue = getLdapQueue()
  await queue.add(JOB_NAMES.LDAP_DELETE_GROUP, { ldapDn, slug })
}

// Discourse Jobs
export async function queueDiscourseSyncUser(userId: string) {
  const queue = getDiscourseQueue()
  await queue.add(JOB_NAMES.DISCOURSE_SYNC_USER, { userId })
}

export async function queueDiscourseDeleteUser(username: string) {
  const queue = getDiscourseQueue()
  await queue.add(JOB_NAMES.DISCOURSE_DELETE_USER, { username })
}

export async function queueDiscourseCreateGroup(groupId: string) {
  const queue = getDiscourseQueue()
  await queue.add(JOB_NAMES.DISCOURSE_CREATE_GROUP, { groupId })
}

export async function queueDiscourseUpdateGroup(groupId: string) {
  const queue = getDiscourseQueue()
  await queue.add(JOB_NAMES.DISCOURSE_UPDATE_GROUP, { groupId })
}

export async function queueDiscourseSyncGroupMembers(groupId: string) {
  const queue = getDiscourseQueue()
  await queue.add(JOB_NAMES.DISCOURSE_SYNC_GROUP_MEMBERS, { groupId })
}

// Email Jobs
export async function queueSendInviteEmail(
  to: string, 
  inviteToken: string, 
  inviterName: string
) {
  const queue = getEmailQueue()
  await queue.add(JOB_NAMES.EMAIL_SEND_INVITE, { to, inviteToken, inviterName })
}

export async function queueSendPasswordResetEmail(to: string, token: string) {
  const queue = getEmailQueue()
  await queue.add(JOB_NAMES.EMAIL_SEND_PASSWORD_RESET, { to, token })
}

// Convenience: Queue all sync jobs for a user
export async function queueUserSyncJobs(
  userId: string, 
  options?: { 
    hashedPassword?: string
    isCreate?: boolean 
  }
) {
  if (options?.isCreate && options.hashedPassword) {
    await queueLdapCreateUser(userId, options.hashedPassword)
  } else {
    await queueLdapUpdateUser(userId)
  }
  await queueDiscourseSyncUser(userId)
}

// Convenience: Queue all sync jobs for a group
export async function queueGroupSyncJobs(
  groupId: string,
  options?: { isCreate?: boolean }
) {
  if (options?.isCreate) {
    await queueLdapCreateGroup(groupId)
    await queueDiscourseCreateGroup(groupId)
  } else {
    await queueLdapUpdateGroup(groupId)
    await queueDiscourseUpdateGroup(groupId)
  }
  await queueDiscourseSyncGroupMembers(groupId)
}
```

### 7.7 Worker Package.json

```json
// apps/worker/package.json
{
  "name": "@habidat/worker",
  "version": "0.0.0",
  "private": true,
  "scripts": {
    "dev": "tsx watch src/index.ts",
    "build": "tsup src/index.ts --format cjs --dts",
    "start": "node dist/index.js",
    "typecheck": "tsc --noEmit"
  },
  "dependencies": {
    "@habidat/db": "workspace:*",
    "@habidat/sync": "workspace:*",
    "@habidat/ldap": "workspace:*",
    "@habidat/discourse": "workspace:*",
    "@habidat/env": "workspace:*",
    "bullmq": "^5.0.0",
    "nodemailer": "^6.9.0"
  },
  "devDependencies": {
    "@habidat/typescript-config": "workspace:*",
    "@types/nodemailer": "^6.4.0",
    "tsup": "^8.0.0",
    "tsx": "^4.0.0",
    "typescript": "^5.6.0"
  }
}
```

### 7.8 BullMQ Dashboard (Optional)

For monitoring jobs in development/production, you can add Bull Board:

```typescript
// apps/web/app/api/admin/queues/route.ts
import { createBullBoard } from '@bull-board/api'
import { BullMQAdapter } from '@bull-board/api/bullMQAdapter'
import { ExpressAdapter } from '@bull-board/express'
import { 
  getLdapQueue, 
  getDiscourseQueue, 
  getEmailQueue 
} from '@habidat/sync'
import { requireAdmin } from '@/lib/auth-utils'

// Only accessible by admins
export async function GET(request: Request) {
  await requireAdmin()
  
  const serverAdapter = new ExpressAdapter()
  serverAdapter.setBasePath('/api/admin/queues')

  createBullBoard({
    queues: [
      new BullMQAdapter(getLdapQueue()),
      new BullMQAdapter(getDiscourseQueue()),
      new BullMQAdapter(getEmailQueue()),
    ],
    serverAdapter,
  })

  // Return the Bull Board UI
  return serverAdapter.getRouter()(request)
}
```
```

---

## 8. Authentication System

### 6.1 better-auth Configuration

```typescript
// lib/auth.ts
import { betterAuth } from 'better-auth'
import { prismaAdapter } from 'better-auth/adapters/prisma'
import { prisma } from '@/lib/db'
import { createSyncEvent } from '@/lib/sync/create-sync-event'
import { hashPasswordSsha } from '@/lib/ldap/password'

export const auth = betterAuth({
  database: prismaAdapter(prisma, {
    provider: 'postgresql',
  }),
  
  emailAndPassword: {
    enabled: true,
    requireEmailVerification: false,
    
    // Custom password validation with zxcvbn
    password: {
      validate: async (password) => {
        const zxcvbn = (await import('zxcvbn')).default
        const result = zxcvbn(password)
        if (result.score < 3) {
          return {
            valid: false,
            message: 'Password is too weak. Please use a stronger password.',
          }
        }
        return { valid: true }
      },
    },
  },
  
  session: {
    expiresIn: 60 * 60 * 12, // 12 hours
    updateAge: 60 * 60, // Update session every hour
  },
  
  hooks: {
    after: {
      signUp: async ({ user }) => {
        // Generate LDAP UID number
        const maxUid = await prisma.user.aggregate({
          _max: { ldapUidNumber: true },
        })
        const ldapUidNumber = (maxUid._max.ldapUidNumber || 10000) + 1
        
        // Update user with LDAP fields
        await prisma.user.update({
          where: { id: user.id },
          data: { ldapUidNumber },
        })
        
        // Queue LDAP sync
        await createSyncEvent({
          target: 'LDAP',
          operation: 'CREATE',
          entityType: 'USER',
          entityId: user.id,
          payload: { userId: user.id },
        })
        
        // Queue Discourse sync
        await createSyncEvent({
          target: 'DISCOURSE',
          operation: 'CREATE',
          entityType: 'USER',
          entityId: user.id,
          payload: { userId: user.id },
        })
      },
      
      updateUser: async ({ user }) => {
        // Queue sync events for updates
        await createSyncEvent({
          target: 'LDAP',
          operation: 'UPDATE',
          entityType: 'USER',
          entityId: user.id,
          payload: { userId: user.id },
        })
        
        await createSyncEvent({
          target: 'DISCOURSE',
          operation: 'UPDATE',
          entityType: 'USER',
          entityId: user.id,
          payload: { userId: user.id },
        })
      },
    },
  },
  
  plugins: [
    // Add custom plugins as needed
  ],
})

export type Session = typeof auth.$Infer.Session
```

### 6.2 Auth Route Handler

```typescript
// app/api/auth/[...all]/route.ts
import { auth } from '@/lib/auth'
import { toNextJsHandler } from 'better-auth/next-js'

export const { GET, POST } = toNextJsHandler(auth)
```

### 6.3 Auth Client

```typescript
// lib/auth-client.ts
import { createAuthClient } from 'better-auth/react'

export const authClient = createAuthClient({
  baseURL: process.env.NEXT_PUBLIC_APP_URL,
})

export const { useSession, signIn, signOut, signUp } = authClient
```

### 6.4 Middleware

```typescript
// middleware.ts
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { auth } from '@/lib/auth'

const publicRoutes = [
  '/login',
  '/register',
  '/accept-invite',
  '/reset-password',
  '/set-password',
  '/api/auth',
  '/sso/metadata',
  '/sso/login',
  '/sso/logout',
  '/appmenu',
]

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl
  
  // Allow public routes
  if (publicRoutes.some(route => pathname.startsWith(route))) {
    return NextResponse.next()
  }
  
  // Get session from better-auth
  const session = await auth.api.getSession({
    headers: request.headers,
  })
  
  if (!session) {
    const loginUrl = new URL('/login', request.url)
    loginUrl.searchParams.set('returnTo', pathname)
    return NextResponse.redirect(loginUrl)
  }
  
  return NextResponse.next()
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
}
```

### 6.5 Server-Side Session Access

```typescript
// lib/auth-utils.ts
import { headers } from 'next/headers'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/db'

export async function getCurrentUser() {
  const session = await auth.api.getSession({
    headers: await headers(),
  })
  
  if (!session?.user) {
    return null
  }
  
  // Fetch full user with groups
  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    include: {
      memberships: { include: { group: true } },
      ownerships: { include: { group: true } },
      primaryGroup: true,
    },
  })
  
  return user
}

export async function requireUser() {
  const user = await getCurrentUser()
  if (!user) {
    throw new Error('Unauthorized')
  }
  return user
}

export async function requireAdmin() {
  const user = await requireUser()
  const isAdmin = user.memberships.some(
    m => m.group.slug === 'admin'
  )
  if (!isAdmin) {
    throw new Error('Forbidden')
  }
  return user
}

export async function requireGroupAdmin() {
  const user = await requireUser()
  const isAdmin = user.memberships.some(m => m.group.slug === 'admin')
  const isGroupAdmin = user.ownerships.length > 0
  if (!isAdmin && !isGroupAdmin) {
    throw new Error('Forbidden')
  }
  return user
}
```

---

## 9. Authorization System

### 9.1 Role Definitions

```typescript
// lib/auth/roles.ts
import type { User } from '@prisma/client'

export type UserWithGroups = User & {
  memberships: Array<{ group: { slug: string } }>
  ownerships: Array<{ group: { slug: string; id: string } }>
}

export function isAdmin(user: UserWithGroups): boolean {
  return user.memberships.some(m => m.group.slug === 'admin')
}

export function isGroupAdmin(user: UserWithGroups): boolean {
  return isAdmin(user) || user.ownerships.length > 0
}

export function canManageGroup(user: UserWithGroups, groupId: string): boolean {
  if (isAdmin(user)) return true
  return user.ownerships.some(o => o.group.id === groupId)
}

export function canManageUser(
  actor: UserWithGroups, 
  targetMemberships: Array<{ groupId: string }>
): boolean {
  if (isAdmin(actor)) return true
  
  // Group admin can manage users in their owned groups
  const ownedGroupIds = new Set(actor.ownerships.map(o => o.group.id))
  return targetMemberships.some(m => ownedGroupIds.has(m.groupId))
}
```

### 9.2 Authorization in Server Actions

```typescript
// lib/actions/user-actions.ts
import { createSafeActionClient } from 'next-safe-action'
import { z } from 'zod'
import { requireGroupAdmin, requireAdmin } from '@/lib/auth-utils'
import { canManageUser } from '@/lib/auth/roles'
import { prisma } from '@/lib/db'

const actionClient = createSafeActionClient()

const updateUserSchema = z.object({
  userId: z.string().cuid(),
  name: z.string().min(2),
  location: z.string().optional(),
  preferredLanguage: z.string(),
})

export const updateUserAction = actionClient
  .schema(updateUserSchema)
  .action(async ({ parsedInput }) => {
    const actor = await requireGroupAdmin()
    
    const targetUser = await prisma.user.findUniqueOrThrow({
      where: { id: parsedInput.userId },
      include: { memberships: true },
    })
    
    if (!canManageUser(actor, targetUser.memberships)) {
      throw new Error('You do not have permission to edit this user')
    }
    
    const user = await prisma.user.update({
      where: { id: parsedInput.userId },
      data: {
        name: parsedInput.name,
        location: parsedInput.location,
        preferredLanguage: parsedInput.preferredLanguage,
      },
    })
    
    // Audit log
    await prisma.auditLog.create({
      data: {
        actorId: actor.id,
        action: 'UPDATE',
        entityType: 'USER',
        entityId: user.id,
        oldValue: targetUser,
        newValue: user,
      },
    })
    
    return { user }
  })
```

---

## 10. SAML Identity Provider

### 10.1 SAML Configuration

```typescript
// lib/saml/config.ts
import * as saml from '@node-saml/node-saml'
import { env } from '@/lib/env'

export function createIdentityProvider() {
  return {
    privateKey: env.SAML_PRIVATE_KEY,
    certificate: env.SAML_CERTIFICATE,
    entityId: `${env.APP_URL}/sso/metadata`,
    ssoUrl: `${env.APP_URL}/sso/login`,
    sloUrl: `${env.APP_URL}/sso/logout`,
    nameIdFormat: 'urn:oasis:names:tc:SAML:1.1:nameid-format:emailAddress',
    signatureAlgorithm: 'sha256',
    assertionLifetimeMs: 5 * 60 * 1000, // 5 minutes
  }
}

export function createServiceProvider(app: App) {
  return {
    entityId: app.samlEntityId,
    assertionConsumerServiceUrl: app.samlAcsUrl,
    singleLogoutServiceUrl: app.samlSloUrl,
    certificate: app.samlCertificate,
  }
}
```

### 10.2 SAML Endpoints

```typescript
// app/sso/metadata/route.ts
import { NextResponse } from 'next/server'
import { createIdentityProvider } from '@/lib/saml/config'
import { generateMetadata } from '@/lib/saml/metadata'

export async function GET() {
  const idp = createIdentityProvider()
  const metadata = generateMetadata(idp)
  
  return new NextResponse(metadata, {
    headers: {
      'Content-Type': 'application/xml',
    },
  })
}

// app/sso/login/[appSlug]/route.ts
import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { getCurrentUser } from '@/lib/auth-utils'
import { createSamlResponse } from '@/lib/saml/response'
import { canAccessApp } from '@/lib/auth/app-access'

export async function GET(
  request: Request,
  { params }: { params: { appSlug: string } }
) {
  const searchParams = new URL(request.url).searchParams
  const samlRequest = searchParams.get('SAMLRequest')
  const relayState = searchParams.get('RelayState')
  
  const app = await prisma.app.findUnique({
    where: { slug: params.appSlug },
    include: { groupAccess: true },
  })
  
  if (!app?.samlEnabled) {
    return NextResponse.json({ error: 'App not found' }, { status: 404 })
  }
  
  const user = await getCurrentUser()
  
  if (!user) {
    // Redirect to login with return URL
    const loginUrl = new URL('/login', request.url)
    loginUrl.searchParams.set('samlApp', params.appSlug)
    if (samlRequest) loginUrl.searchParams.set('SAMLRequest', samlRequest)
    if (relayState) loginUrl.searchParams.set('RelayState', relayState)
    return NextResponse.redirect(loginUrl)
  }
  
  // Check authorization
  if (!canAccessApp(user, app)) {
    return NextResponse.redirect(new URL('/unauthorized', request.url))
  }
  
  // Generate SAML response
  const samlResponse = await createSamlResponse({
    user,
    app,
    requestId: samlRequest ? parseSamlRequest(samlRequest).id : undefined,
  })
  
  // Track SAML session for SLO
  const session = await getCurrentSession()
  await prisma.samlSessionApp.upsert({
    where: {
      sessionId_appId: { sessionId: session.id, appId: app.id },
    },
    update: { nameId: user.email },
    create: {
      sessionId: session.id,
      appId: app.id,
      nameId: user.email,
    },
  })
  
  // Return auto-submit form
  return new NextResponse(
    generateSamlPostForm(app.samlAcsUrl, samlResponse, relayState),
    { headers: { 'Content-Type': 'text/html' } }
  )
}
```

### 10.3 Single Logout

```typescript
// app/sso/logout/[appSlug]/route.ts
import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { getCurrentSession } from '@/lib/auth-utils'
import { createLogoutRequest, createLogoutResponse } from '@/lib/saml/logout'

export async function GET(
  request: Request,
  { params }: { params: { appSlug: string } }
) {
  const searchParams = new URL(request.url).searchParams
  const samlRequest = searchParams.get('SAMLRequest')
  const samlResponse = searchParams.get('SAMLResponse')
  
  if (samlRequest) {
    // SP-initiated logout
    return handleLogoutRequest(request, params.appSlug, samlRequest)
  }
  
  if (samlResponse) {
    // Response from SP after logout
    return handleLogoutResponse(request, params.appSlug, samlResponse)
  }
  
  // IdP-initiated logout - start logout flow
  return initiateLogoutFlow(request)
}

async function initiateLogoutFlow(request: Request) {
  const session = await getCurrentSession()
  
  // Get all apps the user logged into
  const samlApps = await prisma.samlSessionApp.findMany({
    where: { sessionId: session.id },
    include: { app: true },
  })
  
  if (samlApps.length === 0) {
    // No SAML apps, just destroy session
    await auth.api.signOut({ headers: request.headers })
    return NextResponse.redirect(new URL('/login', request.url))
  }
  
  // Send logout request to first app
  const firstApp = samlApps[0]
  const logoutRequest = await createLogoutRequest({
    app: firstApp.app,
    nameId: firstApp.nameId,
  })
  
  return NextResponse.redirect(
    `${firstApp.app.samlSloUrl}?SAMLRequest=${encodeURIComponent(logoutRequest)}`
  )
}
```

---

## 11. User Management

### 11.1 User Actions

```typescript
// lib/actions/user-actions.ts
import { createSafeActionClient } from 'next-safe-action'
import { z } from 'zod'
import { prisma } from '@/lib/db'
import { requireGroupAdmin, requireAdmin } from '@/lib/auth-utils'
import { canManageUser, canManageGroup } from '@/lib/auth/roles'
import { createSyncEvent } from '@/lib/sync/create-sync-event'
import { createAuditLog } from '@/lib/audit'
import { revalidatePath } from 'next/cache'

const actionClient = createSafeActionClient()

// Schema definitions
const createUserSchema = z.object({
  name: z.string().min(2, 'Name must be at least 2 characters'),
  username: z.string()
    .min(3, 'Username must be at least 3 characters')
    .regex(/^[a-zA-Z0-9_-]+$/, 'Username can only contain letters, numbers, underscores, and hyphens'),
  email: z.string().email('Invalid email address'),
  password: z.string().min(8, 'Password must be at least 8 characters'),
  location: z.string().optional(),
  preferredLanguage: z.string().default('de'),
  storageQuota: z.string().default('1 GB'),
  memberGroupIds: z.array(z.string().cuid()),
  ownerGroupIds: z.array(z.string().cuid()).optional(),
})

const updateProfileSchema = z.object({
  name: z.string().min(2),
  location: z.string().optional(),
  preferredLanguage: z.string(),
  primaryGroupId: z.string().cuid().optional(),
})

// Create user action
export const createUserAction = actionClient
  .schema(createUserSchema)
  .action(async ({ parsedInput }) => {
    const actor = await requireGroupAdmin()
    
    // Verify actor can add to all specified groups
    for (const groupId of parsedInput.memberGroupIds) {
      if (!canManageGroup(actor, groupId)) {
        throw new Error(`You cannot add users to group ${groupId}`)
      }
    }
    
    // Check uniqueness
    const existing = await prisma.user.findFirst({
      where: {
        OR: [
          { username: parsedInput.username },
          { email: parsedInput.email },
        ],
      },
    })
    if (existing) {
      throw new Error('Username or email already exists')
    }
    
    // Generate LDAP UID number
    const maxUid = await prisma.user.aggregate({
      _max: { ldapUidNumber: true },
    })
    const ldapUidNumber = (maxUid._max.ldapUidNumber || 10000) + 1
    
    // Create user with groups
    const user = await prisma.$transaction(async (tx) => {
      // Create user
      const newUser = await tx.user.create({
        data: {
          name: parsedInput.name,
          username: parsedInput.username,
          email: parsedInput.email,
          location: parsedInput.location,
          preferredLanguage: parsedInput.preferredLanguage,
          storageQuota: parsedInput.storageQuota,
          ldapUidNumber,
          primaryGroupId: parsedInput.memberGroupIds[0],
        },
      })
      
      // Create password via better-auth
      await tx.account.create({
        data: {
          userId: newUser.id,
          accountId: newUser.id,
          providerId: 'credential',
          password: await hashPassword(parsedInput.password),
        },
      })
      
      // Create memberships
      await tx.groupMembership.createMany({
        data: parsedInput.memberGroupIds.map(groupId => ({
          userId: newUser.id,
          groupId,
        })),
      })
      
      // Create ownerships
      if (parsedInput.ownerGroupIds?.length) {
        await tx.groupOwnership.createMany({
          data: parsedInput.ownerGroupIds.map(groupId => ({
            userId: newUser.id,
            groupId,
          })),
        })
      }
      
      // Queue sync events
      await createSyncEvent(tx, {
        target: 'LDAP',
        operation: 'CREATE',
        entityType: 'USER',
        entityId: newUser.id,
        payload: {
          userId: newUser.id,
          hashedPassword: hashPasswordSsha(parsedInput.password),
        },
      })
      
      await createSyncEvent(tx, {
        target: 'DISCOURSE',
        operation: 'CREATE',
        entityType: 'USER',
        entityId: newUser.id,
        payload: { userId: newUser.id },
      })
      
      return newUser
    })
    
    await createAuditLog({
      actorId: actor.id,
      action: 'CREATE',
      entityType: 'USER',
      entityId: user.id,
      newValue: user,
    })
    
    revalidatePath('/users')
    return { user }
  })

// Update profile action (self)
export const updateProfileAction = actionClient
  .schema(updateProfileSchema)
  .action(async ({ parsedInput }) => {
    const actor = await requireUser()
    
    const oldUser = await prisma.user.findUniqueOrThrow({
      where: { id: actor.id },
    })
    
    const user = await prisma.$transaction(async (tx) => {
      const updated = await tx.user.update({
        where: { id: actor.id },
        data: {
          name: parsedInput.name,
          location: parsedInput.location,
          preferredLanguage: parsedInput.preferredLanguage,
          primaryGroupId: parsedInput.primaryGroupId,
        },
      })
      
      await createSyncEvent(tx, {
        target: 'LDAP',
        operation: 'UPDATE',
        entityType: 'USER',
        entityId: updated.id,
        payload: { userId: updated.id },
      })
      
      await createSyncEvent(tx, {
        target: 'DISCOURSE',
        operation: 'UPDATE',
        entityType: 'USER',
        entityId: updated.id,
        payload: { userId: updated.id },
      })
      
      return updated
    })
    
    await createAuditLog({
      actorId: actor.id,
      action: 'UPDATE',
      entityType: 'USER',
      entityId: user.id,
      oldValue: oldUser,
      newValue: user,
    })
    
    revalidatePath('/')
    return { user }
  })

// Delete user action
export const deleteUserAction = actionClient
  .schema(z.object({ userId: z.string().cuid() }))
  .action(async ({ parsedInput }) => {
    const actor = await requireGroupAdmin()
    
    const user = await prisma.user.findUniqueOrThrow({
      where: { id: parsedInput.userId },
      include: { memberships: true },
    })
    
    if (!canManageUser(actor, user.memberships)) {
      throw new Error('You do not have permission to delete this user')
    }
    
    await prisma.$transaction(async (tx) => {
      // Queue sync events first (need user data)
      await createSyncEvent(tx, {
        target: 'LDAP',
        operation: 'DELETE',
        entityType: 'USER',
        entityId: user.id,
        payload: { ldapDn: user.ldapDn, username: user.username },
      })
      
      await createSyncEvent(tx, {
        target: 'DISCOURSE',
        operation: 'DELETE',
        entityType: 'USER',
        entityId: user.id,
        payload: { username: user.username },
      })
      
      // Delete user (cascades to memberships, ownerships)
      await tx.user.delete({ where: { id: user.id } })
    })
    
    await createAuditLog({
      actorId: actor.id,
      action: 'DELETE',
      entityType: 'USER',
      entityId: user.id,
      oldValue: user,
    })
    
    revalidatePath('/users')
    return { success: true }
  })
```

### 11.2 Password Management

```typescript
// lib/actions/password-actions.ts
import { z } from 'zod'
import { createSafeActionClient } from 'next-safe-action'
import { requireUser, requireAdmin } from '@/lib/auth-utils'
import { auth } from '@/lib/auth'
import { validatePasswordStrength } from '@/lib/password'
import { createSyncEvent } from '@/lib/sync/create-sync-event'

const actionClient = createSafeActionClient()

const changePasswordSchema = z.object({
  currentPassword: z.string(),
  newPassword: z.string().min(8),
})

const setPasswordSchema = z.object({
  token: z.string(),
  password: z.string().min(8),
})

const adminChangePasswordSchema = z.object({
  userId: z.string().cuid(),
  newPassword: z.string().min(8),
})

export const changePasswordAction = actionClient
  .schema(changePasswordSchema)
  .action(async ({ parsedInput }) => {
    const user = await requireUser()
    
    // Validate password strength
    const strength = validatePasswordStrength(parsedInput.newPassword)
    if (!strength.valid) {
      throw new Error(strength.message)
    }
    
    // Verify current password
    const isValid = await auth.api.verifyPassword({
      userId: user.id,
      password: parsedInput.currentPassword,
    })
    if (!isValid) {
      throw new Error('Current password is incorrect')
    }
    
    // Update password
    await auth.api.updatePassword({
      userId: user.id,
      password: parsedInput.newPassword,
    })
    
    // Queue LDAP sync
    await createSyncEvent({
      target: 'LDAP',
      operation: 'UPDATE',
      entityType: 'USER',
      entityId: user.id,
      payload: {
        userId: user.id,
        hashedPassword: hashPasswordSsha(parsedInput.newPassword),
      },
    })
    
    return { success: true }
  })

export const adminChangePasswordAction = actionClient
  .schema(adminChangePasswordSchema)
  .action(async ({ parsedInput }) => {
    await requireAdmin()
    
    const strength = validatePasswordStrength(parsedInput.newPassword)
    if (!strength.valid) {
      throw new Error(strength.message)
    }
    
    await auth.api.updatePassword({
      userId: parsedInput.userId,
      password: parsedInput.newPassword,
    })
    
    await createSyncEvent({
      target: 'LDAP',
      operation: 'UPDATE',
      entityType: 'USER',
      entityId: parsedInput.userId,
      payload: {
        userId: parsedInput.userId,
        hashedPassword: hashPasswordSsha(parsedInput.newPassword),
      },
    })
    
    return { success: true }
  })
```

---

## 12. Group Management

### 12.1 Group Actions

```typescript
// lib/actions/group-actions.ts
import { createSafeActionClient } from 'next-safe-action'
import { z } from 'zod'
import { prisma } from '@/lib/db'
import { requireAdmin, requireGroupAdmin } from '@/lib/auth-utils'
import { canManageGroup, isAdmin } from '@/lib/auth/roles'
import { createSyncEvent } from '@/lib/sync/create-sync-event'
import { createAuditLog } from '@/lib/audit'
import { revalidatePath } from 'next/cache'

const actionClient = createSafeActionClient()

const createGroupSchema = z.object({
  name: z.string().min(3, 'Name must be at least 3 characters'),
  slug: z.string()
    .min(3, 'Slug must be at least 3 characters')
    .regex(/^[a-zA-Z0-9_-]+$/, 'Slug can only contain letters, numbers, underscores, and hyphens'),
  description: z.string().min(1, 'Description is required'),
  memberUserIds: z.array(z.string().cuid()).optional(),
  ownerUserIds: z.array(z.string().cuid()).optional(),
  parentGroupIds: z.array(z.string().cuid()).optional(),
  childGroupIds: z.array(z.string().cuid()).optional(),
})

const updateGroupSchema = createGroupSchema.extend({
  id: z.string().cuid(),
})

// Create group (admin only)
export const createGroupAction = actionClient
  .schema(createGroupSchema)
  .action(async ({ parsedInput }) => {
    const actor = await requireAdmin()
    
    // Check slug uniqueness
    const existing = await prisma.group.findUnique({
      where: { slug: parsedInput.slug },
    })
    if (existing) {
      throw new Error('Group slug already exists')
    }
    
    const group = await prisma.$transaction(async (tx) => {
      // Create group
      const newGroup = await tx.group.create({
        data: {
          name: parsedInput.name,
          slug: parsedInput.slug,
          description: parsedInput.description,
        },
      })
      
      // Add members
      if (parsedInput.memberUserIds?.length) {
        await tx.groupMembership.createMany({
          data: parsedInput.memberUserIds.map(userId => ({
            groupId: newGroup.id,
            userId,
          })),
        })
      }
      
      // Add owners
      if (parsedInput.ownerUserIds?.length) {
        await tx.groupOwnership.createMany({
          data: parsedInput.ownerUserIds.map(userId => ({
            groupId: newGroup.id,
            userId,
          })),
        })
        
        // Auto-add owners to groupadmin group
        await syncGroupAdminMembership(tx, parsedInput.ownerUserIds)
      }
      
      // Create hierarchy relationships
      if (parsedInput.parentGroupIds?.length) {
        await tx.groupHierarchy.createMany({
          data: parsedInput.parentGroupIds.map(parentId => ({
            parentGroupId: parentId,
            childGroupId: newGroup.id,
          })),
        })
      }
      
      if (parsedInput.childGroupIds?.length) {
        await tx.groupHierarchy.createMany({
          data: parsedInput.childGroupIds.map(childId => ({
            parentGroupId: newGroup.id,
            childGroupId: childId,
          })),
        })
      }
      
      // Queue sync events
      await createSyncEvent(tx, {
        target: 'LDAP',
        operation: 'CREATE',
        entityType: 'GROUP',
        entityId: newGroup.id,
        payload: { groupId: newGroup.id },
      })
      
      await createSyncEvent(tx, {
        target: 'DISCOURSE',
        operation: 'CREATE',
        entityType: 'GROUP',
        entityId: newGroup.id,
        payload: { groupId: newGroup.id },
      })
      
      return newGroup
    })
    
    await createAuditLog({
      actorId: actor.id,
      action: 'CREATE',
      entityType: 'GROUP',
      entityId: group.id,
      newValue: group,
    })
    
    revalidatePath('/groups')
    return { group }
  })

// Update group
export const updateGroupAction = actionClient
  .schema(updateGroupSchema)
  .action(async ({ parsedInput }) => {
    const actor = await requireGroupAdmin()
    
    if (!canManageGroup(actor, parsedInput.id)) {
      throw new Error('You do not have permission to edit this group')
    }
    
    const group = await prisma.group.findUniqueOrThrow({
      where: { id: parsedInput.id },
      include: {
        memberships: true,
        ownerships: true,
        parentGroups: true,
        childGroups: true,
      },
    })
    
    // Group admins can only edit members/owners, not hierarchy
    const isAdminUser = isAdmin(actor)
    
    const updated = await prisma.$transaction(async (tx) => {
      // Update basic info
      const updatedGroup = await tx.group.update({
        where: { id: parsedInput.id },
        data: {
          name: parsedInput.name,
          description: parsedInput.description,
          // Slug change only for admins
          ...(isAdminUser && { slug: parsedInput.slug }),
        },
      })
      
      // Update members
      if (parsedInput.memberUserIds !== undefined) {
        await tx.groupMembership.deleteMany({
          where: { groupId: parsedInput.id },
        })
        if (parsedInput.memberUserIds.length > 0) {
          await tx.groupMembership.createMany({
            data: parsedInput.memberUserIds.map(userId => ({
              groupId: parsedInput.id,
              userId,
            })),
          })
        }
      }
      
      // Update owners
      if (parsedInput.ownerUserIds !== undefined) {
        const oldOwnerIds = group.ownerships.map(o => o.userId)
        
        await tx.groupOwnership.deleteMany({
          where: { groupId: parsedInput.id },
        })
        if (parsedInput.ownerUserIds.length > 0) {
          await tx.groupOwnership.createMany({
            data: parsedInput.ownerUserIds.map(userId => ({
              groupId: parsedInput.id,
              userId,
            })),
          })
        }
        
        // Sync groupadmin membership
        const allAffectedUsers = [...new Set([...oldOwnerIds, ...parsedInput.ownerUserIds])]
        await syncGroupAdminMembership(tx, allAffectedUsers)
      }
      
      // Update hierarchy (admin only)
      if (isAdminUser) {
        if (parsedInput.parentGroupIds !== undefined) {
          await tx.groupHierarchy.deleteMany({
            where: { childGroupId: parsedInput.id },
          })
          if (parsedInput.parentGroupIds.length > 0) {
            await tx.groupHierarchy.createMany({
              data: parsedInput.parentGroupIds.map(parentId => ({
                parentGroupId: parentId,
                childGroupId: parsedInput.id,
              })),
            })
          }
        }
        
        if (parsedInput.childGroupIds !== undefined) {
          await tx.groupHierarchy.deleteMany({
            where: { parentGroupId: parsedInput.id },
          })
          if (parsedInput.childGroupIds.length > 0) {
            await tx.groupHierarchy.createMany({
              data: parsedInput.childGroupIds.map(childId => ({
                parentGroupId: parsedInput.id,
                childGroupId: childId,
              })),
            })
          }
        }
      }
      
      // Queue sync events
      await createSyncEvent(tx, {
        target: 'LDAP',
        operation: 'UPDATE',
        entityType: 'GROUP',
        entityId: updatedGroup.id,
        payload: { groupId: updatedGroup.id },
      })
      
      await createSyncEvent(tx, {
        target: 'DISCOURSE',
        operation: 'SYNC_GROUPS',
        entityType: 'GROUP',
        entityId: updatedGroup.id,
        payload: { groupId: updatedGroup.id },
      })
      
      return updatedGroup
    })
    
    await createAuditLog({
      actorId: actor.id,
      action: 'UPDATE',
      entityType: 'GROUP',
      entityId: updated.id,
      oldValue: group,
      newValue: updated,
    })
    
    revalidatePath('/groups')
    return { group: updated }
  })

// Helper: Sync groupadmin membership
async function syncGroupAdminMembership(
  tx: PrismaTransaction,
  userIds: string[]
) {
  const groupadmin = await tx.group.findUnique({
    where: { slug: 'groupadmin' },
  })
  if (!groupadmin) return
  
  for (const userId of userIds) {
    // Check if user owns any groups
    const ownsGroups = await tx.groupOwnership.count({
      where: { userId },
    }) > 0
    
    if (ownsGroups) {
      // Ensure membership
      await tx.groupMembership.upsert({
        where: {
          userId_groupId: { userId, groupId: groupadmin.id },
        },
        update: {},
        create: { userId, groupId: groupadmin.id },
      })
    } else {
      // Remove membership
      await tx.groupMembership.deleteMany({
        where: { userId, groupId: groupadmin.id },
      })
    }
  }
}
```

### 12.2 Group Tree Query

```typescript
// lib/queries/groups.ts
import { prisma } from '@/lib/db'

export async function getGroupTree() {
  const groups = await prisma.group.findMany({
    include: {
      memberships: {
        include: { user: { select: { id: true, name: true, username: true } } },
      },
      ownerships: {
        include: { user: { select: { id: true, name: true, username: true } } },
      },
      parentGroups: {
        include: { parentGroup: { select: { id: true, name: true, slug: true } } },
      },
      childGroups: {
        include: { childGroup: { select: { id: true, name: true, slug: true } } },
      },
    },
    orderBy: { name: 'asc' },
  })
  
  // Build tree structure
  const groupMap = new Map(groups.map(g => [g.id, g]))
  const rootGroups = groups.filter(g => g.parentGroups.length === 0)
  
  function buildTree(group: typeof groups[0]): GroupTreeNode {
    return {
      ...group,
      children: group.childGroups
        .map(c => groupMap.get(c.childGroupId))
        .filter(Boolean)
        .map(buildTree),
    }
  }
  
  return rootGroups.map(buildTree)
}

// Get effective members (including subgroup members recursively)
export async function getEffectiveGroupMembers(groupId: string): Promise<string[]> {
  const memberIds = new Set<string>()
  
  async function collectMembers(gId: string) {
    const group = await prisma.group.findUnique({
      where: { id: gId },
      include: {
        memberships: { select: { userId: true } },
        childGroups: { select: { childGroupId: true } },
      },
    })
    
    if (!group) return
    
    // Add direct members
    group.memberships.forEach(m => memberIds.add(m.userId))
    
    // Recursively add subgroup members
    for (const child of group.childGroups) {
      await collectMembers(child.childGroupId)
    }
  }
  
  await collectMembers(groupId)
  return Array.from(memberIds)
}
```

---

## 13. Invitation System

### 13.1 Invitation Actions

```typescript
// lib/actions/invite-actions.ts
import { createSafeActionClient } from 'next-safe-action'
import { z } from 'zod'
import { prisma } from '@/lib/db'
import { requireGroupAdmin } from '@/lib/auth-utils'
import { canManageGroup } from '@/lib/auth/roles'
import { sendInviteEmail } from '@/lib/email/templates'
import { createAuditLog } from '@/lib/audit'
import { addDays } from 'date-fns'
import { revalidatePath } from 'next/cache'

const actionClient = createSafeActionClient()

const createInviteSchema = z.object({
  email: z.string().email(),
  memberGroupIds: z.array(z.string().cuid()).min(1),
  ownerGroupIds: z.array(z.string().cuid()).optional(),
})

export const createInviteAction = actionClient
  .schema(createInviteSchema)
  .action(async ({ parsedInput }) => {
    const actor = await requireGroupAdmin()
    
    // Verify actor can add to all specified groups
    for (const groupId of parsedInput.memberGroupIds) {
      if (!canManageGroup(actor, groupId)) {
        throw new Error(`You cannot invite users to group ${groupId}`)
      }
    }
    
    // Check if email already has pending invite
    const existingInvite = await prisma.invite.findFirst({
      where: {
        email: parsedInput.email,
        expiresAt: { gt: new Date() },
      },
    })
    if (existingInvite) {
      throw new Error('An invitation already exists for this email')
    }
    
    // Check if user already exists
    const existingUser = await prisma.user.findUnique({
      where: { email: parsedInput.email },
    })
    if (existingUser) {
      throw new Error('A user with this email already exists')
    }
    
    const invite = await prisma.invite.create({
      data: {
        email: parsedInput.email,
        expiresAt: addDays(new Date(), 7),
        createdById: actor.id,
        memberGroups: {
          create: parsedInput.memberGroupIds.map(groupId => ({ groupId })),
        },
        ownerGroups: {
          create: (parsedInput.ownerGroupIds || []).map(groupId => ({ groupId })),
        },
      },
      include: {
        memberGroups: true,
        ownerGroups: true,
      },
    })
    
    // Send email
    await sendInviteEmail({
      to: parsedInput.email,
      inviteToken: invite.token,
      inviterName: actor.name,
    })
    
    await createAuditLog({
      actorId: actor.id,
      action: 'CREATE',
      entityType: 'INVITE',
      entityId: invite.id,
      newValue: { email: invite.email, groups: parsedInput.memberGroupIds },
    })
    
    revalidatePath('/invites')
    return { invite }
  })

export const acceptInviteAction = actionClient
  .schema(z.object({
    token: z.string(),
    name: z.string().min(2),
    username: z.string().min(3).regex(/^[a-zA-Z0-9_-]+$/),
    password: z.string().min(8),
  }))
  .action(async ({ parsedInput }) => {
    const invite = await prisma.invite.findUnique({
      where: { token: parsedInput.token },
      include: {
        memberGroups: true,
        ownerGroups: true,
      },
    })
    
    if (!invite || invite.expiresAt < new Date()) {
      throw new Error('Invalid or expired invitation')
    }
    
    // Validate password strength
    const strength = validatePasswordStrength(parsedInput.password)
    if (!strength.valid) {
      throw new Error(strength.message)
    }
    
    // Check uniqueness
    const existing = await prisma.user.findFirst({
      where: {
        OR: [
          { username: parsedInput.username },
          { email: invite.email },
        ],
      },
    })
    if (existing) {
      throw new Error('Username or email already exists')
    }
    
    // Generate LDAP UID
    const maxUid = await prisma.user.aggregate({
      _max: { ldapUidNumber: true },
    })
    const ldapUidNumber = (maxUid._max.ldapUidNumber || 10000) + 1
    
    const user = await prisma.$transaction(async (tx) => {
      // Create user
      const newUser = await tx.user.create({
        data: {
          name: parsedInput.name,
          username: parsedInput.username,
          email: invite.email,
          ldapUidNumber,
          primaryGroupId: invite.memberGroups[0]?.groupId,
        },
      })
      
      // Create password
      await tx.account.create({
        data: {
          userId: newUser.id,
          accountId: newUser.id,
          providerId: 'credential',
          password: await hashPassword(parsedInput.password),
        },
      })
      
      // Create memberships from invite
      await tx.groupMembership.createMany({
        data: invite.memberGroups.map(mg => ({
          userId: newUser.id,
          groupId: mg.groupId,
        })),
      })
      
      // Create ownerships from invite
      if (invite.ownerGroups.length > 0) {
        await tx.groupOwnership.createMany({
          data: invite.ownerGroups.map(og => ({
            userId: newUser.id,
            groupId: og.groupId,
          })),
        })
        
        // Sync groupadmin membership
        await syncGroupAdminMembership(tx, [newUser.id])
      }
      
      // Delete invite
      await tx.invite.delete({ where: { id: invite.id } })
      
      // Queue sync events
      await createSyncEvent(tx, {
        target: 'LDAP',
        operation: 'CREATE',
        entityType: 'USER',
        entityId: newUser.id,
        payload: {
          userId: newUser.id,
          hashedPassword: hashPasswordSsha(parsedInput.password),
        },
      })
      
      await createSyncEvent(tx, {
        target: 'DISCOURSE',
        operation: 'CREATE',
        entityType: 'USER',
        entityId: newUser.id,
        payload: { userId: newUser.id },
      })
      
      return newUser
    })
    
    await createAuditLog({
      actorId: user.id,
      action: 'CREATE',
      entityType: 'USER',
      entityId: user.id,
      newValue: user,
      metadata: { via: 'invite', inviteId: invite.id },
    })
    
    return { user }
  })

export const deleteInvitesAction = actionClient
  .schema(z.object({ inviteIds: z.array(z.string().cuid()) }))
  .action(async ({ parsedInput }) => {
    const actor = await requireGroupAdmin()
    
    // Verify permissions for each invite
    const invites = await prisma.invite.findMany({
      where: { id: { in: parsedInput.inviteIds } },
      include: { memberGroups: true },
    })
    
    for (const invite of invites) {
      const canDelete = invite.memberGroups.some(mg =>
        canManageGroup(actor, mg.groupId)
      )
      if (!canDelete) {
        throw new Error(`Cannot delete invite ${invite.id}`)
      }
    }
    
    await prisma.invite.deleteMany({
      where: { id: { in: parsedInput.inviteIds } },
    })
    
    for (const invite of invites) {
      await createAuditLog({
        actorId: actor.id,
        action: 'DELETE',
        entityType: 'INVITE',
        entityId: invite.id,
        oldValue: { email: invite.email },
      })
    }
    
    revalidatePath('/invites')
    return { success: true }
  })

export const resendInvitesAction = actionClient
  .schema(z.object({ inviteIds: z.array(z.string().cuid()) }))
  .action(async ({ parsedInput }) => {
    const actor = await requireGroupAdmin()
    
    const invites = await prisma.invite.findMany({
      where: { id: { in: parsedInput.inviteIds } },
      include: { memberGroups: true },
    })
    
    for (const invite of invites) {
      const canResend = invite.memberGroups.some(mg =>
        canManageGroup(actor, mg.groupId)
      )
      if (!canResend) {
        throw new Error(`Cannot resend invite ${invite.id}`)
      }
      
      // Extend expiration
      await prisma.invite.update({
        where: { id: invite.id },
        data: { expiresAt: addDays(new Date(), 7) },
      })
      
      // Send email
      await sendInviteEmail({
        to: invite.email,
        inviteToken: invite.token,
        inviterName: actor.name,
      })
    }
    
    revalidatePath('/invites')
    return { success: true }
  })
```

---

## 14. External Integrations

### 14.1 Integration Configuration

```typescript
// lib/integrations/config.ts
import { z } from 'zod'

export const integrationConfigSchema = z.object({
  ldap: z.object({
    enabled: z.boolean().default(true),
    url: z.string().url(),
    bindDn: z.string(),
    bindPassword: z.string(),
    baseDn: z.string(),
    usersDn: z.string(),
    groupsDn: z.string(),
  }),
  discourse: z.object({
    enabled: z.boolean().default(true),
    url: z.string().url(),
    apiKey: z.string(),
    apiUsername: z.string(),
    ssoSecret: z.string(),
  }),
  smtp: z.object({
    host: z.string(),
    port: z.number(),
    secure: z.boolean().default(false),
    auth: z.object({
      user: z.string(),
      pass: z.string(),
    }).optional(),
    from: z.string().email(),
  }),
})

export type IntegrationConfig = z.infer<typeof integrationConfigSchema>
```

### 14.2 LDAP Integration

```typescript
// lib/integrations/ldap/client.ts
import LdapClient from 'ldapjs-client'
import { env } from '@/lib/env'

export class LdapIntegration {
  private client: LdapClient
  
  async connect() {
    this.client = new LdapClient({ url: env.LDAP_URL })
    await this.client.bind(env.LDAP_BIND_DN, env.LDAP_BIND_PASSWORD)
  }
  
  async disconnect() {
    await this.client.unbind()
  }
  
  // User operations
  async createUser(user: UserSyncPayload) {
    const dn = `uid=${user.username},${env.LDAP_USERS_DN}`
    await this.client.add(dn, {
      objectClass: ['inetOrgPerson', 'posixAccount', 'organizationalPerson'],
      uid: user.username,
      cn: user.name,
      mail: user.email,
      l: user.location || '',
      preferredLanguage: user.preferredLanguage,
      description: user.storageQuota,
      uidNumber: user.ldapUidNumber,
      gidNumber: 500,
      homeDirectory: `/home/${user.username}`,
      userPassword: user.hashedPassword,
    })
    return dn
  }
  
  async updateUser(dn: string, changes: Partial<UserSyncPayload>) {
    const modifications = []
    
    if (changes.name) {
      modifications.push({
        operation: 'replace',
        modification: { cn: changes.name },
      })
    }
    if (changes.email) {
      modifications.push({
        operation: 'replace',
        modification: { mail: changes.email },
      })
    }
    // ... other fields
    
    if (modifications.length > 0) {
      await this.client.modify(dn, modifications)
    }
  }
  
  async deleteUser(dn: string) {
    await this.client.del(dn)
  }
  
  async updatePassword(dn: string, hashedPassword: string) {
    await this.client.modify(dn, {
      operation: 'replace',
      modification: { userPassword: hashedPassword },
    })
  }
  
  // Group operations
  async createGroup(group: GroupSyncPayload) {
    const dn = `cn=${group.slug},${env.LDAP_GROUPS_DN}`
    await this.client.add(dn, {
      objectClass: 'groupOfNames',
      cn: group.slug,
      o: group.name,
      description: group.description,
      member: group.memberDns.length > 0 ? group.memberDns : [''],
    })
    return dn
  }
  
  async updateGroup(dn: string, changes: Partial<GroupSyncPayload>) {
    const modifications = []
    
    if (changes.name) {
      modifications.push({
        operation: 'replace',
        modification: { o: changes.name },
      })
    }
    if (changes.description) {
      modifications.push({
        operation: 'replace',
        modification: { description: changes.description },
      })
    }
    if (changes.memberDns) {
      modifications.push({
        operation: 'replace',
        modification: { member: changes.memberDns.length > 0 ? changes.memberDns : [''] },
      })
    }
    
    if (modifications.length > 0) {
      await this.client.modify(dn, modifications)
    }
  }
  
  async deleteGroup(dn: string) {
    await this.client.del(dn)
  }
}
```

### 14.3 Discourse Integration

```typescript
// lib/integrations/discourse/client.ts
import { createHmac } from 'crypto'
import { env } from '@/lib/env'

export class DiscourseIntegration {
  private baseUrl: string
  private apiKey: string
  private apiUsername: string
  private ssoSecret: string
  
  constructor() {
    this.baseUrl = env.DISCOURSE_URL
    this.apiKey = env.DISCOURSE_API_KEY
    this.apiUsername = env.DISCOURSE_API_USERNAME
    this.ssoSecret = env.DISCOURSE_SSO_SECRET
  }
  
  private async request<T>(
    path: string,
    options: RequestInit = {}
  ): Promise<T> {
    const response = await fetch(`${this.baseUrl}${path}`, {
      ...options,
      headers: {
        'Api-Key': this.apiKey,
        'Api-Username': this.apiUsername,
        'Content-Type': 'application/json',
        ...options.headers,
      },
    })
    
    if (!response.ok) {
      const error = await response.text()
      throw new Error(`Discourse API error: ${response.status} - ${error}`)
    }
    
    return response.json()
  }
  
  // SSO Sync
  async syncUserViaSso(user: UserForDiscourse) {
    const payload = this.buildSsoPayload(user)
    const sig = this.signPayload(payload)
    
    await this.request('/admin/users/sync_sso', {
      method: 'POST',
      body: JSON.stringify({ sso: payload, sig }),
    })
  }
  
  private buildSsoPayload(user: UserForDiscourse): string {
    const params = new URLSearchParams({
      external_id: user.id,
      email: user.email,
      username: user.username,
      name: user.name,
      ...(user.title && { title: user.title }),
      ...(user.groups && { groups: user.groups.join(',') }),
    })
    return Buffer.from(params.toString()).toString('base64')
  }
  
  private signPayload(payload: string): string {
    return createHmac('sha256', this.ssoSecret)
      .update(payload)
      .digest('hex')
  }
  
  // User operations
  async deleteUser(username: string) {
    try {
      const user = await this.request<{ user: { id: number } }>(
        `/u/${username}.json`
      )
      await this.request(`/admin/users/${user.user.id}.json`, {
        method: 'DELETE',
        body: JSON.stringify({
          delete_posts: false,
          block_email: false,
          block_urls: false,
          block_ip: false,
        }),
      })
    } catch (error) {
      // User might not exist in Discourse
      console.warn(`Could not delete Discourse user ${username}:`, error)
    }
  }
  
  async suspendUser(username: string) {
    try {
      const user = await this.request<{ user: { id: number } }>(
        `/u/${username}.json`
      )
      await this.request(`/admin/users/${user.user.id}/suspend.json`, {
        method: 'PUT',
        body: JSON.stringify({
          suspend_until: '3018-01-01',
          reason: 'Account deleted from habidat-auth',
        }),
      })
    } catch (error) {
      console.warn(`Could not suspend Discourse user ${username}:`, error)
    }
  }
  
  // Group operations
  async createGroup(group: GroupForDiscourse): Promise<number> {
    const result = await this.request<{ basic_group: { id: number } }>(
      '/admin/groups',
      {
        method: 'POST',
        body: JSON.stringify({
          group: {
            name: group.slug,
            full_name: group.name,
            bio_raw: group.description,
            alias_level: 3,
            mentionable_level: 3,
            messageable_level: 3,
          },
        }),
      }
    )
    return result.basic_group.id
  }
  
  async updateGroup(discourseId: number, group: GroupForDiscourse) {
    await this.request(`/groups/${discourseId}.json`, {
      method: 'PUT',
      body: JSON.stringify({
        group: {
          name: group.slug,
          full_name: group.name,
          bio_raw: group.description,
        },
      }),
    })
  }
  
  async deleteGroup(discourseId: number) {
    await this.request(`/admin/groups/${discourseId}.json`, {
      method: 'DELETE',
    })
  }
  
  async syncGroupMembers(groupSlug: string, usernames: string[]) {
    // Get current members
    const currentMembers = await this.getGroupMembers(groupSlug)
    const currentSet = new Set(currentMembers)
    const targetSet = new Set(usernames)
    
    // Add missing members
    const toAdd = usernames.filter(u => !currentSet.has(u))
    if (toAdd.length > 0) {
      await this.request(`/groups/${groupSlug}/members.json`, {
        method: 'PUT',
        body: JSON.stringify({ usernames: toAdd.join(',') }),
      })
    }
    
    // Remove extra members
    const toRemove = currentMembers.filter(u => !targetSet.has(u))
    for (const username of toRemove) {
      await this.request(`/groups/${groupSlug}/members.json`, {
        method: 'DELETE',
        body: JSON.stringify({ username }),
      })
    }
  }
  
  private async getGroupMembers(groupSlug: string): Promise<string[]> {
    const result = await this.request<{
      members: Array<{ username: string }>
    }>(`/groups/${groupSlug}/members.json?limit=1000`)
    return result.members.map(m => m.username)
  }
  
  // Category operations
  async createCategory(category: CategoryForDiscourse): Promise<number> {
    const result = await this.request<{ category: { id: number } }>(
      '/categories.json',
      {
        method: 'POST',
        body: JSON.stringify({
          name: category.name,
          slug: category.slug,
          color: category.color,
          text_color: category.textColor,
          parent_category_id: category.parentId || undefined,
          permissions: category.groupSlugs.reduce(
            (acc, slug) => ({ ...acc, [slug]: 1 }), // 1 = can see
            {}
          ),
        }),
      }
    )
    return result.category.id
  }
  
  async updateCategory(discourseId: number, category: CategoryForDiscourse) {
    await this.request(`/categories/${discourseId}.json`, {
      method: 'PUT',
      body: JSON.stringify({
        name: category.name,
        slug: category.slug,
        color: category.color,
        text_color: category.textColor,
        parent_category_id: category.parentId || undefined,
        permissions: category.groupSlugs.reduce(
          (acc, slug) => ({ ...acc, [slug]: 1 }),
          {}
        ),
      }),
    })
  }
  
  async deleteCategory(discourseId: number) {
    await this.request(`/categories/${discourseId}.json`, {
      method: 'DELETE',
    })
  }
}
```

---

## 15. App Management

### 15.1 App Actions

```typescript
// lib/actions/app-actions.ts
import { createSafeActionClient } from 'next-safe-action'
import { z } from 'zod'
import { prisma } from '@/lib/db'
import { requireAdmin } from '@/lib/auth-utils'
import { createAuditLog } from '@/lib/audit'
import { revalidatePath } from 'next/cache'

const actionClient = createSafeActionClient()

const appSchema = z.object({
  slug: z.string().min(2).regex(/^[a-zA-Z0-9-]+$/),
  name: z.string().min(2),
  url: z.string().url(),
  iconUrl: z.string().optional(),
  sortOrder: z.number().default(0),
  samlEnabled: z.boolean().default(false),
  samlEntityId: z.string().optional(),
  samlAcsUrl: z.string().url().optional(),
  samlSloUrl: z.string().url().optional(),
  samlCertificate: z.string().optional(),
  groupIds: z.array(z.string().cuid()).optional(), // Empty = all users
})

export const createAppAction = actionClient
  .schema(appSchema)
  .action(async ({ parsedInput }) => {
    const actor = await requireAdmin()
    
    const app = await prisma.app.create({
      data: {
        slug: parsedInput.slug,
        name: parsedInput.name,
        url: parsedInput.url,
        iconUrl: parsedInput.iconUrl,
        sortOrder: parsedInput.sortOrder,
        samlEnabled: parsedInput.samlEnabled,
        samlEntityId: parsedInput.samlEntityId,
        samlAcsUrl: parsedInput.samlAcsUrl,
        samlSloUrl: parsedInput.samlSloUrl,
        samlCertificate: parsedInput.samlCertificate,
        groupAccess: {
          create: (parsedInput.groupIds || []).map(groupId => ({ groupId })),
        },
      },
    })
    
    await createAuditLog({
      actorId: actor.id,
      action: 'CREATE',
      entityType: 'APP',
      entityId: app.id,
      newValue: app,
    })
    
    revalidatePath('/apps')
    return { app }
  })

export const updateAppAction = actionClient
  .schema(appSchema.extend({ id: z.string().cuid() }))
  .action(async ({ parsedInput }) => {
    const actor = await requireAdmin()
    
    const oldApp = await prisma.app.findUniqueOrThrow({
      where: { id: parsedInput.id },
      include: { groupAccess: true },
    })
    
    const app = await prisma.$transaction(async (tx) => {
      // Update app
      const updated = await tx.app.update({
        where: { id: parsedInput.id },
        data: {
          slug: parsedInput.slug,
          name: parsedInput.name,
          url: parsedInput.url,
          iconUrl: parsedInput.iconUrl,
          sortOrder: parsedInput.sortOrder,
          samlEnabled: parsedInput.samlEnabled,
          samlEntityId: parsedInput.samlEntityId,
          samlAcsUrl: parsedInput.samlAcsUrl,
          samlSloUrl: parsedInput.samlSloUrl,
          samlCertificate: parsedInput.samlCertificate,
        },
      })
      
      // Update group access
      await tx.appGroupAccess.deleteMany({
        where: { appId: parsedInput.id },
      })
      if (parsedInput.groupIds?.length) {
        await tx.appGroupAccess.createMany({
          data: parsedInput.groupIds.map(groupId => ({
            appId: parsedInput.id,
            groupId,
          })),
        })
      }
      
      return updated
    })
    
    await createAuditLog({
      actorId: actor.id,
      action: 'UPDATE',
      entityType: 'APP',
      entityId: app.id,
      oldValue: oldApp,
      newValue: app,
    })
    
    revalidatePath('/apps')
    return { app }
  })

export const deleteAppAction = actionClient
  .schema(z.object({ id: z.string().cuid() }))
  .action(async ({ parsedInput }) => {
    const actor = await requireAdmin()
    
    const app = await prisma.app.findUniqueOrThrow({
      where: { id: parsedInput.id },
    })
    
    await prisma.app.delete({ where: { id: parsedInput.id } })
    
    await createAuditLog({
      actorId: actor.id,
      action: 'DELETE',
      entityType: 'APP',
      entityId: app.id,
      oldValue: app,
    })
    
    revalidatePath('/apps')
    return { success: true }
  })
```

### 15.2 App Access Check

```typescript
// lib/auth/app-access.ts
import type { App, AppGroupAccess } from '@prisma/client'
import type { UserWithGroups } from '@/lib/auth/roles'

type AppWithGroups = App & { groupAccess: AppGroupAccess[] }

export function canAccessApp(
  user: UserWithGroups,
  app: AppWithGroups
): boolean {
  // No group restrictions = all authenticated users
  if (app.groupAccess.length === 0) {
    return true
  }
  
  // Check if user is member of any allowed group
  const allowedGroupIds = new Set(app.groupAccess.map(a => a.groupId))
  return user.memberships.some(m => allowedGroupIds.has(m.group.id))
}

export async function getUserApps(user: UserWithGroups) {
  const apps = await prisma.app.findMany({
    include: { groupAccess: true },
    orderBy: { sortOrder: 'asc' },
  })
  
  return apps.filter(app => canAccessApp(user, app))
}
```

---

## 16. Settings & Configuration

### 16.1 Settings Schema

```typescript
// lib/settings/schema.ts
import { z } from 'zod'

export const themeSchema = z.object({
  primary: z.string().regex(/^#[0-9A-Fa-f]{6}$/),
  secondary: z.string().regex(/^#[0-9A-Fa-f]{6}$/),
  accent: z.string().regex(/^#[0-9A-Fa-f]{6}$/),
  success: z.string().regex(/^#[0-9A-Fa-f]{6}$/),
  warning: z.string().regex(/^#[0-9A-Fa-f]{6}$/),
  error: z.string().regex(/^#[0-9A-Fa-f]{6}$/),
  info: z.string().regex(/^#[0-9A-Fa-f]{6}$/),
})

export const settingsSchema = z.object({
  title: z.string().min(1),
  entryUrl: z.string().url(),
  customTheme: z.boolean(),
  theme: themeSchema,
  groupIdDelimiter: z.string().default('_'),
})

export type Settings = z.infer<typeof settingsSchema>

export const defaultSettings: Settings = {
  title: 'habidat',
  entryUrl: 'https://cloud.example.com',
  customTheme: false,
  theme: {
    primary: '#1976d2',
    secondary: '#424242',
    accent: '#82b1ff',
    success: '#4caf50',
    warning: '#fb8c00',
    error: '#ff5252',
    info: '#2196f3',
  },
  groupIdDelimiter: '_',
}
```

### 16.2 Settings Actions

```typescript
// lib/actions/settings-actions.ts
import { createSafeActionClient } from 'next-safe-action'
import { prisma } from '@/lib/db'
import { requireAdmin } from '@/lib/auth-utils'
import { settingsSchema, defaultSettings } from '@/lib/settings/schema'
import { revalidatePath } from 'next/cache'

const actionClient = createSafeActionClient()

export async function getSettings(): Promise<Settings> {
  const setting = await prisma.setting.findUnique({
    where: { key: 'general' },
  })
  
  if (!setting) {
    return defaultSettings
  }
  
  return settingsSchema.parse(setting.value)
}

export const updateSettingsAction = actionClient
  .schema(settingsSchema)
  .action(async ({ parsedInput }) => {
    await requireAdmin()
    
    await prisma.setting.upsert({
      where: { key: 'general' },
      update: { value: parsedInput },
      create: { key: 'general', value: parsedInput },
    })
    
    revalidatePath('/', 'layout')
    return { settings: parsedInput }
  })
```

---

## 17. Audit System

### 17.1 Audit Logger

```typescript
// lib/audit/index.ts
import { prisma } from '@/lib/db'
import type { AuditAction, AuditEntityType } from '@prisma/client'

interface CreateAuditLogParams {
  actorId?: string
  action: AuditAction
  entityType: AuditEntityType
  entityId: string
  oldValue?: unknown
  newValue?: unknown
  metadata?: Record<string, unknown>
}

export async function createAuditLog(params: CreateAuditLogParams) {
  // Sanitize values (remove sensitive fields)
  const sanitize = (value: unknown) => {
    if (!value || typeof value !== 'object') return value
    const obj = { ...value } as Record<string, unknown>
    delete obj.password
    delete obj.hashedPassword
    delete obj.userPassword
    return obj
  }
  
  return prisma.auditLog.create({
    data: {
      actorId: params.actorId,
      action: params.action,
      entityType: params.entityType,
      entityId: params.entityId,
      oldValue: sanitize(params.oldValue) as any,
      newValue: sanitize(params.newValue) as any,
      metadata: params.metadata as any,
    },
  })
}
```

### 17.2 Audit Query

```typescript
// lib/queries/audit.ts
import { prisma } from '@/lib/db'
import { subDays } from 'date-fns'

export async function getAuditLogs(durationDays?: number) {
  const where = durationDays
    ? { createdAt: { gte: subDays(new Date(), durationDays) } }
    : {}
  
  return prisma.auditLog.findMany({
    where,
    include: {
      actor: {
        select: { id: true, name: true, username: true },
      },
    },
    orderBy: { createdAt: 'desc' },
  })
}
```

---

## 18. Email System

### 18.1 Email Client

```typescript
// lib/email/client.ts
import nodemailer from 'nodemailer'
import { env } from '@/lib/env'

const transporter = nodemailer.createTransport({
  host: env.SMTP_HOST,
  port: env.SMTP_PORT,
  secure: env.SMTP_SECURE,
  auth: env.SMTP_USER
    ? {
        user: env.SMTP_USER,
        pass: env.SMTP_PASS,
      }
    : undefined,
})

export async function sendEmail(options: {
  to: string
  subject: string
  html: string
}) {
  return transporter.sendMail({
    from: env.SMTP_FROM,
    to: options.to,
    subject: options.subject,
    html: options.html,
  })
}
```

### 18.2 Email Templates

```typescript
// lib/email/templates.ts
import { prisma } from '@/lib/db'
import { sendEmail } from './client'
import { getSettings } from '@/lib/settings'
import { env } from '@/lib/env'

async function getTemplate(key: string) {
  const template = await prisma.emailTemplate.findUnique({
    where: { key },
  })
  
  if (!template || !template.enabled) {
    return null
  }
  
  return template
}

function renderTemplate(
  template: string,
  variables: Record<string, string>
): string {
  return template.replace(
    /\{\{\s*(\w+)\s*\}\}/g,
    (_, key) => variables[key] || ''
  )
}

export async function sendInviteEmail(params: {
  to: string
  inviteToken: string
  inviterName: string
}) {
  const template = await getTemplate('invite')
  if (!template) return
  
  const settings = await getSettings()
  const link = `${env.APP_URL}/accept-invite?token=${params.inviteToken}`
  
  const html = renderTemplate(template.body, {
    title: settings.title,
    link,
    inviterName: params.inviterName,
    url: env.APP_URL,
  })
  
  const subject = renderTemplate(template.subject, {
    title: settings.title,
  })
  
  await sendEmail({ to: params.to, subject, html })
}

export async function sendPasswordResetEmail(params: {
  to: string
  token: string
}) {
  const template = await getTemplate('passwordReset')
  if (!template) return
  
  const settings = await getSettings()
  const link = `${env.APP_URL}/set-password?token=${params.token}`
  
  const html = renderTemplate(template.body, {
    title: settings.title,
    link,
    url: env.APP_URL,
  })
  
  const subject = renderTemplate(template.subject, {
    title: settings.title,
  })
  
  await sendEmail({ to: params.to, subject, html })
}
```

---

## 19. API Design

### 19.1 Server Actions Pattern

All mutations use `next-safe-action` with Zod validation:

```typescript
// Pattern for all actions
import { createSafeActionClient } from 'next-safe-action'
import { z } from 'zod'

const actionClient = createSafeActionClient({
  handleReturnedServerError: (e) => {
    return e.message || 'An error occurred'
  },
})

export const exampleAction = actionClient
  .schema(z.object({ /* schema */ }))
  .action(async ({ parsedInput }) => {
    // Implementation
  })
```

### 19.2 Route Handlers

For non-mutation APIs and external integrations:

```typescript
// app/api/[...]/route.ts
import { NextResponse } from 'next/server'

export async function GET(request: Request) {
  // Implementation
}

export async function POST(request: Request) {
  // Implementation
}
```

### 19.3 API Routes Summary

| Route | Method | Purpose |
|-------|--------|---------|
| `/api/auth/[...all]` | * | better-auth handlers |
| `/api/cron/sync` | GET | Sync queue processing |
| `/sso/metadata` | GET | SAML IdP metadata |
| `/sso/login/[appSlug]` | GET | SAML SSO |
| `/sso/logout/[appSlug]` | GET | SAML SLO |
| `/appmenu` | GET | Embeddable app menu |

---

## 20. Frontend Architecture

### 20.1 Page Structure

```
app/
├── (auth)/                    # Auth layout (no sidebar)
│   ├── login/
│   ├── register/
│   ├── accept-invite/
│   ├── reset-password/
│   └── set-password/
├── (dashboard)/               # Dashboard layout (with sidebar)
│   ├── page.tsx               # Profile
│   ├── profile/
│   │   └── edit/
│   ├── password/
│   ├── users/
│   │   ├── page.tsx           # List
│   │   ├── new/
│   │   └── [id]/
│   │       └── edit/
│   ├── groups/
│   │   ├── page.tsx           # List/Tree
│   │   ├── new/
│   │   └── [id]/
│   │       ├── page.tsx       # View
│   │       └── edit/
│   ├── invites/
│   │   ├── page.tsx           # List
│   │   └── new/
│   ├── categories/
│   │   ├── page.tsx
│   │   ├── new/
│   │   └── [id]/edit/
│   ├── apps/
│   │   ├── page.tsx
│   │   ├── new/
│   │   └── [id]/edit/
│   ├── settings/
│   │   ├── page.tsx           # General settings
│   │   └── templates/
│   ├── audit/
│   └── sync/                  # Sync status (admin)
└── sso/
    ├── metadata/
    ├── login/[appSlug]/
    └── logout/[appSlug]/
```

### 20.2 Component Library

Using shadcn/ui components:

```typescript
// components/ui/... (shadcn components)
// components/
//   ├── layout/
//   │   ├── sidebar.tsx
//   │   ├── header.tsx
//   │   └── nav-item.tsx
//   ├── users/
//   │   ├── user-table.tsx
//   │   ├── user-form.tsx
//   │   └── user-card.tsx
//   ├── groups/
//   │   ├── group-table.tsx
//   │   ├── group-tree.tsx
//   │   ├── group-form.tsx
//   │   └── group-selector.tsx
//   ├── forms/
//   │   ├── password-field.tsx
//   │   ├── email-field.tsx
//   │   └── color-picker.tsx
//   └── shared/
//       ├── data-table.tsx      # TanStack Table wrapper
//       ├── confirm-dialog.tsx
//       └── loading.tsx
```

### 20.3 Data Fetching Pattern

```typescript
// Using TanStack Query with Server Components

// Server Component (preferred for initial data)
async function UsersPage() {
  const users = await getUsers() // Direct database query
  return <UsersClient initialData={users} />
}

// Client Component (for mutations and refetching)
'use client'
function UsersClient({ initialData }) {
  const { data: users } = useQuery({
    queryKey: ['users'],
    queryFn: () => fetch('/api/users').then(r => r.json()),
    initialData,
  })
  
  const { mutate: deleteUser } = useMutation({
    mutationFn: (id) => deleteUserAction({ userId: id }),
    onSuccess: () => queryClient.invalidateQueries(['users']),
  })
  
  return <UserTable users={users} onDelete={deleteUser} />
}
```

### 20.4 URL State with nuqs

```typescript
// Using nuqs for table state
'use client'
import { useQueryState, parseAsInteger, parseAsString } from 'nuqs'

function UsersTable() {
  const [page, setPage] = useQueryState('page', parseAsInteger.withDefault(1))
  const [search, setSearch] = useQueryState('search', parseAsString.withDefault(''))
  const [sort, setSort] = useQueryState('sort', parseAsString)
  
  // Table uses these URL-synced values
}
```

---

## 21. Internationalization

### 21.1 next-intl Setup

```typescript
// i18n/request.ts
import { getRequestConfig } from 'next-intl/server'
import { cookies, headers } from 'next/headers'

export default getRequestConfig(async () => {
  // Get locale from user preference or accept-language header
  const cookieStore = await cookies()
  const headerStore = await headers()
  
  const locale = cookieStore.get('locale')?.value 
    || headerStore.get('accept-language')?.split(',')[0]?.split('-')[0]
    || 'de'
  
  return {
    locale,
    messages: (await import(`../messages/${locale}.json`)).default,
  }
})
```

### 21.2 Message Structure

```json
// messages/de.json
{
  "common": {
    "save": "Speichern",
    "cancel": "Abbrechen",
    "delete": "Löschen",
    "edit": "Bearbeiten",
    "create": "Erstellen",
    "search": "Suchen",
    "loading": "Laden..."
  },
  "auth": {
    "login": "Anmelden",
    "logout": "Abmelden",
    "password": "Passwort",
    "email": "E-Mail",
    "username": "Benutzername"
  },
  "users": {
    "title": "Benutzer",
    "create": "Benutzer erstellen",
    "edit": "Benutzer bearbeiten",
    "name": "Name",
    "location": "Ort",
    "groups": "Gruppen"
  },
  "groups": {
    "title": "Gruppen",
    "create": "Gruppe erstellen",
    "members": "Mitglieder",
    "owners": "Administratoren",
    "subgroups": "Untergruppen"
  }
}
```

### 21.3 Usage in Components

```typescript
import { useTranslations } from 'next-intl'

function UserForm() {
  const t = useTranslations('users')
  
  return (
    <form>
      <Label>{t('name')}</Label>
      <Input />
      <Button>{t('common.save')}</Button>
    </form>
  )
}
```

---

---

## 22. Development & Deployment

### 22.1 Docker Compose (Development)

```yaml
# docker/docker-compose.yml
version: '3.8'

services:
  # Next.js Web Application
  web:
    build:
      context: ..
      dockerfile: docker/web.Dockerfile
      target: development
    volumes:
      - ..:/app
      - /app/node_modules
      - /app/apps/web/.next
    ports:
      - '3000:3000'
    environment:
      - NODE_ENV=development
      - DATABASE_URL=postgresql://postgres:postgres@db:5432/habidat_auth
      - REDIS_URL=redis://redis:6379
      - APP_URL=http://localhost:3000
      - NEXT_PUBLIC_APP_URL=http://localhost:3000
    depends_on:
      - db
      - redis
      - ldap
    command: pnpm dev:web

  # BullMQ Worker Application
  worker:
    build:
      context: ..
      dockerfile: docker/worker.Dockerfile
      target: development
    volumes:
      - ..:/app
      - /app/node_modules
    environment:
      - NODE_ENV=development
      - DATABASE_URL=postgresql://postgres:postgres@db:5432/habidat_auth
      - REDIS_URL=redis://redis:6379
      - LDAP_URL=ldap://ldap:389
      - LDAP_BIND_DN=cn=admin,dc=habidat,dc=local
      - LDAP_BIND_PASSWORD=admin
      - LDAP_BASE_DN=dc=habidat,dc=local
      - LDAP_USERS_DN=ou=users,dc=habidat,dc=local
      - LDAP_GROUPS_DN=ou=groups,dc=habidat,dc=local
      - DISCOURSE_URL=${DISCOURSE_URL}
      - DISCOURSE_API_KEY=${DISCOURSE_API_KEY}
      - DISCOURSE_API_USERNAME=${DISCOURSE_API_USERNAME}
      - DISCOURSE_SSO_SECRET=${DISCOURSE_SSO_SECRET}
      - SMTP_HOST=${SMTP_HOST:-mailhog}
      - SMTP_PORT=${SMTP_PORT:-1025}
      - SMTP_SECURE=false
      - SMTP_FROM=noreply@habidat.local
      - APP_URL=http://localhost:3000
    depends_on:
      - db
      - redis
      - ldap
    command: pnpm dev:worker

  # PostgreSQL Database
  db:
    image: postgres:16-alpine
    environment:
      POSTGRES_USER: postgres
      POSTGRES_PASSWORD: postgres
      POSTGRES_DB: habidat_auth
    volumes:
      - postgres_data:/var/lib/postgresql/data
    ports:
      - '5432:5432'
    healthcheck:
      test: ['CMD-SHELL', 'pg_isready -U postgres']
      interval: 5s
      timeout: 5s
      retries: 5

  # Redis (BullMQ Queue)
  redis:
    image: redis:7-alpine
    ports:
      - '6379:6379'
    volumes:
      - redis_data:/data
    healthcheck:
      test: ['CMD', 'redis-cli', 'ping']
      interval: 5s
      timeout: 5s
      retries: 5
    command: redis-server --appendonly yes

  # OpenLDAP
  ldap:
    image: osixia/openldap:1.5.0
    environment:
      LDAP_ORGANISATION: 'habidat'
      LDAP_DOMAIN: 'habidat.local'
      LDAP_ADMIN_PASSWORD: 'admin'
      LDAP_CONFIG_PASSWORD: 'config'
    volumes:
      - ldap_data:/var/lib/ldap
      - ldap_config:/etc/ldap/slapd.d
    ports:
      - '389:389'

  # Mailhog (Development SMTP)
  mailhog:
    image: mailhog/mailhog
    ports:
      - '1025:1025'  # SMTP
      - '8025:8025'  # Web UI

volumes:
  postgres_data:
  redis_data:
  ldap_data:
  ldap_config:
```

### 22.2 Docker Compose (Production)

```yaml
# docker/docker-compose.prod.yml
version: '3.8'

services:
  web:
    build:
      context: ..
      dockerfile: docker/web.Dockerfile
      target: production
    ports:
      - '3000:3000'
    environment:
      - NODE_ENV=production
    env_file:
      - ../.env.production
    depends_on:
      db:
        condition: service_healthy
      redis:
        condition: service_healthy
    restart: unless-stopped

  worker:
    build:
      context: ..
      dockerfile: docker/worker.Dockerfile
      target: production
    environment:
      - NODE_ENV=production
    env_file:
      - ../.env.production
    depends_on:
      db:
        condition: service_healthy
      redis:
        condition: service_healthy
    restart: unless-stopped

  db:
    image: postgres:16-alpine
    environment:
      POSTGRES_USER: ${POSTGRES_USER}
      POSTGRES_PASSWORD: ${POSTGRES_PASSWORD}
      POSTGRES_DB: ${POSTGRES_DB}
    volumes:
      - postgres_data:/var/lib/postgresql/data
    healthcheck:
      test: ['CMD-SHELL', 'pg_isready -U ${POSTGRES_USER}']
      interval: 10s
      timeout: 5s
      retries: 5
    restart: unless-stopped

  redis:
    image: redis:7-alpine
    volumes:
      - redis_data:/data
    command: redis-server --appendonly yes --requirepass ${REDIS_PASSWORD}
    healthcheck:
      test: ['CMD', 'redis-cli', '-a', '${REDIS_PASSWORD}', 'ping']
      interval: 10s
      timeout: 5s
      retries: 5
    restart: unless-stopped

volumes:
  postgres_data:
  redis_data:
```

### 22.3 Web Dockerfile

```dockerfile
# docker/web.Dockerfile
FROM node:22-alpine AS base
RUN corepack enable && corepack prepare pnpm@9.12.0 --activate
WORKDIR /app

# Install dependencies
FROM base AS deps
COPY pnpm-lock.yaml pnpm-workspace.yaml package.json ./
COPY apps/web/package.json ./apps/web/
COPY packages/*/package.json ./packages/
# Copy each package.json maintaining structure
RUN --mount=type=cache,target=/root/.local/share/pnpm/store \
    pnpm install --frozen-lockfile

# Development stage
FROM base AS development
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN pnpm db:generate
EXPOSE 3000
CMD ["pnpm", "dev:web"]

# Build stage
FROM base AS builder
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN pnpm db:generate
RUN pnpm build:web

# Production stage
FROM base AS production
ENV NODE_ENV=production
WORKDIR /app

# Copy built application
COPY --from=builder /app/apps/web/.next/standalone ./
COPY --from=builder /app/apps/web/.next/static ./apps/web/.next/static
COPY --from=builder /app/apps/web/public ./apps/web/public

EXPOSE 3000
CMD ["node", "apps/web/server.js"]
```

### 22.4 Worker Dockerfile

```dockerfile
# docker/worker.Dockerfile
FROM node:22-alpine AS base
RUN corepack enable && corepack prepare pnpm@9.12.0 --activate
WORKDIR /app

# Install dependencies
FROM base AS deps
COPY pnpm-lock.yaml pnpm-workspace.yaml package.json ./
COPY apps/worker/package.json ./apps/worker/
COPY packages/*/package.json ./packages/
RUN --mount=type=cache,target=/root/.local/share/pnpm/store \
    pnpm install --frozen-lockfile

# Development stage
FROM base AS development
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN pnpm db:generate
CMD ["pnpm", "dev:worker"]

# Build stage
FROM base AS builder
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN pnpm db:generate
RUN pnpm build:worker

# Production stage
FROM base AS production
ENV NODE_ENV=production
WORKDIR /app

COPY --from=deps /app/node_modules ./node_modules
COPY --from=builder /app/apps/worker/dist ./apps/worker/dist
COPY --from=builder /app/packages ./packages
COPY --from=builder /app/node_modules/.prisma ./node_modules/.prisma

CMD ["node", "apps/worker/dist/index.js"]
```

### 22.5 Next.js Configuration for Standalone

```typescript
// apps/web/next.config.ts
import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  output: 'standalone',
  transpilePackages: [
    '@habidat/db',
    '@habidat/auth',
    '@habidat/sync',
    '@habidat/env',
    '@habidat/ui',
    '@habidat/saml',
  ],
  experimental: {
    serverActions: {
      bodySizeLimit: '2mb',
    },
  },
}

export default nextConfig
```

### 22.6 Environment Variables

```bash
# .env.example

# =============================================================================
# SHARED (Web + Worker)
# =============================================================================

# Database
DATABASE_URL="postgresql://postgres:postgres@localhost:5432/habidat_auth"

# Redis (BullMQ)
REDIS_URL="redis://localhost:6379"

# =============================================================================
# WEB APP ONLY
# =============================================================================

# Application
APP_URL="http://localhost:3000"
NEXT_PUBLIC_APP_URL="http://localhost:3000"
SESSION_SECRET="your-session-secret-min-32-chars-long-here"

# SAML IdP
SAML_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----"
SAML_CERTIFICATE="-----BEGIN CERTIFICATE-----\n...\n-----END CERTIFICATE-----"

# =============================================================================
# WORKER APP ONLY
# =============================================================================

# LDAP
LDAP_URL="ldap://localhost:389"
LDAP_BIND_DN="cn=admin,dc=habidat,dc=local"
LDAP_BIND_PASSWORD="admin"
LDAP_BASE_DN="dc=habidat,dc=local"
LDAP_USERS_DN="ou=users,dc=habidat,dc=local"
LDAP_GROUPS_DN="ou=groups,dc=habidat,dc=local"

# Discourse
DISCOURSE_URL="https://forum.example.com"
DISCOURSE_API_KEY="your-discourse-api-key"
DISCOURSE_API_USERNAME="system"
DISCOURSE_SSO_SECRET="your-discourse-sso-secret"

# SMTP
SMTP_HOST="smtp.example.com"
SMTP_PORT="587"
SMTP_SECURE="false"
SMTP_USER="your-smtp-user"
SMTP_PASS="your-smtp-password"
SMTP_FROM="noreply@example.com"

# App URL (for email links)
APP_URL="https://auth.example.com"
```

### 22.7 Development Scripts

```json
// package.json (root) - updated scripts
{
  "scripts": {
    "dev": "docker compose -f docker/docker-compose.yml up",
    "dev:local": "pnpm --parallel -r dev",
    "dev:web": "pnpm --filter @habidat/web dev",
    "dev:worker": "pnpm --filter @habidat/worker dev",
    "build": "pnpm -r build",
    "build:web": "pnpm --filter @habidat/web build",
    "build:worker": "pnpm --filter @habidat/worker build",
    "lint": "biome check .",
    "lint:fix": "biome check --write .",
    "format": "biome format --write .",
    "typecheck": "pnpm -r typecheck",
    "db:generate": "pnpm --filter @habidat/db generate",
    "db:migrate": "pnpm --filter @habidat/db migrate",
    "db:push": "pnpm --filter @habidat/db push",
    "db:studio": "pnpm --filter @habidat/db studio",
    "docker:build": "docker compose -f docker/docker-compose.yml build",
    "docker:up": "docker compose -f docker/docker-compose.yml up -d",
    "docker:down": "docker compose -f docker/docker-compose.yml down",
    "docker:logs": "docker compose -f docker/docker-compose.yml logs -f",
    "docker:prod:build": "docker compose -f docker/docker-compose.prod.yml build",
    "docker:prod:up": "docker compose -f docker/docker-compose.prod.yml up -d"
  }
}
```

---

## 23. Migration Strategy

### 23.1 Data Migration Steps

1. **Export from LDAP**
   ```bash
   ldapsearch -x -H ldap://localhost -D "cn=admin,dc=example,dc=com" \
     -w password -b "dc=example,dc=com" > export.ldif
   ```

2. **Transform and Import**
   ```typescript
   // scripts/migrate-from-ldap.ts
   async function migrateUsers() {
     const ldapUsers = await exportLdapUsers()
     
     for (const ldapUser of ldapUsers) {
       await prisma.user.create({
         data: {
           username: ldapUser.uid,
           name: ldapUser.cn,
           email: ldapUser.mail,
           location: ldapUser.l,
           preferredLanguage: ldapUser.preferredLanguage || 'de',
           storageQuota: ldapUser.description || '1 GB',
           ldapDn: ldapUser.dn,
           ldapUidNumber: parseInt(ldapUser.uidNumber),
           ldapSynced: true,
           ldapSyncedAt: new Date(),
         },
       })
     }
   }
   ```

3. **Verify Data Integrity**
4. **Switch Traffic**
5. **Enable Sync Workers**

### 23.2 Rollback Plan

- Keep LDAP as read-only backup during transition
- Maintain ability to switch back for 30 days
- Regular PostgreSQL backups

---

## 24. Implementation Phases

### Phase 1: Core Infrastructure (2-3 weeks)
- [ ] Project setup (Next.js, Prisma, Tailwind, shadcn/ui)
- [ ] Database schema and migrations
- [ ] better-auth integration
- [ ] Basic authentication (login, logout, password reset)
- [ ] User profile pages

### Phase 2: User & Group Management (2-3 weeks)
- [ ] User CRUD operations
- [ ] Group CRUD operations
- [ ] Hierarchical group relationships
- [ ] Authorization system (roles, permissions)
- [ ] Audit logging

### Phase 3: Sync System (2 weeks)
- [ ] Sync event queue (outbox pattern)
- [ ] LDAP sync worker
- [ ] Discourse sync worker
- [ ] Sync status dashboard

### Phase 4: Invitation System (1 week)
- [ ] Invite creation and management
- [ ] Invite acceptance flow
- [ ] Email templates

### Phase 5: SAML Identity Provider (2 weeks)
- [ ] SAML metadata endpoint
- [ ] SSO login flow
- [ ] Single logout (SLO)
- [ ] App management

### Phase 6: Additional Features (1-2 weeks)
- [ ] Discourse category management
- [ ] Settings management
- [ ] Email template editor
- [ ] Internationalization

### Phase 7: Testing & Migration (2 weeks)
- [ ] End-to-end testing
- [ ] Data migration scripts
- [ ] Performance testing
- [ ] Documentation
- [ ] Production deployment

---

## Appendix: Key Dependencies

```json
{
  "dependencies": {
    "next": "^15.0.0",
    "react": "^19.0.0",
    "react-dom": "^19.0.0",
    "@prisma/client": "^6.0.0",
    "better-auth": "^1.0.0",
    "@node-saml/node-saml": "^5.0.0",
    "@tanstack/react-query": "^5.0.0",
    "@tanstack/react-table": "^8.0.0",
    "react-hook-form": "^7.0.0",
    "@hookform/resolvers": "^3.0.0",
    "next-safe-action": "^7.0.0",
    "nuqs": "^2.0.0",
    "next-intl": "^3.0.0",
    "zod": "^3.0.0",
    "zxcvbn": "^4.4.2",
    "ldapjs-client": "^1.0.0",
    "nodemailer": "^6.0.0",
    "date-fns": "^3.0.0"
  },
  "devDependencies": {
    "typescript": "^5.0.0",
    "prisma": "^6.0.0",
    "@types/node": "^22.0.0",
    "@types/react": "^19.0.0",
    "@biomejs/biome": "^1.0.0",
    "tailwindcss": "^4.0.0",
    "autoprefixer": "^10.0.0",
    "postcss": "^8.0.0"
  }
}
```

---

*This specification provides a complete roadmap for rewriting habidat-auth with modern technologies while maintaining all existing functionality and improving the architecture with PostgreSQL as the single source of truth.*
