# Nimto

Nimto is a digital invitation platform. This first milestone is a deployment test that connects:

- Vercel frontend: Next.js app in `apps/web`
- Render backend: NestJS API in `apps/api`
- Supabase database: PostgreSQL accessed through Prisma

## Local setup

1. Install dependencies:

```bash
npm install
```

2. Create backend env:

```bash
cp apps/api/.env.example apps/api/.env
```

Set `DATABASE_URL` to your Supabase PostgreSQL connection string and set a strong `JWT_SECRET`.

3. Create frontend env:

```bash
cp apps/web/.env.example apps/web/.env.local
```

For local testing, keep:

```bash
NEXT_PUBLIC_API_URL=http://localhost:4000
```

4. Create the database table:

```bash
npm run prisma:migrate
```

5. Run both apps:

```bash
npm run dev:api
npm run dev:web
```

Open `http://localhost:3000`, register with name/email/password, then log in.

## Deploy to Supabase, Render, and Vercel

### Supabase

1. In Supabase, create a project.
2. Go to Project Settings -> Database.
3. Copy the pooled connection string. It usually contains port `6543`.
4. Replace the password placeholder in the URL with your real database password.

### Render backend

Create a new Web Service from this GitHub repo.

- Root Directory: `nimto-app/apps/api`
- Runtime: Node
- Build Command: `npm install && npm run prisma:generate && npm run build`
- Start Command: `npm run prisma:migrate:deploy && npm run start:prod`

Environment variables:

- `DATABASE_URL`: Supabase PostgreSQL URL
- `JWT_SECRET`: long random secret
- `FRONTEND_URL`: your Vercel app URL, for example `https://nimto.vercel.app`
- `PORT`: Render sets this automatically, so you do not need to add it

After deploy, test:

```bash
curl https://your-render-url.onrender.com/health
```

### Vercel frontend

Create a new Vercel project from the same GitHub repo.

- Root Directory: `nimto-app/apps/web`
- Framework Preset: Next.js
- Build Command: `npm run build`

Environment variables:

- `NEXT_PUBLIC_API_URL`: your Render backend URL, for example `https://nimto-api.onrender.com`

Deploy, then register a user from the Vercel site. If the dashboard opens, all three services are connected.

## About Supabase agent skills

The command `npx skills add supabase/agent-skills` installs AI-assistant guidance for Supabase workflows. It is not required for the Nimto app code to run. This app connects to Supabase through Prisma using `DATABASE_URL`.
