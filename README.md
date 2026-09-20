# habidat-auth

User management and identity provider for habidat groupware.

## Architecture

This is a monorepo containing:

- `apps/web` - Next.js 16 web application
- `apps/worker` - BullMQ worker for background jobs
- `packages/db` - Prisma database schema and client
- `packages/env` - Environment variable validation
- `packages/typescript-config` - Shared TypeScript configurations

## Prerequisites

- Node.js 22+
- pnpm 9+
- Docker & Docker Compose
- A local clone of `soudis/habidat-setup`

## Development setup (with habidat-setup)

This project is designed to run against a local `habidat-setup` instance so auth can integrate with LDAP, Discourse, and other habidat apps.

### 1. Checkout and install habidat-setup

```bash
git clone https://github.com/soudis/habidat-setup.git
cd habidat-setup
```

Follow the `habidat-setup` installation guide, then install at least these modules:

- `nginx`
- `auth`
- `nextcloud`
- `discourse`

Example:

```bash
./habidat.sh install nginx
./habidat.sh install auth
./habidat.sh install nextcloud
./habidat.sh install discourse
```

If you want to test with data from an existing habidat instance, run 


```bash
./habidat.sh export auth
```

on the instance and download the exported file to the `HABIDAT_BACKUP_DIR/habidat/auth` folder. Then run

```bash
./habdiat.sh import auth <filename>
```

IMPORTANT: Make sure to use the same `HABIDAT_LDAP_DOMAIN` and `HABIDAT_LDAP_BASE` parameters in your `setup.env` as on the source system of the data. 

### 2. Prepare habidat-auth env

```bash
cd /path/to/habidat-auth
cp .env.example .env
```

Copy relevant values from `habidat-setup/store/auth/auth.env` (or legacy `store/auth/user.env` where needed) into `.env`, especially:

- `DOCKER_PREFIX`,
- `DOMAIN`,
- `ADMIN_EMAIL`, 
- `ADMIN_PASSWORD`
- `LDAP_BASE_DN`, 
- `LDAP_BIND_PASSWORD`
- `DISCOURSE_SSO_SECRET`
- `DISCOURSE_API_KEY`

### 3. Install dependencies

```bash
pnpm install
pnpm db:generate
```

### 4. Stop user container from habidat-setup

```bash
docker stop DOCKER_PREFIX-user
```

### 5. Start development docker container

```bash
pnpm dev
```

This starts the dev stack defined in `docker/docker-compose.dev.yml` (DB, Redis, Mailhog, web, worker) and connects to your local `habidat-setup` networks.

## SSO

- **DiscourseConnect** is served by habidat-auth at `/sso/discourse`. Point Discourse `discourse_connect_url` there (not the Nextcloud `discoursesso` app). The shared secret is `DISCOURSE_SSO_SECRET`.
- **SAML** IdP endpoints are `/sso/login` and `/sso/logout` (resolve the app from the SAML Issuer), `/sso/login/<appSlug>`, `/sso/logout/<appSlug>`, and `/sso/metadata`.
- **OpenID Connect** issuer is `{APP_URL}/oidc` (discovery at `/oidc/.well-known/openid-configuration`). Enable OIDC on an app and set client ID, redirect URIs, and optional secret.

## Floating app menu

When apps run on a subdomain of the same domain as the auth instance, you can show a floating menu in the bottom-right corner by loading `/api/widget/script`. Discourse gets this from `habidat-setup`; Nextcloud uses the [JSLoader](https://apps.nextcloud.com/apps/jsloader) app.

JSLoader wraps your snippet in `DOMContentLoaded` and serves it as a nonce-backed Nextcloud script, which is required because Nextcloud's CSP uses `'strict-dynamic'` (host allowlists in `script-src-elem` are ignored — those console warnings are expected).

1. Install and enable JSLoader.
2. Paste this snippet (use your auth origin):

```
const script = document.createElement('script');
script.src = 'https://user.example.org/api/widget/script';
script.async = true;

script.onload = function() {
    console.log("Central menu script loaded and executed.");
};

script.onerror = function() {
    console.error("Error loading the central menu script.");
};

document.head.appendChild(script);
```

3. Set **Domain where external JavaScript is loaded from** to that same origin, with no path: `https://user.example.org`. JSLoader adds it to `connect-src` so the widget can `fetch` `/api/widget/content`. Leave this empty and the script will run but the menu will never appear.
4. After deploying auth, sign out of habidat-auth and sign in again. The session cookie is scoped to the parent domain (e.g. `habidat.org`) so Firefox will send it from `cloud.*` / `discourse.*`. Host-only cookies are treated as third-party there and the widget stays empty.

If the menu still does not show, the console logs `Habidat SSO widget: no menu to show (…)` with `not signed in` or `no apps assigned`.

## Scripts

| Command | Description |
|---------|-------------|
| `pnpm dev` | Start all apps in development mode |
| `pnpm dev:web` | Start web app only |
| `pnpm dev:docker` | Run full dev stack in Docker (db, redis, mailhog, web, worker) |
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
