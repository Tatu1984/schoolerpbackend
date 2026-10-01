# School ERP - Backend API

REST API for the School ERP platform. It is the only service that talks to the database; the web frontend and the parent/student mobile app are separate projects that call it.

Stack: Next.js 14 route handlers, Prisma 5, PostgreSQL (Neon), JWT bearer auth.

## Run

```bash
cp .env.example .env     # set DATABASE_URL and JWT_SECRET (openssl rand -hex 32)
npm install
npm run dev              # http://localhost:4000
```

| Script | Purpose |
|---|---|
| `npm run dev` / `build` / `start` | Run the API on port 4000 |
| `npm run typecheck` | TypeScript check |
| `npm run db:push` | Apply `prisma/schema.prisma` to the database |
| `npm run db:seed` | Base data (school, admin user) |
| `npm run db:seed:demo` | Demo students, parents, fees, classes (safe to re-run) |

## API

See [docs/API.md](docs/API.md). In short:

- `POST /api/v1/auth/login` returns an access token and a refresh token
- every other call sends `Authorization: Bearer <accessToken>`
- parents and students can only reach `/api/v1/portal/*` and `/api/v1/auth/*`
- `GET /api/v1/health` for uptime checks

`/api/*` and `/api/v1/*` are the same API.

## Layout

- `app/api/` - route handlers, one folder per resource
- `lib/` - auth (`jwt.ts`, `auth-service.ts`), request helpers (`api-utils.ts`), validation, domain helpers
- `middleware.ts` - token check, role gates, CORS
- `prisma/` - schema and seeds

## Deploy (Vercel)

Import this repository as its own project and set `DATABASE_URL`, `JWT_SECRET` and `CORS_ORIGINS`. The data backup feature writes to local disk and does not persist on Vercel.
