# myNimto

myNimto is a digital invitation platform for weddings, birthdays, engagements,
corporate events, and cultural celebrations.

Hosts choose a design, add their event details, create a guest list, and share
personalized invitation links. Guests open a clean invitation page containing
the event information and the name of the person or family being invited.

> Project status: active MVP development. Authentication, administration,
> template publishing, event creation, invitee links, CMS pages, and local
> Docker infrastructure are implemented. Payments, bulk PDF export, RSVP,
> bilingual editing, QR generation, and production-ready sharing integrations
> remain on the roadmap.

## Product experience

### For event hosts

- Register and manage a profile.
- Browse published invitation designs.
- Create wedding, birthday, corporate, or custom events.
- Enter event date, venue, description, cover image, and design field values.
- Create and manage guest names.
- Generate a unique invitation link for each invitee.
- Regenerate or remove invitee links.
- Keep a permanent history of previously used designs and reuse active designs.
- View and manage events from a personal workspace.
- Use the installable PWA or the React Native Android/iOS host application.

### For invited guests

- Open an invitation without creating an account.
- See the correct published design version.
- See the personalized guest name.
- View the host, date, venue, description, and invitation content.

### For administrators and staff

- Manage users, staff, roles, permissions, sessions, and audit logs.
- Protect the root Super Admin role and account.
- Upload and scan complete HTML invitation templates.
- Organize templates into dynamic categories and subcategories.
- Publish versioned designs without changing invitations already in use.
- Manage reusable opening and background animation components.
- Edit public website pages and blog posts from the CMS dashboard.

## Architecture

| Area               | Technology                                     |
| ------------------ | ---------------------------------------------- |
| Web and PWA        | Next.js 16, React 19, TypeScript, Tailwind CSS |
| Mobile             | Expo 57, React Native 0.86, Expo Router        |
| Backend            | NestJS 11, TypeScript                          |
| Database           | PostgreSQL 16                                  |
| ORM and migrations | Prisma 6                                       |
| Authentication     | JWT, email/password, optional Google OAuth     |
| Local email        | Mailpit                                        |
| Database browser   | Adminer                                        |
| Local runtime      | Docker Compose using Colima or Docker Desktop  |

The repository is an npm workspace:

```text
nimto-app/
├── apps/
│   ├── web/                 # Next.js frontend and PWA
│   ├── api/                 # NestJS API and Prisma schema
│   └── mobile/              # Expo Android and iOS host app
├── docker/                  # Container startup scripts
├── docs/                    # Product and module documentation
├── AI_README.md             # Detailed handoff context for AI assistants
├── Dockerfile
└── docker-compose.yml
```

## Quick start with Docker

### Requirements

- Docker Desktop, or Docker CLI with Colima
- Git

On macOS, one lightweight option is:

```bash
brew install colima docker docker-compose docker-buildx
colima start --cpu 4 --memory 6 --disk 40
```

### Start the application

```bash
git clone https://github.com/tkandel37/Nimto.git
cd Nimto/nimto-app
cp .env.docker.example .env.docker
# Set JWT_SECRET and SUPER_ADMIN_PASSWORD in .env.docker first.
npm run docker:up
```

Open:

| Service           | URL                          |
| ----------------- | ---------------------------- |
| myNimto           | http://localhost:3000        |
| API health check  | http://localhost:4000/health |
| Local email inbox | http://localhost:8025        |
| Database manager  | http://localhost:8080        |

The API container automatically applies Prisma migrations. The local Compose
configuration also opts into the seed with `RUN_DATABASE_SEED=true`; production
must leave that flag disabled. Replace the example JWT and Super Admin secrets
before the first startup.

### Useful commands

```bash
npm run docker:up       # Build and start the complete stack
npm run docker:logs     # Follow all container logs
npm run docker:down     # Stop containers and preserve database data
npm run docker:reset    # Stop containers and delete local database data
```

PostgreSQL data is stored in the `nimto_postgres_data` Docker volume.

## Local email

Registration verification messages are delivered to Mailpit instead of the
internet. Register through myNimto, then open http://localhost:8025 to read the
message and use its verification link.

## Database access

Open Adminer at http://localhost:8080 and use:

- System: `PostgreSQL`
- Server: `database`
- Username, password, and database: values from `.env.docker`

## Development with hot reload

Start only the local infrastructure:

```bash
docker compose --env-file .env.docker up -d database mailpit adminer
```

Create `apps/api/.env` from `apps/api/.env.example` and
`apps/web/.env.local` from `apps/web/.env.example`. Then run:

```bash
npm install
npm run prisma:migrate:deploy --workspace @nimto/api
npm run start:dev --workspace @nimto/api
```

In a second terminal:

```bash
npm run dev --workspace @nimto/web
```

## HTML invitation design format

Templates are complete HTML documents containing their own CSS. Executable
template JavaScript is rejected; the renderer adds only its nonce-protected
feature scripts. Editable content is marked with `data-nimto-field`, and
template metadata is stored in a JSON block with the ID `nimto-template-meta`.

The complete authoring specification is in
[`docs/module-2-template-and-design-epics.md`](docs/module-2-template-and-design-epics.md).

## What is local and what is online?

The frontend, API, PostgreSQL database, migrations, authentication, email
capture, and database manager work locally.

Google OAuth remains available on the deployed website. It is intentionally
hidden in the local Docker environment, where email/password authentication is
the supported fallback. This avoids changing the existing production Google
OAuth client just for localhost.

Docker images and npm packages require internet access the first time they are
downloaded. Production deployment can still use hosted PostgreSQL, Vercel,
Render, or equivalent providers through environment variables.

## Roadmap

- Paid guest-name personalization
- Bulk invitation and PDF generation
- English and Nepali editing
- RSVP and attendance tracking
- QR codes and calendar links
- Maps, countdowns, galleries, and music controls
- WhatsApp, Messenger, and email sharing workflows
- Image uploads and managed media storage
- Production payment, billing, and entitlement rules

## Mobile and PWA

The web application is installable as a PWA and includes a safe offline
fallback with static-asset caching. The Expo application provides the core
host workflow on Android and iOS: authentication, design browsing, event
creation and editing, invitation previews, invitee links, RSVP summaries, and
native sharing.

Mobile setup and verification are documented in
[`apps/mobile/README.md`](apps/mobile/README.md). EAS Build, OTA, store, and PWA
release procedures are in [`docs/mobile-release.md`](docs/mobile-release.md).

## AI contributors

Before changing the project, read [`AI_README.md`](AI_README.md). It explains
the architecture, implemented features, important invariants, environment
variables, verification steps, and current limitations.

Production hardening and secret/database/WAF requirements are documented in
[`SECURITY.md`](SECURITY.md).
