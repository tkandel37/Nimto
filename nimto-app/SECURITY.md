# myNimto security operations

The repository enforces authenticated server-side sessions, exact CORS origins,
request throttling, security headers, hashed one-time credentials, database row
security, and least-privilege deployment boundaries. Production still requires
the infrastructure controls below; they cannot be safely embedded in source.

## Required production secrets

Generate a new JWT secret for every environment and store it only in the
deployment secret manager:

```sh
openssl rand -base64 48
```

`JWT_SECRET` must be at least 32 characters and must not use an example value.
The API refuses to start in production otherwise. Set `JWT_ISSUER=nimto-api`,
`JWT_AUDIENCE=nimto-web`, and rotate the secret immediately after suspected
disclosure. Rotation intentionally signs every user out.

Configure Google OAuth only when all three values are available:
`GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, and an HTTPS
`GOOGLE_CALLBACK_URL`. OAuth uses PKCE, encrypted state, and a browser-bound
state cookie. Provider access and refresh tokens are not retained.

## Database roles and migrations

Use two PostgreSQL credentials:

- `DATABASE_URL`: a login role that owns no schema and inherits only the
  `nimto_runtime` NOLOGIN role created by the migration.
- `MIGRATION_DATABASE_URL`: a separately stored owner/migration credential used
  only while `prisma migrate deploy` runs. The hardening migration must be able
  to create the `nimto_runtime` role.

After creating the application login, grant it the runtime group role once:

```sql
GRANT nimto_runtime TO nimto_login;
```

Do not grant `nimto_login` privileges directly. The migration gives
`nimto_runtime` CRUD access and an RLS policy on application tables, while
excluding Prisma's migration history table.

Do not run the API with `postgres`, a Supabase owner role, `BYPASSRLS`,
`CREATEDB`, or `CREATEROLE`. The security migration enables RLS and revokes
`anon`, `authenticated`, `service_role`, and `PUBLIC` access to every existing
public table and sequence. Keep the Supabase Data API disabled when it is not
used. Every future migration that creates a table must also enable RLS before
deployment and add a policy scoped to `nimto_runtime`.

Apply migrations before starting the new application release:

```sh
MIGRATION_DATABASE_URL='postgresql://migration-role:.../nimto?sslmode=require' \
  npm run prisma:migrate:deploy --workspace @nimto/api
```

The hardening migration rotates all personalized invitee URLs because older
URLs embedded guest names and were guessable. Hosts must re-share personalized
links after deployment.

## Browser session deployment

The session JWT is held only in an `HttpOnly` cookie. Keep the frontend and API
same-site and use `AUTH_COOKIE_SAME_SITE=lax` whenever possible. If a genuinely
cross-site deployment requires `none`, HTTPS is mandatory. `FRONTEND_URL` must
contain exact comma-separated HTTPS origins; wildcards are not accepted.

Terminate TLS at a trusted reverse proxy and set `TRUST_PROXY` only to the
proxy networks or hop count actually in use. Never trust arbitrary forwarded
IP headers from the public internet.

## DDoS and automated abuse controls

The API applies per-instance throttles and request-size limits. A production
CDN/WAF or load balancer must enforce distributed limits before traffic reaches
Node.js or PostgreSQL. At minimum:

- challenge or block repeated requests to `/auth/register`, `/auth/login`,
  `/auth/forgot-password`, `/auth/verify-email`, and `/auth/google`;
- cap `/events/public/*/rsvp` more aggressively than public invitation reads;
- enforce connection, header, URL, and body-size limits and a global emergency
  rate limit;
- enable managed bot, credential-stuffing, and layer-7 DDoS protections;
- alert on sustained 401, 403, and 429 rates, mail bursts, database saturation,
  and abnormal RSVP creation.

For multiple API replicas, replace the built-in throttler storage with a shared
Redis-compatible store in addition to the edge limits.

## Verification after deployment

1. Confirm old JWTs, password-reset links, and email codes are rejected.
2. Confirm unauthenticated Data API reads and writes return denied responses.
3. Confirm authentication cookies include `HttpOnly`, `Secure` in production,
   and the configured `SameSite` value.
4. Confirm the frontend and API return CSP, HSTS, clickjacking, MIME-sniffing,
   referrer, and permissions headers.
5. Run `npm audit`, API build, web lint, and web production build.

Report suspected vulnerabilities privately to the repository owner. Do not put
credentials, personal guest data, exploit payloads, or production URLs in a
public issue.
