# myNimto AI Project Context

This file is the primary handoff document for any AI assistant working on
myNimto. Read it before planning or changing code. Also read `AGENTS.md` for
framework-specific instructions.

## 1. Product in one paragraph

myNimto is a TypeScript digital invitation platform. Event hosts select a
published HTML design, create an event, add invitees, and share generic or
guest-specific invitation links. Guests do not need accounts. Administrators
and staff manage users, permissions, website content, templates, design
versions, and animation components.

The long-term business model is free design selection with paid guest-name
personalization. Payment and entitlement enforcement are not implemented yet.

## 2. Current status

### Implemented

- Email/password registration, verification, login, server-enforced logout,
  JWT sessions, and profile updates.
- Optional Google OAuth integration.
- Role-based permissions with collapsible category assignment, immediate access
  cache invalidation, staff and user management, session revocation, audit logs,
  and database-protected Super Admin records.
- Route-backed, permission-aware admin navigation with compact table-first
  category and subcategory management.
- Public and administrative CMS pages and blog posts.
- Dynamic design categories and subcategories.
- HTML template upload, scanning, editing, duplication, rescan, publication,
  unpublication, immutable design version snapshots, and matching catalogue
  thumbnail authoring through a guided two-step workflow with reusable AI
  conversion prompts and an automatic publish-time thumbnail fallback.
- Public design catalogue.
- Opening and background animation-component catalogue.
- User event creation, update, deletion, and design-field values.
- Capability-aware event navigation: RSVP, music URL, and field-link tabs stay
  primary when allowed by the template and move to an unavailable-features
  overflow when disabled. Admins control host availability separately from the
  default enabled state.
- Persistent per-user design history with usage counts, last-used version
  previews, active-event counts, and reuse links.
- Invitee creation, unique personalized slugs, slug regeneration, deletion, and
  public invitation rendering.
- Complete local Docker stack using PostgreSQL, Mailpit, Adminer, API, and web.
- Automatic migration deployment and idempotent Super Admin seeding.

### Planned, not implemented

- Payments, subscriptions, checkout, billing, and paid-field enforcement.
- Bulk PDF generation or printing.
- Full English/Nepali localization.
- RSVP collection and attendance tracking.
- QR-code generation.
- Managed image/file storage.
- Turnkey WhatsApp, Messenger, SMS, or email distribution.
- Production analytics and operational monitoring.

Do not present planned items as working features.

## 3. Repository structure

```text
nimto-app/
├── apps/
│   ├── api/
│   │   ├── prisma/
│   │   │   ├── migrations/
│   │   │   ├── schema.prisma
│   │   │   └── seed.ts
│   │   └── src/
│   │       ├── admin/
│   │       ├── audit/
│   │       ├── auth/
│   │       ├── cms/
│   │       ├── events/
│   │       ├── mail/
│   │       ├── prisma/
│   │       └── template-design/
│   └── web/
│       ├── app/
│       ├── lib/
│       └── public/
├── docker/api-entrypoint.sh
├── docs/module-2-template-and-design-epics.md
├── Dockerfile
├── docker-compose.yml
└── package.json
```

This is an npm workspace. Run workspace commands from `nimto-app/`.

## 4. Technology and versions

- Node.js 20+
- Next.js 16.2.6 and React 19.2
- NestJS 10
- Prisma 6.19
- PostgreSQL 16
- TypeScript throughout
- Docker Compose for the local environment

Important: this project uses Next.js 16. Read the local documentation in
`node_modules/next/dist/docs/` before changing framework behavior. Do not rely
on older Next.js conventions from memory.

## 5. Runtime architecture

```text
Browser
  ├── http://localhost:3000 → Next.js web
  └── http://localhost:4000 → NestJS API
                                 ├── PostgreSQL (`database:5432`)
                                 └── Mailpit SMTP (`mailpit:1025`)

Developer utilities
  ├── Mailpit UI → http://localhost:8025
  └── Adminer → http://localhost:8080
```

The web app uses two API addresses:

- `NEXT_PUBLIC_API_URL`: browser-visible URL, normally
  `http://localhost:4000`.
- `INTERNAL_API_URL`: server-rendering URL inside Docker, normally
  `http://api:4000`.

Do not replace the internal URL with `localhost` inside the web container;
`localhost` there means the web container itself.

## 6. Core data model

Main Prisma models:

- Identity: `User`, `OAuthAccount`, `VerificationToken`,
  `PasswordResetToken`, `UserSession`.
- Authorization: `Role`, `Permission`, `UserRole`, `RolePermission`.
- Designs: `DesignCategory`, `DesignSubcategory`, `InvitationTemplate`,
  `InvitationDesign`, `DesignVersion`, `AnimationComponent`.
- Invitations: `Event`, `InvitationInvitee`, `UserDesignUsage`.
- Content: `PageContent`, `BlogPost`.
- Operations: `AuditLog`.

Read `apps/api/prisma/schema.prisma` before changing database behavior.

### Important invariants

- `SUPER_ADMIN` is a protected system role. Database triggers prevent unsafe
  mutation and removal.
- The Super Admin user and role assignment cannot be deactivated or deleted.
- Published designs are versioned.
- Existing events reference a specific `DesignVersion`; publishing a newer
  design must not silently change old invitations.
- `UserDesignUsage` is lifetime history. Deleting an event must not remove its
  design from the user's history.
- Invitee slugs must remain unique.
- Prisma migrations are the source of truth. Do not manually alter the local
  database as a substitute for a migration.
- Seeding is idempotent and expects `SUPER_ADMIN_EMAIL`,
  `SUPER_ADMIN_PASSWORD`, and `SUPER_ADMIN_NAME`.

## 7. Template and design rules

A template is an editable staff working file. A design is a published,
versioned snapshot visible to users.

Invitation templates are one complete `.html` document:

- CSS belongs inside `<style>`.
- Visual motion uses CSS animation.
- The only permitted `<script>` is the `nimto-template-meta` JSON block;
  executable JavaScript is rejected by the upload scanner.
- Editable elements use `data-nimto-field`.
- Sections use `data-nimto-section`.
- Features use `data-nimto-feature`.
- Metadata uses:

```html
<script type="application/json" id="nimto-template-meta">
  { "name": "Example", "sections": [], "fields": [], "features": [] }
</script>
```

Do not put React, Vue, Angular, API keys, authentication logic, payment logic,
or backend logic into invitation HTML.

Read `docs/module-2-template-and-design-epics.md` before changing template
scanning, publishing, fields, modes, or versioning.

## 8. Main API areas

- `/health`
- `/auth/*`
- `/events/*`
- `/template-design/*`
- `/cms/public/*`
- `/cms/admin/*`
- `/admin/*`

Public invitation pages are loaded through `/events/public/:slug`. Permissioned
routes use JWT authentication and permission guards. Read the relevant
controller and service together before modifying a flow.

## 9. Frontend areas

- Public website: `/`, `/about`, `/features`, `/blog`.
- Authentication: `/auth`, `/auth/verify`, `/auth/oauth-success`.
- User workspace: `/dashboard`, `/designs`, `/events`, `/profile`, `/settings`.
- Public invitation: `/invite/[slug]`.
- Administration: `/event-management`, `/users`, `/staff`, `/roles`,
  `/permissions`, `/sessions`, `/audit`, `/website`, `/design-setup`,
  `/settings`, `/admin-profile`.

`apps/web/lib/api.ts` is the shared browser-side API client.
`apps/web/lib/server-api.ts` selects the correct server-rendering API address.

## 10. Environment files

Never commit:

- `.env`
- `.env.local`
- `.env.docker`
- credentials, access tokens, database URLs, OAuth secrets, or SMTP passwords

Safe templates:

- `.env.docker.example`
- `apps/api/.env.example`
- `apps/web/.env.example`

Google OAuth is optional for local work. Email/password authentication and
Mailpit should remain functional without Google credentials.

Google OAuth remains enabled for production deployments. Local Docker builds
set `NEXT_PUBLIC_GOOGLE_AUTH_ENABLED=false` and use email/password as the
fallback, avoiding changes to the existing production OAuth client.

## 11. Standard commands

### Complete Docker environment

```bash
cp .env.docker.example .env.docker
npm run docker:up
npm run docker:logs
npm run docker:down
npm run docker:reset
```

`docker:reset` deletes the local PostgreSQL volume. Do not run it casually.

### Application builds

```bash
npm run build --workspace @nimto/api
npm run build --workspace @nimto/web
```

### Prisma

```bash
npm run prisma:generate --workspace @nimto/api
npm run prisma:migrate:deploy --workspace @nimto/api
npm run prisma:seed --workspace @nimto/api
```

### Hot reload

```bash
npm run start:dev --workspace @nimto/api
npm run dev --workspace @nimto/web
```

## 12. Verification checklist

Use checks proportional to the change. For a full-stack change:

1. Build API and web.
2. Run `docker compose --env-file .env.docker config --quiet`.
3. Start the stack and confirm every service is healthy.
4. Check `http://localhost:4000/health`.
5. Check `http://localhost:3000`.
6. Test login and an authenticated `/auth/me` request.
7. If registration/mail changed, confirm Mailpit receives the verification
   message.
8. If schema changed, verify migrations on a fresh database when safe.

## 13. Working rules for AI assistants

- Inspect `git status` before editing. Preserve unrelated user changes.
- Do not commit local secrets or generated environment files.
- Do not reset, delete, or overwrite user work without explicit permission.
- Default delivery rule: after verification, commit and push completed work to
  `origin/main` so production receives it. Do not leave completed work only on
  a `codex/...` branch unless the user explicitly asks for that workflow.
- Keep the public README focused on users and contributors; keep detailed
  implementation handoff information in this file.
- Update this file when architecture, setup, major features, or limitations
  change.
- Update the public README when the product experience or onboarding flow
  changes.
- Add Prisma migrations for schema changes.
- Preserve design-version compatibility for existing events.
- Prefer the existing modules and shared API helpers over duplicate code.
- State clearly whether a capability is implemented, partially implemented, or
  only planned.

## 14. Known local setup

The original development Mac uses Colima as its Docker engine. Colima is
registered as a Homebrew service and the Docker CLI context is named `colima`.
Other developers may use Docker Desktop without changing project files.

The Docker Compose stack was previously verified with:

- all 21 Prisma migrations applied;
- seeded Super Admin login;
- authenticated `/auth/me`;
- healthy web and API containers;
- Adminer access;
- Mailpit receiving a real registration verification email.

Re-run verification after meaningful code or infrastructure changes; this
section records prior success, not a permanent guarantee.

## 15. Recent handoff notes

- As of June 27, 2026, the latest completed auth work was on branch
  `codex/auth-email-otp-flow`.
- Recent completed commits:
  - `5de19a7` - Add OTP email verification and password reset flow
  - `ec7c6f5` - Handle SMTP failures with generic auth errors
  - `f9b840c` - Create users only after email verification
- Registration now uses a pending-registration flow. A user record is created
  only after the email verification code is confirmed successfully.
- Local email sending is implemented for verification and password reset.
- In local development, emails are sent through Mailpit, not to public inbox
  providers by default. Mailpit UI: `http://localhost:8025`.
- If asked "where were we?" the safest short answer is: we were finishing the
  email OTP verification and password-reset auth flow, then tightening
  registration so accounts are only created after successful email
  verification.
- As of July 10, 2026, RSVP/template support, secure template uploads,
  invitation preview fixes, and mobile direct-editing work are completed and
  must be delivered through `main` by default.
