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
| `npm test` | Unit tests (tokens, middleware access rules, password policy) |
| `npm run smoke` | End-to-end check against a running API (see `scripts/smoke.mjs` for the env vars) |
| `npm run db:deploy` | Apply pending migrations in `prisma/migrations` |
| `npm run db:seed` | Base data (school, admin user) |
| `npm run db:seed:demo` | Demo students, parents, fees, classes (safe to re-run) |

## Database changes

The schema is managed with Prisma migrations. To change it: edit `prisma/schema.prisma`, create a migration folder with the SQL from
`npx prisma migrate diff --from-schema-datasource prisma/schema.prisma --to-schema-datamodel prisma/schema.prisma --script`,
review it, then run `npm run db:deploy`. Do not use `prisma db push` against a database that holds real data.

## API

See [docs/API.md](docs/API.md). In short:

- `POST /api/v1/auth/login` returns an access token and a refresh token
- every other call sends `Authorization: Bearer <accessToken>`
- parents and students can only reach `/api/v1/portal/*` and `/api/v1/auth/*`
- sign-in is rate limited, temporary passwords must be changed at first sign-in, and tokens are revoked on password change
- `GET /api/v1/health` for uptime checks

`/api/*` and `/api/v1/*` are the same API.

## Layout

- `app/api/` - route handlers, one folder per resource
- `lib/` - auth (`jwt.ts`, `auth-service.ts`), request helpers (`api-utils.ts`), validation, domain helpers
- `middleware.ts` - token check, role gates, CORS
- `prisma/` - schema and seeds

## Deploy (Vercel)

Import this repository as its own project and set `DATABASE_URL`, `JWT_SECRET` and `CORS_ORIGINS`. The data backup feature writes to local disk and does not persist on Vercel; rely on Neon's point-in-time restore there.

CI (`.github/workflows/ci.yml`) runs schema validation, type-check, tests, build and a dependency audit on every push.
